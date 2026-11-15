// Chapter 7: the public attack kit (apespace-public/e2ee-attacks).
// Results shown are from the run against the live development build, 11 November 2026.
window.WT = window.WT || {};

(function () {
    const { relay, media, scr } = WT;
    const EMOJI = '🦄🏆☁️🐼🚆📁🐶';
    const mal = { mallory: 'hot', prosody: 'bad' };
    const malLabel = { prosody: { label: 'Prosody · controlled by Mallory', sub: 'can read, change, hold back or invent any signalling message' } };

    WT.chapters.push({
        id: 'attacks',
        title: 'Attacks, and how they’re caught',
        steps: [
            {
                scene: 'meeting',
                title: 'Meet Mallory, a dishonest server',
                show: [ 'mallory' ],
                focus: [ 'mallory', 'prosody', 'srv' ],
                state: mal,
                labels: malLabel,
                plain: `
                    <p>Suppose the server operator turned dishonest. We'll call her <b>Mallory</b>. She controls the switchboard, so she can <b>read, change, hold back or invent any message</b> between the browsers. That is the most power a server operator has.</p>
                    <p>APE Space publishes an <b>attack kit</b> that lets anyone play Mallory against a real APE Space meeting and watch what happens. The following steps show each attack it runs.</p>
                    <p>The goal isn't to show that Mallory can't <i>try</i>. A server can always try. It's to show she <b>can't both read the meeting and stay unnoticed</b>.</p>`,
                hood: `
                    <ul>
                        <li>The kit (<code>e2ee-attacks/</code>) opens its own Chrome browsers with Playwright and intercepts each one's XMPP WebSocket (<code>routeWebSocket</code>). It can rewrite every stanza, exactly what whoever runs Prosody can do. It can only attack the browsers it launched, so it is safe to run against a live deployment.</li>
                        <li>Mallory runs real Olm, the same library as the browsers, with her own identity keys.</li>
                        <li>Run everything: <code>node run-all.mjs --url "https://&lt;meeting URL&gt;"</code>. Add <code>--headed --slowmo 500</code> to watch the browsers.</li>
                        <li>Each run prints a <code>VERDICT</code>. It exits non-zero only if the server both read media <b>and</b> passed verification.</li>
                    </ul>`,
                inner: { h_screen: scr.e2ee('Bob'), g_screen: scr.e2ee('Alice') }
            },
            {
                scene: 'meeting',
                title: 'Baseline: an honest server',
                show: [ 'mallory' ],
                labels: { mallory: { label: 'Mallory (idle)', icon: '😇' } },
                plain: `
                    <p>First, a control run with Mallory doing nothing (<code>--attack none</code>). This shows what a healthy meeting looks like, so the attacks have something to be compared with.</p>
                    <table>
                        <tr><th>Media keys Mallory read</th><td class="good">0</td></tr>
                        <tr><th>Emoji</th><td>match on both sides</td></tr>
                        <tr><th>Verification</th><td class="good">both verified</td></tr>
                        <tr><th>Video frames decrypted by the other participant</th><td>600 of 600</td></tr>
                    </table>`,
                hood: `
                    <p>From the kit's result file: <code>keysStolen: []</code>, emoji the same on both sides, <code>verified.success: true</code> for both, media <code>byReceiver: 600</code>, <code>byMallory: 0</code>, and Inspector comparison <code>noInterception: true</code>.</p>`,
                flows: [ ...media('h', true), ...media('g', true, 1200) ],
                chips: { mallory: [ [ '0 keys', 'ok' ] ], jvb: [ [ 'scrambled frames only', 'enc' ] ] },
                inner: { h_screen: scr.verified('Bob'), g_screen: scr.verified('Alice') }
            },
            {
                scene: 'meeting',
                title: 'Attack 1: swap the keys in the invitation',
                show: [ 'mallory' ],
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody', 'mallory', 'h_screen', 'g_screen' ],
                state: { ...mal, g_vault: [ 'bad', 3000 ] },
                labels: malLabel,
                plain: `
                    <p>Mallory catches Alice's invitation to open a sealed channel and <b>replaces the keys inside it with her own</b>. If Bob accepted, his channel would lead to Mallory, and she would receive every media key.</p>
                    <p>But the invitation must be <b>signed with Alice's signing key</b>, which never leaves Alice's vault. Bob's vault checks the signature against Alice's published badge, it doesn't match, and Bob's vault <b>refuses</b>.</p>
                    <p>E2EE doesn't start, so cameras stay paused (fail closed). <b>Mallory reads nothing.</b></p>`,
                hood: `
                    <ul>
                        <li><code>--attack swap</code>: Mallory replaces the identity key and one-time key in <code>session-init</code>, leaving presence untouched.</li>
                        <li>Rejected with “Invalid key signature” (signature check from <code>olm-key-auth.patch</code>).</li>
                        <li>Dev result: <code>keysStolen: []</code>, frames decrypted by Mallory 0. The Inspector comparison flags <code>sessionInit: fail</code>.</li>
                    </ul>`,
                flows: relay('h', 'session-init ✍️', 'sig', 0, { label2: 'session-init (Mallory’s keys)', k2: 'bad' }),
                chips: { g_vault: [ [ '✗ invalid key signature', 'bad', 3000 ] ], mallory: [ [ '0 keys', 'ok', 3300 ] ] },
                inner: { h_screen: scr.paused(), g_screen: scr.paused() }
            },
            {
                scene: 'meeting',
                title: 'Attacks 2 and 3: also fake the published badges',
                show: [ 'mallory' ],
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody', 'mallory' ],
                state: { ...mal, g_vault: [ 'bad', 6000 ] },
                labels: malLabel,
                plain: `
                    <p>Mallory goes further. She also rewrites the <b>agreement key</b> on Alice's published badge, and then on everyone's, so that everything Bob can see points to her.</p>
                    <p>It still fails. Alice's <b>signing key</b> on the badge is real, and Mallory can't produce Alice's signature. Bob's vault refuses again. <b>0 keys.</b></p>`,
                hood: `
                    <ul>
                        <li><code>--attack swap-presence</code> also replaces the initiator's published Curve25519 key, as seen by the responder.</li>
                        <li><code>--attack swap-full</code> replaces every published Curve25519 key in both directions.</li>
                        <li>Both are rejected because the <code>session-init</code> signature is checked against the published <b>Ed25519</b> key, which Mallory left alone. Dev result: 0 keys stolen in both.</li>
                    </ul>`,
                flows: [
                    { e: 'g_lib-prosody', rev: true, label: 'Alice’s badge (fake agreement key)', k: 'bad', at: 0, dur: 1300 },
                    { e: 'h_lib-prosody', rev: true, label: 'Bob’s badge (fake agreement key)', k: 'bad', at: 300, dur: 1300 },
                    ...relay('h', 'session-init ✍️', 'sig', 3000, { label2: 'session-init (Mallory’s keys)', k2: 'bad' })
                ],
                chips: { g_vault: [ [ '✗ signature isn’t Alice’s', 'bad', 6000 ] ], mallory: [ [ '0 keys', 'ok', 6200 ] ] },
                inner: { h_screen: scr.paused(), g_screen: scr.paused() }
            },
            {
                scene: 'meeting',
                title: 'Attack 4: forge every identity',
                show: [ 'mallory' ],
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody', 'mallory', 'jvb' ],
                state: { ...mal, jvb: [ 'bad', 9000 ] },
                labels: malLabel,
                plain: `
                    <p>The strongest attack a server can mount: Mallory replaces <b>both keys on everyone's badge</b> with her own and signs everything with her own signing key. Each vault now sees a consistent fake world: Alice's channel leads to Mallory, and so does Bob's.</p>
                    <p>This time the media keys reach Mallory. She opens each one and passes it on, and she <b>can decrypt the media</b>. Alice and Bob notice nothing yet.</p>
                    <p>This is the limit of <b>every</b> end-to-end encrypted system without an outside identity source, Signal and WhatsApp included. Only a human check can catch it, and the next step shows that check.</p>`,
                hood: `
                    <ul>
                        <li><code>--attack swap-all</code>: every published Ed25519 and Curve25519 key is replaced with Mallory's, and every swapped key is signed with Mallory's Ed25519 key.</li>
                        <li>Mallory holds two real Olm sessions. She decrypts <code>key-info</code> and re-encrypts it for the other side.</li>
                        <li>Dev result: Mallory read the media keys of both participants and decrypted 600 of 600 frames from each.</li>
                    </ul>`,
                flows: [
                    { e: 'g_lib-prosody', rev: true, label: 'Alice’s badge = Mallory’s', k: 'bad', at: 0, dur: 1300 },
                    { e: 'h_lib-prosody', rev: true, label: 'Bob’s badge = Mallory’s', k: 'bad', at: 200, dur: 1300 },
                    ...relay('h', 'session-init', 'sig', 1800, { label2: 'session-init (Mallory)', k2: 'bad' }),
                    ...relay('h', 'key-info', 'key', 5200, { label2: 'key-info (re-sealed)', k2: 'bad' })
                ],
                chips: {
                    g_vault: [ [ '✓ signature matches (fake) badge', 'warn', 4800 ] ],
                    mallory: [ [ '🗝️ has the media keys', 'bad', 6700 ] ],
                    jvb: [ [ '👁️ Mallory decrypts 600/600 frames', 'bad', 9000 ] ]
                },
                inner: { h_screen: scr.e2ee('Bob'), g_screen: scr.e2ee('Alice') },
                cycle: 11000
            },
            {
                scene: 'meeting',
                title: '…but verification catches it',
                show: [ 'mallory' ],
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody', 'mallory', 'h_screen', 'g_screen' ],
                state: { ...mal, h_screen: [ 'bad', 3600 ], g_screen: [ 'bad', 3600 ] },
                labels: malLabel,
                plain: `
                    <p>Alice and Bob verify each other. In this run Mallory let the emoji messages through untouched, so the emoji <b>match</b>.</p>
                    <p>Then the automatic final check runs. Each vault seals its <b>real</b> identity keys, but each side holds Mallory's fake badge for the other. The seals don't match, and both screens turn red: <b>“The emoji matched, but Bob's encryption keys could not be confirmed.”</b></p>
                    <p>Had Mallory tampered with the emoji exchange instead, the emoji would have differed. Either way, <b>one comparison exposes her</b>.</p>`,
                hood: `
                    <ul>
                        <li>Dev result: emoji identical (🦄 🏆 ☁️ 🐼 🚆 📁 🐶 on both), <code>verified: { success: false, message: "e2ee.sas.mac-mismatch" }</code> on both, notification <code>e2ee.verificationKeysMismatch</code>, and the label shows “Verification failed” in red.</li>
                        <li>The Inspector's capture comparison independently reports <code>identity: fail</code> in both directions.</li>
                        <li>That's why the promise has a condition: <i>provided participants confirm the safety number</i> (or the emoji).</li>
                    </ul>`,
                flows: [
                    ...relay('h', 'sas-mac', 'sas'),
                    ...relay('g', 'sas-mac', 'sas', 300)
                ],
                chips: {
                    h_vault: [ [ '✗ keys don’t match the badge', 'bad', 3300 ] ],
                    g_vault: [ [ '✗ keys don’t match the badge', 'bad', 3000 ] ]
                },
                inner: {
                    h_screen: [ [ scr.emoji(EMOJI, '<span class="lbl ok">They match ✓</span>'), 0 ], [ scr.failed('Bob', 'The emoji matched, but Bob’s encryption keys could not be confirmed.'), 3600 ] ],
                    g_screen: [ [ scr.emoji(EMOJI, '<span class="lbl ok">They match ✓</span>'), 0 ], [ scr.failed('Alice', 'The emoji matched, but Alice’s encryption keys could not be confirmed.'), 3600 ] ]
                }
            },
            {
                scene: 'meeting',
                title: 'Attack 5: rig the group safety number',
                show: [ 'mallory' ],
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody', 'mallory', 'h_screen', 'g_screen' ],
                state: { ...mal, h_screen: [ 'bad', 6200 ], g_screen: [ 'bad', 6200 ] },
                labels: malLabel,
                plain: `
                    <p>With every identity forged, Mallory now tries to make the <b>group safety number</b> come out the same for everyone. She replaces each person's commitment and revealed value with values of her own.</p>
                    <p>She can't steer it. She has to <b>commit before she learns anyone's real value</b>, so she can't adjust later. The two screens show <b>different numbers</b>, and the moment someone reads theirs aloud, the attack is out.</p>`,
                hood: `
                    <ul>
                        <li><code>attacks/group-safety-number.mjs --attack swap-all</code> (two participants plus Mallory). Mallory replaces every commitment and reveal so that each commitment check passes.</li>
                        <li>Dev result: <code>4951 7029 8763</code> vs <code>0081 8909 4963</code>.</li>
                        <li>Chance of a forced match: 1 in 10¹². The honest three-person run gave the same number on all three.</li>
                    </ul>`,
                flows: [
                    { e: 'h_lib-prosody', label: '✉ commit', k: 'sas', at: 0, dur: 1000 },
                    { e: 'g_lib-prosody', rev: true, label: '✉ commit (Mallory’s)', k: 'bad', at: 1100, dur: 1100 },
                    { e: 'g_lib-prosody', label: '✉ commit', k: 'sas', at: 200, dur: 1000 },
                    { e: 'h_lib-prosody', rev: true, label: '✉ commit (Mallory’s)', k: 'bad', at: 1300, dur: 1100 },
                    { e: 'h_lib-prosody', label: '📭 reveal', k: 'sas', at: 3000, dur: 1000 },
                    { e: 'g_lib-prosody', rev: true, label: '📭 reveal (Mallory’s)', k: 'bad', at: 4100, dur: 1100 },
                    { e: 'g_lib-prosody', label: '📭 reveal', k: 'sas', at: 3200, dur: 1000 },
                    { e: 'h_lib-prosody', rev: true, label: '📭 reveal (Mallory’s)', k: 'bad', at: 4300, dur: 1100 }
                ],
                inner: {
                    h_screen: [ [ '<div class="scr"><span class="small">Comparing safety number…</span></div>', 0 ], [ scr.num('4951 7029 8763', '<span class="small">Alice reads this aloud…</span>'), 5600 ] ],
                    g_screen: [ [ '<div class="scr"><span class="small">Comparing safety number…</span></div>', 0 ], [ scr.num('0081 8909 4963', '<span class="lbl bad">“Mine is different!”</span>'), 5600 ] ]
                },
                notes: [ { x: 780, y: 620, w: 400, at: 6200, k: 'bad', html: '<b>Different numbers → attack visible to everyone.</b> Bob answers “Someone sees a different number”, and every participant is warned.' } ],
                cycle: 9500
            },
            {
                scene: 'meeting',
                title: 'Attack 6: a hidden listener',
                show: [ 'mallory', 'ghost' ],
                focus: [ 'ghost', 'prosody', 'mallory', 'h_lib', 'h_vault', 'g_lib', 'g_vault', 'h_screen', 'g_screen' ],
                state: { ...mal, ghost: 'bad', h_vault: [ 'ok', 3000 ], g_vault: [ 'ok', 3200 ] },
                labels: malLabel,
                plain: `
                    <p>Recorders and transcribers join meetings as <b>hidden participants</b>, which the participant list doesn't show. Mallory adds a “ghost” in that hidden area and asks each browser for a sealed channel. With one, the ghost would get the media keys while nobody sees it in the list.</p>
                    <p>Every vault <b>refuses anyone hidden</b>, in both directions. The ghost gets <b>0 keys</b>, and each person's key-recipient list shows only the real participants.</p>
                    <p>If Mallory makes the ghost <b>visible</b> instead, it can receive keys like any participant, but it then appears in everyone's participant list and key-recipient list, and it changes the group safety number. People can see it and remove it.</p>`,
                hood: `
                    <ul>
                        <li><code>attacks/hidden-recipient.mjs</code>: the ghost is announced on the deployment's hidden domain and opens Olm sessions signed with its own identity key.</li>
                        <li>Refused with <code>e2ee.session.hidden-participant</code> (<code>hidden-key-recipients.patch</code>). With <code>--visible</code>, the same participant is shown in the list and does receive keys.</li>
                        <li>Sandbox comparison: the previous library gave the hidden participant 2 of 2 keys and 100% of relayed frames. The patched library gives 0 keys and 0%.</li>
                        <li>Server recording, live streaming (Jibri) and transcription (Jigasi) are hidden participants too, so they are blocked during E2EE.</li>
                    </ul>`,
                flows: [
                    { e: 'ghost-prosody', label: 'session-init (hidden)', k: 'bad', at: 0, dur: 1400 },
                    { e: 'h_lib-prosody', rev: true, label: 'session-init (hidden)', k: 'bad', at: 1500, dur: 1000 },
                    { e: 'g_lib-prosody', rev: true, label: 'session-init (hidden)', k: 'bad', at: 1700, dur: 1000 },
                    { e: 'h_lib-h_vault', label: '?', k: 'bad', at: 2550, dur: 400 },
                    { e: 'g_lib-g_vault', label: '?', k: 'bad', at: 2750, dur: 400 }
                ],
                chips: {
                    h_vault: [ [ '⛔ refused: hidden participant', 'ok', 3000 ] ],
                    g_vault: [ [ '⛔ refused: hidden participant', 'ok', 3200 ] ],
                    ghost: [ [ '0 keys', 'ok', 3400 ] ]
                },
                inner: {
                    h_screen: '<div class="scr"><span class="lbl ok">🔒 End-to-end encrypted</span><span class="small">Decrypted only by: <b>Bob</b></span></div>',
                    g_screen: '<div class="scr"><span class="lbl ok">🔒 End-to-end encrypted</span><span class="small">Decrypted only by: <b>Alice</b></span></div>'
                }
            },
            {
                scene: 'meeting',
                title: 'Control: the test does catch a real hole',
                show: [ 'mallory' ],
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody', 'mallory', 'h_screen', 'g_screen' ],
                state: { ...mal, h_lib: 'warn', g_lib: 'warn' },
                labels: {
                    ...malLabel,
                    h_lib: { label: 'lib-jitsi-meet (OLD, pre-fix)', sub: 'plain v2118: no key signatures' },
                    g_lib: { label: 'lib-jitsi-meet (OLD, pre-fix)', sub: 'plain v2118: no key signatures' }
                },
                plain: `
                    <p>A test that always passes proves nothing. So the kit can also rebuild the library APE Space started from, <b>before</b> the fix, and run the same attack against it.</p>
                    <p>Against the old code, the simple key swap (attack 1) <b>works</b>: Mallory reads every media key, and both people still see <b>“verified”</b>. That is the exact hole the current build closes, and it shows the kit would notice if it came back.</p>`,
                hood: `
                    <ul>
                        <li><code>./build-old-lib.sh</code> rebuilds plain lib-jitsi-meet v2118 (base <code>67fd2c84</code>, no patches) into <code>./old-lib</code> (needs Docker).</li>
                        <li><code>node attacks/olm-mitm.mjs --url … --attack swap --client old --lib ./old-lib</code>, against a server built from the pre-fix source.</li>
                        <li>Upstream Jitsi fixed this in commit <code>4a958bc1</code> (first released in v2207). APE Space applies that commit as <code>olm-key-auth.patch</code>.</li>
                    </ul>`,
                flows: [
                    ...relay('h', 'session-init (unsigned)', 'sig', 0, { label2: 'session-init (Mallory’s keys)', k2: 'bad' }),
                    ...relay('h', 'key-info', 'key', 3300, { label2: 'key-info (re-sealed)', k2: 'bad' })
                ],
                chips: {
                    g_vault: [ [ 'accepted (nothing to check)', 'warn', 3000 ] ],
                    mallory: [ [ '🗝️ reads every key', 'bad', 4800 ] ]
                },
                inner: { h_screen: scr.verified('Bob'), g_screen: scr.verified('Alice') },
                notes: [ { x: 20, y: 620, w: 400, k: 'bad', at: 5000, html: '<b>INSECURE</b> on the old library: keys read <i>and</i> “verified”. The current build turns this into a refusal (attack 1).' } ]
            },
            {
                scene: 'meeting',
                title: 'More checks in the kit',
                show: [ 'mallory' ],
                state: { mallory: 'hot' },
                plain: `
                    <p>Besides the key-exchange attacks, the kit has <b>checks</b> for single protections. Each one was run against the development build:</p>
                    <table>
                        <tr><th>Check</th><th>Result on development</th></tr>
                        <tr><td>A newcomer tries her keys on media sent before she joined</td><td class="good">0 of 300 frames opened</td></tr>
                        <tr><td>Someone who left tries their keys on later media</td><td class="good">0 of 300 frames opened (15 s or more after leaving)</td></tr>
                        <tr><td>One bit flipped in a frame's header, content, IV or tag</td><td class="good">rejected, 60 of 60 at each place</td></tr>
                        <tr><td>The server replays earlier audio frames</td><td class="good">0 of 20 played</td></tr>
                        <tr><td>A browser that can't encrypt joins an encrypted meeting</td><td class="good">it leaves at once; 0 unencrypted frames reach anyone</td></tr>
                        <tr><td>A guest's forged “encryption off”</td><td class="good">ignored; a host's “off” warns everyone</td></tr>
                        <tr><td>The media keys searched for in everything the browser sends, logs or stores</td><td class="good">found nowhere</td></tr>
                    </table>`,
                hood: `
                    <p>Scripts in <code>e2ee-attacks/checks/</code>: <code>key-lifecycle.mjs</code>, <code>frame-counter-replay.mjs</code>, <code>unsupported-participant.mjs</code>, <code>client-hygiene.mjs</code>, <code>codecs.mjs</code>, <code>media-path.mjs</code>, <code>content-channels.mjs</code>, <code>build-fingerprint.mjs</code> and <code>join-access.mjs</code>. Each takes <code>--url &lt;meeting URL&gt;</code>. Results are from 13 November 2026.</p>`,
                inner: { h_screen: scr.e2ee('Bob'), g_screen: scr.e2ee('Alice') },
                chips: { mallory: [ [ 'nothing to replay or reuse', 'ok' ] ] }
            },
            {
                scene: 'meeting',
                title: 'Scorecard',
                show: [ 'mallory' ],
                state: { mallory: 'hot' },
                plain: `
                    <p>Results of the full kit against the live development build (with the key vault), 11 November 2026:</p>
                    <table>
                        <tr><th>What Mallory forges</th><th>Media keys she read</th><th>What people see</th></tr>
                        <tr><td>Nothing (honest server)</td><td class="good">0</td><td>Both verified; video keeps decoding</td></tr>
                        <tr><td>Keys in the invitation</td><td class="good">0</td><td>Rejected automatically (“Invalid key signature”)</td></tr>
                        <tr><td>+ one published agreement key</td><td class="good">0</td><td>Rejected</td></tr>
                        <tr><td>+ every published agreement key</td><td class="good">0</td><td>Rejected</td></tr>
                        <tr><td><b>Every</b> key, including signing keys</td><td class="badc">reads media</td><td><b>Verification fails</b>: red warning on both sides</td></tr>
                        <tr><td>Every key + the group number</td><td class="badc">reads media</td><td><b>Different numbers</b> (4951… vs 0081…)</td></tr>
                        <tr><td>A hidden listener</td><td class="good">0</td><td>Refused; not a key recipient</td></tr>
                    </table>
                    <blockquote>The server can't both read the meeting and stay unnoticed. Hence the promise: APE Space cannot read your meeting, <i>provided</i> the verified release is running and participants confirm the safety number.</blockquote>`,
                hood: `
                    <p>The kit's own README is careful to say what it doesn't prove: it shows that these specific attacks, the ones a meeting server can actually mount, fail against the current build and succeed against the pre-fix code. It does not prove that no other attack exists. That's what the public source, the reproducible build and an independent audit are for.</p>
                    <p>The strongest check: point the kit at a server you built yourself from public source, after confirming its fingerprints match what the verification page reports.</p>`,
                inner: { h_screen: scr.verified('Bob'), g_screen: scr.verified('Alice') },
                chips: { mallory: [ [ 'caught or empty-handed', 'ok' ] ] }
            }
        ]
    });
})();
