// Who the meeting server lets in, for checklist row IDN-02 (an uninvited person
// joins a meeting). Tries to join with:
//
//   valid           the token given for this room (control: must join)
//   no token        nothing
//   other room      the valid token, on a different room name
//   expired         a token whose expiry has passed (--expired-token <jwt>)
//   tampered        the valid token with its room claim changed (signature broken)
//
// and reports, for each, whether the browser actually joined the conference.
//
//   node checks/join-access.mjs --url <meeting URL with jwt> [--expired-token <jwt>]

import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const meeting = new URL(arg('--url') ?? '');
const token = meeting.searchParams.get('jwt') ?? process.env.MEET_JWT;
const expired = arg('--expired-token');

if (!token) {
    console.error('Pass --url with ?jwt=..., or MEET_JWT.');
    process.exit(2);
}

const b64 = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const unb64 = s => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const [ head, body, sig ] = token.split('.');
const claims = JSON.parse(b64(body));
const tampered = `${head}.${unb64(JSON.stringify({ ...claims, room: `${claims.room}x` }))}.${sig}`;
const room = meeting.pathname.slice(1);
const otherRoom = `${room.slice(0, -4)}beef`;
const at = (r, jwt) => `${meeting.origin}/${r}${jwt ? `?jwt=${jwt}` : ''}#config.prejoinConfig.enabled=false`;

const attempts = [
    [ 'valid token, this room (control)', at(room, token), true ],
    [ 'no token', at(room, null), false ],
    [ 'valid token, another room', at(otherRoom, token), false ],
    // The expired token is used on its own room, so only its expiry is tested.
    ...expired ? [ [ 'expired token, its own room', at(JSON.parse(b64(expired.split('.')[1])).room, expired), false ] ] : [],
    [ 'token with the room claim changed', at(room, tampered), false ]
];

const browser = await chromium.launch({ channel: 'chrome', args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'
] });
const results = [];

for (const [ name, url, shouldJoin ] of attempts) {
    const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
    let joined = false;
    let screen = '';

    try {
        await page.goto(url, { timeout: 60000 });
        for (let i = 0; i < 40 && !joined; i++) {
            await page.waitForTimeout(1000);
            joined = await page.evaluate(() => Boolean(window.APP?.conference?._room?.isJoined?.())).catch(() => false);
            const join = page.getByRole('button', { name: /^join meeting$/i }).first();

            !joined && await join.isVisible().catch(() => false) && await join.click().catch(() => {});
        }
        screen = (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ').slice(0, 140);
    } catch (e) {
        screen = e.message.slice(0, 140);
    }
    await page.context().close();
    results.push({ name, joined, ok: joined === shouldJoin, screen });
}
await browser.close();

for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  IDN-02  ${r.name}: ${r.joined ? 'joined' : 'not joined'}`
        + `${r.joined ? '' : `  (screen: ${r.screen})`}`);
}
process.exit(results.every(r => r.ok) ? 0 : 1);
