// The build fingerprint a participant sees in the meeting, answering checklist
// row CLI-05 (the user can confirm the running build).
//
// Alice joins as the host, Bob as a guest (with a guest token when one is given).
// Bob opens Security options and reads "This meeting's code": the fingerprints of
// the app and the encryption library, and the link to the verification page. The
// check then:
//   - compares the app fingerprint Bob sees with the SHA-256 of the app bundle the
//     server serves;
//   - compares the library fingerprint with the published one
//     (extension/config.json);
//   - opens Bob's link to the verification page and reads which signed release it
//     reports.
//
//   node checks/build-fingerprint.mjs [--url <meeting URL>] [--guest-token <jwt>] [--headed]
//
// Without --guest-token, a deployment run uses ../sandbox/inspector/.dev-token-guest
// if present, as the switch-off test does.

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { joinMeeting, leaveMeeting, meetingTarget } from '../harness/meeting.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const target = meetingTarget(argv, 'fingerprint');
const config = JSON.parse(fs.readFileSync(path.join(HERE, '../../extension/config.json'), 'utf8'));
const results = [];
const check = (id, name, ok, detail) => results.push({ id, name, ok, detail });

setTimeout(() => {
    console.error('run exceeded 5 minutes, aborting');
    process.exit(1);
}, 300000).unref();

const guestFile = path.join(HERE, '../../../sandbox/inspector/.dev-token-guest');
const guestToken = arg('--guest-token')
    ?? (target.deployment && fs.existsSync(guestFile) ? fs.readFileSync(guestFile, 'utf8').trim() : null);

const browser = await chromium.launch({ channel: 'chrome', headless: !argv.includes('--headed'), args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream'
] });

async function join(name, token) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    let url = target.url({ 'userInfo.displayName': name });
    const jwt = new URL(url).searchParams.get('jwt');

    token && jwt && (url = url.replace(jwt, token));
    await joinMeeting(page, url, name);

    return page;
}

const alice = await join('alice');
const bob = await join('bob', guestToken);
const role = await bob.evaluate(() => APP.store.getState()['features/base/participants'].local.role);

// Security options: on the toolbar, or in the "More actions" menu.
const direct = bob.getByRole('button', { name: /security/i }).first();

if (!await direct.isVisible().catch(() => false)) {
    await bob.getByRole('button', { name: /more actions/i }).first().click();
    await bob.waitForTimeout(800);
}
await bob.getByRole('menuitem', { name: /security/i }).or(bob.getByRole('button', { name: /security/i })).first().click();
await bob.waitForSelector('#build-section', { timeout: 15000 });
// Polled from here: the meeting page's Content Security Policy forbids waitForFunction's eval.
let text = '';

for (let i = 0; i < 60 && (!text || /Calculating/.test(text)); i++) {
    await bob.waitForTimeout(500);
    text = await bob.locator('#build-section').innerText();
}
const link = await bob.locator('#build-section a').getAttribute('href');
const shown = {
    app: text.match(/App:\s*([0-9a-f]{64})/)?.[1],
    lib: text.match(/Encryption library:\s*([0-9a-f]{64})/)?.[1]
};

// What the server serves.
const origin = new URL(target.url({})).origin;
const served = await bob.evaluate(async u => {
    const bytes = await (await fetch(u, { cache: 'no-store' })).arrayBuffer();

    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}, `${origin}/libs/app.bundle.min.js`);

await Promise.all([ alice, bob ].map(p => leaveMeeting(p).catch(() => {})));

// Follow Bob's link to the verification page.
const pageView = await browser.newPage();
let lookup = { status: 'not opened', items: [] };

if (link) {
    await pageView.goto(link);
    await pageView.waitForFunction(() => !/Looking up/.test(document.querySelector('#mine .status')?.textContent ?? 'Looking up'),
        null, { timeout: 180000 });
    lookup = await pageView.evaluate(() => ({
        status: document.querySelector('#mine .status').textContent,
        items: [ ...document.querySelectorAll('#mine li') ].map(li => `${li.className}: ${li.textContent}`)
    }));
}
await browser.close();

console.log(`Bob's role: ${role}`);
console.log(`section: ${text.replace(/\n+/g, ' | ')}`);
console.log(`verification page: ${lookup.status}`);
for (const i of lookup.items) {
    console.log(`  ${i}`);
}
console.log('');

check('CLI-05', 'a guest sees the fingerprints in Security options', role !== 'moderator' && Boolean(shown.app && shown.lib),
    `role ${role}`);
check('CLI-05', 'the app fingerprint shown is the SHA-256 of the app bundle the server serves', shown.app === served,
    `${shown.app?.slice(0, 16)}… vs ${served.slice(0, 16)}…`);
check('CLI-05', 'the library fingerprint shown is the published one',
    shown.lib === config.encryptionLibrary.files['/libs/lib-jitsi-meet.min.js'], `${shown.lib?.slice(0, 16)}…`);
check('CLI-05', 'the link carries both fingerprints to the verification page',
    Boolean(link?.includes(`app=${shown.app}`) && link?.includes(`lib=${shown.lib}`)), link?.split('?')[0] ?? 'no link');
check('CLI-05', 'the verification page finds the signed release for them',
    /^Release [0-9a-f]{64}$/.test(lookup.status) && lookup.items.length > 0 && lookup.items.every(i => i.startsWith('ok')),
    lookup.status);

for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}  (${r.detail})`);
}
process.exit(results.every(r => r.ok) ? 0 : 1);
