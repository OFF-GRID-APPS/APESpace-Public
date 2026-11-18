// Chapters 1-6: the meeting, end-to-end encryption, emoji verification and the
// group safety number.
//
// Step fields: scene, title, plain (HTML), hood (HTML), focus [ids], show [optional ids],
// flows [{ e: edgeId, rev, label, k, at, dur }], state { id: 'ok'|'bad'|'warn'|'hot'|'off' | [v, atMs] },
// chips { id: [[text, kind, atMs]] }, inner { id: html | [[html, atMs], ...] }, labels { id: { label, sub, icon } },
// notes [{ x, y, w, html, k, at, big }], edges [ids], edgeState { id: v | [v, atMs] }, cycle, once.
window.WT = window.WT || {};
WT.chapters = [];

(function () {
    const other = p => (p === 'h' ? 'g' : 'h');

    // A message from one vault, through Prosody, to the other vault (about 3 s).
    WT.relay = function (from, label, k = 'key', t = 0, opts = {}) {
        const to = other(from);
        const k2 = opts.k2 ?? k;
        const label2 = opts.label2 ?? label;

        return [
            { e: `${from}_lib-${from}_vault`, rev: true, label, k, at: t, dur: 450 },
            { e: `${from}_lib-prosody`, label, k, at: t + 450, dur: 1000 },
            { e: `${to}_lib-prosody`, rev: true, label: label2, k: k2, at: t + 1500, dur: 1000 },
            { e: `${to}_lib-${to}_vault`, label: label2, k: k2, at: t + 2550, dur: 450 }
        ];
    };
    const relay = WT.relay;

    // Media from one camera to the other screen.
    WT.media = function (from, e2ee, t = 0) {
        const to = other(from);

        if (!e2ee) {
            return [
                { e: `${from}_cam-${from}_app`, label: 'camera', k: 'plain', at: t, dur: 700 },
                { e: `${from}_app-${from}_rtc`, label: 'raw video', k: 'plain', at: t + 650, dur: 1000 },
                { e: `${from}_rtc-jvb`, label: 'link-locked', k: 'hop', at: t + 1650, dur: 1100 },
                { e: `${to}_rtc-jvb`, rev: true, label: 'link-locked', k: 'hop', at: t + 3300, dur: 1100 },
                { e: `${to}_rtc-${to}_screen`, label: 'video', k: 'plain', at: t + 4450, dur: 600 }
            ];
        }

        return [
            { e: `${from}_cam-${from}_app`, label: 'camera', k: 'plain', at: t, dur: 700 },
            { e: `${from}_app-${from}_rtc`, label: 'raw video', k: 'plain', at: t + 650, dur: 1000 },
            { e: `${from}_worker-${from}_rtc`, rev: true, label: 'frame', k: 'plain', at: t + 1650, dur: 550 },
            { e: `${from}_worker-${from}_rtc`, label: 'locked', k: 'enc', at: t + 2250, dur: 550 },
            { e: `${from}_rtc-jvb`, label: 'scrambled', k: 'enc', at: t + 2850, dur: 1100 },
            { e: `${to}_rtc-jvb`, rev: true, label: 'scrambled', k: 'enc', at: t + 4100, dur: 1100 },
            { e: `${to}_worker-${to}_rtc`, rev: true, label: 'locked', k: 'enc', at: t + 5250, dur: 550 },
            { e: `${to}_worker-${to}_rtc`, label: 'unlocked', k: 'plain', at: t + 5850, dur: 550 },
            { e: `${to}_rtc-${to}_screen`, label: 'video', k: 'plain', at: t + 6450, dur: 600 }
        ];
    };
    const media = WT.media;

    // What a participant sees.
    WT.scr = {
        call: (who, extra = '') => `<div class="scr"><div class="vid"><span class="tile"></span><span><b>${who}</b> on camera</span></div>${extra}</div>`,
        e2ee: who => `<div class="scr"><div class="vid"><span class="tile"></span><span><b>${who}</b> on camera</span></div><span class="lbl ok">🔒 End-to-end encrypted</span></div>`,
        paused: () => '<div class="scr"><div class="vid"><span class="tile off"></span><span>Camera and mic <b>paused</b></span></div><span class="lbl mute">Enabling end-to-end encryption…</span></div>',
        emoji: (row, extra = '') => `<div class="scr"><span class="small">Verify participant · do these match?</span><div class="emoji">${row}</div>${extra}</div>`,
        num: (n, extra = '') => `<div class="scr"><span class="small">Group safety number</span><div class="num">${n}</div>${extra}</div>`,
        verified: who => `<div class="scr"><span class="lbl ok">✓ ${who} verified</span><span class="small">Emoji matched and keys confirmed</span></div>`,
        failed: (who, why) => `<div class="scr"><span class="lbl bad">⚠ Verification failed: ${who}</span><span class="small">${why}</span></div>`
    };
    const scr = WT.scr;
    const EMOJI = '☁️🎺🐶🚩😀🔒🌍';

    // ================================================================ 1
    WT.chapters.push({
        id: 'overview',
        title: 'The big picture',
        steps: [
            {
                scene: 'meeting',
                title: 'What this walkthrough proves',
                plain: `
                    <p>When end-to-end encryption (E2EE) is on, only the people in a meeting can see and hear it. APE Space runs the servers in the middle, and this walkthrough shows, step by step, why <b>those servers cannot read the meeting</b>, and how <b>you can check that yourself</b> instead of taking our word for it.</p>
                    <p>We follow two people, <b>Alice</b> (the host) and <b>Bob</b> (a guest), through a meeting. Then we play a dishonest server and try to break in. Finally we follow a new release from our build system to your browser and show how anyone can confirm the code is what we say it is.</p>
                    <blockquote>APE Space cannot read your meeting, provided the verified release is running and participants confirm the safety number.</blockquote>
                    <p>Every part of that sentence is covered in a chapter. Use <b>Next</b>, the arrow keys, or the chapter list to move around.</p>`,
                hood: `
                    <p>The proof has three parts:</p>
                    <ol>
                        <li><b>The encryption design</b> (chapters 2–6): keys are created in each participant's browser, exchanged over signed Olm channels, held in a sandboxed key vault, and confirmed by people with emoji or one group safety number.</li>
                        <li><b>Attacks fail visibly</b> (chapter 7): a public attack kit lets anyone act as a malicious meeting server against a real deployment. Every attack either gets nothing or sets off a verification warning.</li>
                        <li><b>The code is the code</b> (chapters 8–11): reproducible builds, Sigstore-signed release records in a public append-only log, a verification page, a browser extension, and a byte-for-byte public rebuild of the encryption code.</li>
                    </ol>
                    <p>Sources: the public repository <code>OFF-GRID-APPS/APESpace-Public</code> (<code>e2ee-module/</code>, <code>e2ee-attacks/</code>, <code>extension/</code>, <code>verify/</code>).</p>`,
                inner: { h_screen: scr.call('Bob'), g_screen: scr.call('Alice') }
            },
            {
                scene: 'meeting',
                title: 'Inside each browser',
                focus: [ 'h', 'g' ],
                plain: `
                    <p>Each participant's browser runs a few separate pieces. They matter later, so here they are:</p>
                    <ul>
                        <li><b>APE Space app</b> (grey): the meeting interface: buttons, layout, chat. Its source is closed, but every customer gets the same signed release (chapter 8).</li>
                        <li><b>lib-jitsi-meet</b> (teal): Jitsi's open-source library that runs the meeting and its encryption. Anyone can read and rebuild it.</li>
                        <li><b>Key vault</b> (purple): a sealed-off compartment that creates and holds every encryption key. The app can't look inside.</li>
                        <li><b>E2EE worker</b>: locks every video and audio frame before it leaves, and unlocks frames that arrive.</li>
                        <li><b>WebRTC</b>: the browser's built-in engine that turns camera images into compressed video and sends it.</li>
                    </ul>`,
                hood: `
                    <ul>
                        <li>lib-jitsi-meet is upstream <b>v2118.0.0</b> plus eight public patches: <code>olm-key-auth.patch</code> (Jitsi's own fix 4a958bc1), <code>hidden-key-recipients.patch</code>, <code>group-safety-number.patch</code>, <code>e2ee-key-vault.patch</code>, <code>newcomer-key-ratchet.patch</code>, <code>dtx-empty-frames.patch</code> (Jitsi's own fix 8b4d9371), <code>frame-counter-replay.patch</code> and <code>vp8-on-reenable.patch</code>.</li>
                        <li>The vault is <code>/libs/lib-jitsi-meet.e2ee-vault.html</code>, loaded in an <code>&lt;iframe sandbox="allow-scripts"&gt;</code>. The sandbox gives it an <i>opaque origin</i>, so the page cannot read its memory or DOM. It runs Olm (<code>@matrix-org/olm</code> 3.2.15) with the WebAssembly built into its script, and its own policy allows no network connections.</li>
                        <li>The worker is <code>/libs/lib-jitsi-meet.e2ee-worker.js</code>, attached to each sender and receiver through WebRTC encoded transforms (<code>RTCRtpScriptTransform</code>, or Chrome's encoded insertable streams).</li>
                    </ul>`,
                inner: { h_screen: scr.call('Bob'), g_screen: scr.call('Alice') },
                chips: {
                    h_app: [ [ 'closed source', 'mute' ] ],
                    h_lib: [ [ 'open source', 'enc' ] ],
                    h_vault: [ [ 'sealed off', 'key' ] ]
                }
            },
            {
                scene: 'meeting',
                title: 'The servers in the middle',
                focus: [ 'srv' ],
                plain: `
                    <p>Four server parts, all run by APE Space, sit between Alice and Bob:</p>
                    <ul>
                        <li><b>Web server</b>: hands out the meeting page and the app's files, like any website.</li>
                        <li><b>Prosody</b>, the <i>switchboard</i>: tells everyone who is in the room and passes setup messages between browsers. Every key-exchange message goes through it.</li>
                        <li><b>Jicofo</b>, the <i>focus</i>: organises the meeting and invites everyone to the video bridge.</li>
                        <li><b>JVB</b>, the <i>video bridge</i>: receives each person's audio and video once and forwards it to everyone else, like a sorting office.</li>
                    </ul>
                    <p>Because every message and every video frame passes through these servers, the question is simple: <b>what can they see?</b></p>`,
                hood: `
                    <ul>
                        <li>Signalling is XMPP over a WebSocket to Prosody, in a multi-user chat room (MUC). <i>Presence</i> stanzas announce each participant and carry their properties (display name, features, later the E2EE identity keys).</li>
                        <li>Jicofo allocates channels on the JVB and negotiates the media session with each browser (Jingle over XMPP).</li>
                        <li>The JVB is a <i>selective forwarding unit</i>: it forwards packets and doesn't mix them. APE Space switches off Jitsi's direct peer-to-peer mode for two-person calls (<code>p2p.enabled: false</code>), so media always goes through the bridge.</li>
                    </ul>`,
                inner: { h_screen: scr.call('Bob'), g_screen: scr.call('Alice') }
            }
        ]
    });

    // ================================================================ 2
    WT.chapters.push({
        id: 'join',
        title: 'Joining a meeting',
        steps: [
            {
                scene: 'meeting',
                title: 'Alice, the host, opens her meeting link',
                focus: [ 'h', 'web' ],
                plain: `
                    <p>Alice clicks her meeting link. It carries a short-lived <b>meeting token</b> that says who she is and that she is the host.</p>
                    <p>Her browser downloads the meeting page and the app's files from the web server. Later chapters show how anyone can check that these files are exactly the signed, published release.</p>`,
                hood: `
                    <ul>
                        <li>The token is a JWT bound to one room (<code>room</code> claim) that expires after an hour. A host (owner) token makes her a moderator and skips the pre-join screen.</li>
                        <li>The meeting page served for every room is the release's static <code>index.html</code>, byte for byte. It carries a Content Security Policy: only the release's own scripts can run.</li>
                        <li>Each server's <code>config.js</code> (addresses, feature flags) is not run in the page. <code>static/load-config.js</code> runs it in an isolated worker and takes back only plain settings. E2EE settings, such as the key source, are fixed in the release.</li>
                    </ul>`,
                flows: [
                    { e: 'h_app-web', rev: true, label: 'index.html', k: 'file', at: 0, dur: 1200 },
                    { e: 'h_app-web', rev: true, label: 'app.bundle.min.js', k: 'file', at: 900, dur: 1200 },
                    { e: 'h_app-web', rev: true, label: 'lib-jitsi-meet.min.js', k: 'file', at: 1800, dur: 1200 },
                    { e: 'h_app-web', rev: true, label: 'vault · worker · olm', k: 'file', at: 2700, dur: 1200 }
                ],
                chips: { h_app: [ [ '🎟️ host token', 'info' ] ] },
                inner: { h_screen: '<div class="scr"><span class="small">Loading the meeting…</span></div>' }
            },
            {
                scene: 'meeting',
                title: 'Bob joins as a guest',
                focus: [ 'g', 'web' ],
                plain: `
                    <p>Bob opens the invitation. He gets a <b>guest token</b> for the same room and types his name on the pre-join screen.</p>
                    <p>His browser downloads exactly the same files as Alice's. That's the point of a signed release: <b>everyone gets the same code</b>, so nobody can be singled out with a special version without it showing up (chapters 9 and 10).</p>`,
                hood: `
                    <ul>
                        <li>A meeting link has the form <code>…/meetings/join/&lt;meeting id&gt;</code>. The APE Space backend answers it with a join URL that carries a host token for the signed-in host, and a guest token for everyone else.</li>
                        <li>Guests see the pre-join screen and must enter a display name.</li>
                        <li>The browser extension (chapter 10) fingerprints every file a meeting loads, so it would notice a file served to one user that differs from the release.</li>
                    </ul>`,
                flows: [
                    { e: 'g_app-web', rev: true, label: 'index.html', k: 'file', at: 0, dur: 1200 },
                    { e: 'g_app-web', rev: true, label: 'app.bundle.min.js', k: 'file', at: 900, dur: 1200 },
                    { e: 'g_app-web', rev: true, label: 'lib-jitsi-meet.min.js', k: 'file', at: 1800, dur: 1200 },
                    { e: 'g_app-web', rev: true, label: 'vault · worker · olm', k: 'file', at: 2700, dur: 1200 }
                ],
                chips: { h_app: [ [ '🎟️ host token', 'info' ] ], g_app: [ [ '🎟️ guest token', 'info' ] ] },
                inner: {
                    g_screen: '<div class="scr"><span class="small">Pre-join: “Enter your name”</span><span><b>Bob</b> ▏</span></div>',
                    h_screen: '<div class="scr"><span class="small">Waiting for others…</span></div>'
                }
            },
            {
                scene: 'meeting',
                title: 'Checking in with the switchboard',
                focus: [ 'h_lib', 'g_lib', 'prosody' ],
                plain: `
                    <p>Each browser opens a live connection to <b>Prosody</b>, the switchboard, and shows its token. Prosody checks the token and lets each one into the room.</p>
                    <p>Then it tells everyone who is there: Alice learns that Bob joined, and Bob learns that Alice is the host. These announcements are called <b>presence</b>. Later they will also carry each person's public encryption keys.</p>`,
                hood: `
                    <ul>
                        <li>XMPP over WebSocket. Dev passes the token in the WebSocket URL query, so test tools never log full WebSocket URLs.</li>
                        <li>Presence carries the display name, client features (including <code>E2EE</code> support), and properties such as <code>e2ee.enabled</code>, <code>e2ee.idKey.ed25519</code> and <code>e2ee.idKey.curve25519</code>.</li>
                        <li>Prosody always sees names, join and leave times, the room name and text chat. Those are <b>not</b> end-to-end encrypted, which is one of the stated limits.</li>
                    </ul>`,
                flows: [
                    { e: 'h_lib-prosody', label: 'join + token', k: 'sig', at: 0, dur: 1100 },
                    { e: 'g_lib-prosody', label: 'join + token', k: 'sig', at: 300, dur: 1100 },
                    { e: 'h_lib-prosody', rev: true, label: 'Bob is here', k: 'sig', at: 1700, dur: 1100 },
                    { e: 'g_lib-prosody', rev: true, label: 'Alice is here', k: 'sig', at: 1900, dur: 1100 }
                ],
                chips: { prosody: [ [ '✓ tokens valid', 'ok', 1400 ] ] },
                inner: { h_screen: [ [ '<div class="scr"><span class="small">Joining…</span></div>', 0 ], [ '<div class="scr"><span class="small">Participants: <b>Alice</b> (host), <b>Bob</b></span></div>', 3000 ] ],
                    g_screen: [ [ '<div class="scr"><span class="small">Joining…</span></div>', 0 ], [ '<div class="scr"><span class="small">Participants: <b>Alice</b> (host), <b>Bob</b></span></div>', 3000 ] ] }
            },
            {
                scene: 'meeting',
                title: 'The focus invites everyone to the video bridge',
                focus: [ 'prosody', 'jicofo', 'jvb', 'h_lib', 'g_lib' ],
                plain: `
                    <p><b>Jicofo</b>, the focus, sees that the room has participants. It reserves space on the <b>video bridge</b> and sends each browser an invitation that says where the bridge is and how to talk to it.</p>`,
                hood: `
                    <ul>
                        <li>Jicofo allocates bridge channels for each endpoint, then sends a Jingle <code>session-initiate</code> through Prosody with the bridge's ICE candidates, DTLS certificate fingerprint and codecs. Each browser answers with <code>session-accept</code>.</li>
                        <li>With peer-to-peer mode off, even a two-person meeting goes through the bridge.</li>
                    </ul>`,
                flows: [
                    { e: 'prosody-jicofo', label: '2 participants', k: 'sig', at: 0, dur: 900 },
                    { e: 'jicofo-jvb', label: 'reserve channels', k: 'sig', at: 950, dur: 900 },
                    { e: 'prosody-jicofo', rev: true, label: 'session offer', k: 'sig', at: 1950, dur: 900 },
                    { e: 'h_lib-prosody', rev: true, label: 'session offer', k: 'sig', at: 2900, dur: 1000 },
                    { e: 'g_lib-prosody', rev: true, label: 'session offer', k: 'sig', at: 2900, dur: 1000 },
                    { e: 'h_lib-prosody', label: 'accept', k: 'sig', at: 4100, dur: 1000 },
                    { e: 'g_lib-prosody', label: 'accept', k: 'sig', at: 4100, dur: 1000 }
                ]
            },
            {
                scene: 'meeting',
                title: 'A locked link to the bridge',
                focus: [ 'h_rtc', 'g_rtc', 'jvb' ],
                plain: `
                    <p>Each browser now connects straight to the video bridge and the two sides agree on a key for the link, much like a website's <i>https</i> padlock.</p>
                    <p>Keep one detail in mind: <b>the bridge is one end of each link.</b> Alice's link ends at the bridge, and Bob's link starts there. The next chapter shows why that matters.</p>`,
                hood: `
                    <ul>
                        <li>ICE finds a network path. A DTLS handshake between the browser and the JVB derives SRTP keys for that leg (DTLS-SRTP).</li>
                        <li>The JVB holds the SRTP keys of every leg. That's needed to forward media: it rewrites RTP headers and picks simulcast layers.</li>
                    </ul>`,
                flows: [
                    { e: 'h_rtc-jvb', label: 'handshake', k: 'hop', at: 0, dur: 1000 },
                    { e: 'g_rtc-jvb', label: 'handshake', k: 'hop', at: 200, dur: 1000 },
                    { e: 'h_rtc-jvb', rev: true, label: 'link key agreed', k: 'hop', at: 1300, dur: 1000 },
                    { e: 'g_rtc-jvb', rev: true, label: 'link key agreed', k: 'hop', at: 1500, dur: 1000 }
                ],
                chips: { jvb: [ [ '🔑 holds both link keys', 'warn', 2600 ] ] }
            }
        ]
    });

    // ================================================================ 3
    WT.chapters.push({
        id: 'no-e2ee',
        title: 'A meeting without E2EE',
        steps: [
            {
                scene: 'meeting',
                title: 'Alice’s video travels to the bridge',
                focus: [ 'h_cam', 'h_app', 'h_rtc', 'jvb' ],
                plain: `
                    <p>Alice's camera image goes to the app, then to WebRTC, which compresses it into video. WebRTC locks it with the <b>link key</b> and sends it to the bridge.</p>
                    <p>On the wire it is protected: someone on the café Wi-Fi sees only scrambled data. But this lock is between Alice and the <b>bridge</b>, not between Alice and Bob.</p>`,
                hood: `
                    <ul>
                        <li>Typical codecs: VP8/VP9/AV1 or H.264 for video, Opus for audio. They're encoded by the browser and sent as RTP.</li>
                        <li>The RTP payload is encrypted and authenticated with SRTP, using keys from the DTLS handshake with the JVB.</li>
                    </ul>`,
                flows: media('h', false).slice(0, 3)
            },
            {
                scene: 'meeting',
                title: 'The bridge unlocks it, then locks it again',
                focus: [ 'jvb', 'g_rtc', 'g_screen', 'h_rtc' ],
                plain: `
                    <p>At the bridge, the link lock comes off: <b>the video is readable inside the bridge</b>. The bridge then locks it again with Bob's link key and sends it on.</p>
                    <p>This is called <i>hop-by-hop</i> encryption. It's like a courier who opens each envelope and puts the letter in a new one. In principle, whoever runs the bridge could watch, record or transcribe the meeting. Server recording, transcription and the AI recorder all work this way.</p>`,
                hood: `
                    <ul>
                        <li>An SFU has to decrypt SRTP to forward packets. It then re-encrypts with the receiving leg's SRTP keys.</li>
                        <li>Server-side bots (Jibri for recording and streaming, Jigasi for transcription) join as hidden participants and receive this readable media.</li>
                        <li>The APE Space AI recorder sends plain microphone audio to a backend.</li>
                    </ul>`,
                flows: media('h', false),
                state: { jvb: [ 'warn', 2700 ] },
                inner: { jvb: [ [ '<span class="lbl warn" style="display:inline-block;font-weight:700;color:var(--warn)">👁️ readable here</span>', 2700 ] ], g_screen: [ [ scr.call('Alice'), 4900 ] ] }
            },
            {
                scene: 'meeting',
                title: 'What the servers can see without E2EE',
                plain: `
                    <p>Without E2EE, the servers can see a lot:</p>
                    <table>
                        <tr><th>Server</th><th>What it handles</th></tr>
                        <tr><td>Prosody (switchboard)</td><td>Names, who joins and when, chat messages, the room name</td></tr>
                        <tr><td>JVB (video bridge)</td><td><span class="badc">Readable audio and video</span></td></tr>
                    </table>
                    <p>End-to-end encryption adds a <b>second lock</b> that is made and opened only in the participants' browsers. The bridge still forwards the media, but it can no longer read it.</p>`,
                hood: `
                    <p>With E2EE on, names, presence, chat and the room name still pass through Prosody unencrypted end to end. The promise covers <b>audio, video and screen sharing</b>. The explainer's limits table says this explicitly.</p>`,
                flows: [ ...media('h', false), ...media('g', false, 900) ],
                state: { jvb: 'warn', prosody: 'warn' },
                chips: { prosody: [ [ 'names · chat · who joins', 'warn' ] ], jvb: [ [ 'readable media', 'plain' ] ] },
                inner: { h_screen: scr.call('Bob'), g_screen: scr.call('Alice') }
            }
        ]
    });

    // ================================================================ 4
    WT.chapters.push({
        id: 'e2ee',
        title: 'Turning on E2EE',
        steps: [
            {
                scene: 'meeting',
                title: 'Alice switches end-to-end encryption on',
                focus: [ 'h_screen', 'h_lib', 'prosody', 'g_lib', 'h_cam', 'g_cam' ],
                plain: `
                    <p>Alice opens <b>Security options</b> (the shield icon) and turns on <b>End-to-End Encryption</b>. The setting reaches everyone through the switchboard.</p>
                    <p>Right away, <b>everyone's camera and microphone pause</b>. Nothing is sent until encryption is ready. If it can't be ready within 30 seconds, media stays paused rather than going out unencrypted. This is called <i>failing closed</i>.</p>`,
                hood: `
                    <ul>
                        <li>The moderator's choice is shared as the presence property <code>e2ee.enabled</code>. Every client follows an “on”. An “off” is followed only when it comes from a moderator, and then every participant gets a warning that stays on screen.</li>
                        <li>A browser or app that can't encrypt leaves an encrypted meeting at once and says why, so its media never reaches the servers unencrypted.</li>
                        <li>Until the encryption transforms are in place, local tracks send only silence and black frames. After 30 s without encryption, media stays paused and the user is told.</li>
                        <li>Features that need readable media are switched off: the AI recorder (stopped and hidden), server recording, live streaming and transcription. Local recording stays available, because it never leaves the participant's browser.</li>
                    </ul>`,
                flows: [
                    { e: 'h_lib-prosody', label: 'E2EE: on', k: 'sig', at: 0, dur: 1100 },
                    { e: 'g_lib-prosody', rev: true, label: 'E2EE: on', k: 'sig', at: 1200, dur: 1100 }
                ],
                state: { h_cam: [ 'off', 600 ], g_cam: [ 'off', 2400 ] },
                chips: { h_cam: [ [ '⏸ paused', 'mute', 600 ] ], g_cam: [ [ '⏸ paused', 'mute', 2400 ] ] },
                inner: {
                    h_screen: [ [ '<div class="scr"><span class="small">Security options</span><span><b>End-to-End Encryption</b> <span class="lbl ok">ON</span></span></div>', 0 ], [ scr.paused(), 1200 ] ],
                    g_screen: [ [ scr.call('Alice'), 0 ], [ scr.paused(), 2400 ] ]
                }
            },
            {
                scene: 'meeting',
                title: 'Each key vault creates an identity',
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody' ],
                plain: `
                    <p>Each key vault creates its own pair of <b>identity keys</b>. Think of the public half as a <b>name badge</b> anyone can see, and the private half as the <b>signature</b> only that vault can make. The private halves never leave the vault.</p>
                    <ul>
                        <li>A <b>signing key</b> proves “this message really came from Alice's vault”.</li>
                        <li>An <b>agreement key</b> is used to set up private channels with other vaults.</li>
                    </ul>
                    <p>Each browser publishes its badge through the switchboard so that everyone can see it.</p>`,
                hood: `
                    <ul>
                        <li>The vault creates an Olm account (<code>@matrix-org/olm</code> 3.2.15, the library behind Matrix/Element). <code>identity_keys()</code> returns an <b>Ed25519</b> signing key and a <b>Curve25519</b> Diffie-Hellman key.</li>
                        <li>They are published as presence properties <code>e2ee.idKey.ed25519</code> and <code>e2ee.idKey.curve25519</code>.</li>
                        <li>The vault returns only the public identity keys to the page. The Olm account never leaves the sandboxed frame.</li>
                    </ul>`,
                flows: [
                    { e: 'h_lib-h_vault', rev: true, label: 'public badge', k: 'sig', at: 0, dur: 450 },
                    { e: 'g_lib-g_vault', rev: true, label: 'public badge', k: 'sig', at: 0, dur: 450 },
                    { e: 'h_lib-prosody', label: 'Alice’s badge', k: 'sig', at: 500, dur: 1000 },
                    { e: 'g_lib-prosody', label: 'Bob’s badge', k: 'sig', at: 500, dur: 1000 },
                    { e: 'g_lib-prosody', rev: true, label: 'Alice’s badge', k: 'sig', at: 1600, dur: 1000 },
                    { e: 'h_lib-prosody', rev: true, label: 'Bob’s badge', k: 'sig', at: 1600, dur: 1000 }
                ],
                chips: {
                    h_vault: [ [ '🔑 private keys', 'key' ] ],
                    g_vault: [ [ '🔑 private keys', 'key' ] ],
                    prosody: [ [ 'sees only public badges', 'info', 1500 ] ]
                },
                inner: { h_screen: scr.paused(), g_screen: scr.paused() }
            },
            {
                scene: 'meeting',
                title: 'Opening a sealed channel between the vaults',
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody' ],
                plain: `
                    <p>Next, Alice's vault invites Bob's vault to open a <b>sealed channel</b>, a private tube only the two vaults can open. The invitation is <b>signed</b> with Alice's signing key.</p>
                    <p>Bob's vault checks the signature against the badge Alice published. If it matches, Bob's vault accepts and replies. The switchboard carries these messages but <b>can't open the channel</b>, and it can't forge Alice's signature.</p>`,
                hood: `
                    <ul>
                        <li><code>session-init</code> carries Alice's Curve25519 identity key, a fresh one-time key (<code>otKey</code>), and an <b>Ed25519 signature</b> over them. The signature is the upstream fix 4a958bc1 (<code>olm-key-auth.patch</code>). The pre-fix library had none, which let a server swap these keys unnoticed (chapter 7).</li>
                        <li>Bob verifies the signature with Alice's published <code>e2ee.idKey.ed25519</code>, then calls <code>create_outbound(idKey, otKey)</code>. His <code>session-ack</code> is itself signed and carries an Olm pre-key message, and Alice builds her side with <code>create_inbound_from</code>.</li>
                        <li>Olm is a Double Ratchet protocol, the same design as Signal's. Every message gets a fresh key.</li>
                        <li>The library refuses to open a channel with a <b>hidden</b> participant in either direction (<code>hidden-key-recipients.patch</code>).</li>
                    </ul>`,
                flows: [
                    ...relay('h', 'session-init ✍️', 'sig'),
                    ...relay('g', 'session-ack ✍️', 'sig', 3500)
                ],
                chips: {
                    g_vault: [ [ '✓ signed by Alice', 'ok', 3000 ] ],
                    h_vault: [ [ '✓ signed by Bob', 'ok', 6500 ] ]
                },
                notes: [
                    { x: 20, y: 620, w: 400, at: 6600, k: 'ok', html: '<b>Sealed channel open.</b> Alice’s and Bob’s vaults now share a private channel. The switchboard carried every message but holds no key to it.' }
                ],
                inner: { h_screen: scr.paused(), g_screen: scr.paused() }
            },
            {
                scene: 'meeting',
                title: 'Sharing the media keys',
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody' ],
                plain: `
                    <p>Each vault now creates a random <b>media key</b>, the key that will actually lock that person's audio and video. It puts the key <b>inside the sealed channel</b> and sends it to every other participant.</p>
                    <p>The switchboard passes the sealed message along but sees only scrambled data. When it's done, Bob holds Alice's media key and Alice holds Bob's. <b>No server ever holds either.</b></p>`,
                hood: `
                    <ul>
                        <li>The media key is 32 random bytes from <code>crypto.getRandomValues</code>, generated inside the vault.</li>
                        <li>It is sent as <code>key-info</code>, an Olm-encrypted payload <code>{ key, keyIndex }</code>, and acknowledged with <code>key-info-ack</code>.</li>
                        <li>The library reports who holds your key (<code>E2EE_KEY_RECIPIENTS_CHANGED</code>). The lock label shows “Your audio and video can be decrypted only by: Bob”. If the key ever reaches someone not in the participant list, the label turns red.</li>
                    </ul>`,
                flows: [
                    ...relay('h', 'key-info', 'key'),
                    ...relay('g', 'key-info', 'key', 3300)
                ],
                chips: {
                    h_vault: [ [ '🗝️ own key', 'key' ], [ '🗝️ Bob’s', 'key', 6300 ] ],
                    g_vault: [ [ '🗝️ own key', 'key' ], [ '🗝️ Alice’s', 'key', 3000 ] ],
                    prosody: [ [ 'sees only sealed data', 'info', 1400 ] ]
                },
                inner: {
                    h_screen: [ [ scr.paused(), 0 ], [ '<div class="scr"><span class="small">Your audio and video can be decrypted only by:</span><b>Bob</b></div>', 3000 ] ],
                    g_screen: [ [ scr.paused(), 0 ], [ '<div class="scr"><span class="small">Your audio and video can be decrypted only by:</span><b>Alice</b></div>', 6300 ] ]
                }
            },
            {
                scene: 'meeting',
                title: 'Keys go straight from the vault to the worker',
                focus: [ 'h_vault', 'h_worker', 'h_app', 'g_vault', 'g_worker', 'g_app' ],
                plain: `
                    <p>The vault hands the media keys <b>directly</b> to the worker that will lock and unlock the frames, through a private pipe. The APE Space app, which runs the rest of the page, is not in that path.</p>
                    <p>If the app tries to look into the vault, the browser itself blocks it. If the app tries to give the worker a different key, the worker ignores it.</p>`,
                hood: `
                    <ul>
                        <li>The vault is an <code>iframe</code> with <code>sandbox="allow-scripts"</code>, so it has an opaque origin. Reaching into it from the page throws <code>SecurityError</code>.</li>
                        <li>Media keys travel from the vault to the worker over a <code>MessageChannel</code>. The page transfers both ports without keeping them. Once the worker has its vault channel, it ignores <code>setKey</code> from the page.</li>
                        <li>Sandbox test: the page held no media key and no Olm account or session. The worker got 0 keys from the page, and a key the page tried to set was ignored.</li>
                        <li>Limit: the page still shows the decrypted video, and a deliberately malicious build could hook browser APIs. Nothing inside a browser can stop that. The answer is signed, identical releases, the Inspector and an independent audit (chapter 11).</li>
                    </ul>`,
                flows: [
                    { e: 'h_vault-h_worker', label: 'media keys', k: 'key', at: 0, dur: 1100 },
                    { e: 'g_vault-g_worker', label: 'media keys', k: 'key', at: 300, dur: 1100 }
                ],
                chips: {
                    h_app: [ [ '⛔ can’t reach the vault', 'bad' ] ],
                    g_app: [ [ '⛔ can’t reach the vault', 'bad' ] ],
                    h_worker: [ [ '🗝️ keys ready', 'key', 1100 ] ],
                    g_worker: [ [ '🗝️ keys ready', 'key', 1400 ] ]
                },
                inner: { h_screen: scr.paused(), g_screen: scr.paused() }
            },
            {
                scene: 'meeting',
                title: 'Encrypted media flows',
                plain: `
                    <p>Cameras resume. Each frame of Alice's video is now <b>locked in Alice's browser</b> by her worker, before it leaves. It still gets the normal link lock on top, so there are two locks.</p>
                    <p>The bridge removes the link lock as before, but underneath it finds <b>only scrambled data</b>. It forwards that to Bob, whose worker holds Alice's key and unlocks it. A green lock label tells everyone the meeting is end-to-end encrypted.</p>`,
                hood: `
                    <ul>
                        <li>Frame cipher: <b>AES-GCM-128</b> with a key derived by HKDF-SHA-256 (salt <code>JFrameEncryptionKey</code>) from the 32-byte media key.</li>
                        <li>Frame layout: <code>header | ciphertext | IV(12) | IV length | key index</code>. The first 10 bytes of a video keyframe, 3 of a delta frame and 1 of audio stay readable so the bridge can still route. They are authenticated as AES-GCM additional data, so they can't be altered.</li>
                        <li>A wrong key fails AES-GCM authentication, so no key can produce “plausible” media.</li>
                        <li>The IV holds the stream ID, the RTP timestamp and a 32-bit frame counter that starts at a random value, so no IV repeats under one key. The receiver plays each counter once, within a window of 1,024 frames, so a server can't replay earlier frames (<code>frame-counter-replay.patch</code>).</li>
                        <li>Encrypted video is always VP8, the codec this layout is defined for (<code>vp8-on-reenable.patch</code>).</li>
                        <li>The same applies to audio and screen sharing.</li>
                    </ul>`,
                flows: [ ...media('h', true), ...media('g', true, 1200) ],
                state: { jvb: 'ok' },
                chips: { jvb: [ [ 'sees only scrambled frames', 'enc' ] ] },
                inner: {
                    h_screen: [ [ scr.paused(), 0 ], [ scr.e2ee('Bob'), 7650 ] ],
                    g_screen: [ [ scr.paused(), 0 ], [ scr.e2ee('Alice'), 6450 ] ]
                }
            },
            {
                scene: 'meeting',
                title: 'When people join or leave',
                show: [ 'carol' ],
                focus: [ 'h_vault', 'g_vault', 'carol', 'prosody', 'h_lib', 'g_lib' ],
                plain: `
                    <p><b>Carol joins.</b> Every vault moves its media key one step forward with a one-way function before sharing it with Carol. She can decrypt from now on, but <b>not anything said before she arrived</b>.</p>
                    <p><b>When someone leaves</b>, every remaining vault creates a <b>brand-new random key</b> about five seconds later and sends it only to the people still there. From then on, whoever left can't listen in, even if they kept recording the scrambled traffic.</p>`,
                hood: `
                    <ul>
                        <li>Join: before a participant's current key first goes to a newcomer, it is <i>ratcheted</i> with HKDF-SHA-256 (salt <code>JFrameRatchetKey</code>) and the participant's own media switches to the new key (<code>newcomer-key-ratchet.patch</code>). The newcomer gets a sealed channel and <code>key-info</code> with a key that has encrypted nothing from before they joined. Earlier keys can't be derived from it.</li>
                        <li>Leave: the key is <i>rotated</i>, a new random key distributed to the remaining participants. Rotation runs 5 s after the departure, so that several departures cause one change. Until it runs, the old key still works.</li>
                        <li>Any group safety number shown before is marked “participants changed, compare again” (chapter 6).</li>
                    </ul>`,
                flows: [
                    { e: 'carol-prosody', label: 'joins', k: 'sig', at: 0, dur: 1100 },
                    { e: 'h_lib-prosody', label: 'key-info (ratcheted)', k: 'key', at: 1600, dur: 1000 },
                    { e: 'carol-prosody', rev: true, label: 'key-info', k: 'key', at: 2700, dur: 1100 },
                    { e: 'g_lib-prosody', label: 'key-info (ratcheted)', k: 'key', at: 1900, dur: 1000 },
                    { e: 'carol-prosody', rev: true, label: 'key-info', k: 'key', at: 3000, dur: 1100 }
                ],
                chips: {
                    h_vault: [ [ '⟳ key moved forward', 'key', 1200 ] ],
                    g_vault: [ [ '⟳ key moved forward', 'key', 1200 ] ],
                    carol: [ [ 'can’t read the past', 'ok', 4200 ] ]
                },
                inner: { h_screen: scr.e2ee('Bob, Carol'), g_screen: scr.e2ee('Alice, Carol') }
            }
        ]
    });

    // ================================================================ 5
    WT.chapters.push({
        id: 'emoji',
        title: 'Emoji verification',
        steps: [
            {
                scene: 'meeting',
                title: 'Why verify at all?',
                focus: [ 'h_vault', 'g_vault', 'prosody' ],
                plain: `
                    <p>Everything so far rests on one assumption: <b>the badge Bob's vault received really is Alice's.</b> The badges travel through the switchboard, which APE Space runs.</p>
                    <p>A dishonest server could try to hand out fake badges to everyone and quietly sit in the middle (chapter 7 tries exactly that). The defence is simple and human: Alice and Bob compare a few emoji, by voice or on camera. If their vaults see the same keys, the emoji match.</p>`,
                hood: `
                    <p>This is the limit of every end-to-end encrypted system without an outside identity source, Signal and WhatsApp included. A server that forges <i>every</i> identity can only be caught by a human comparing something derived from the keys. APE Space makes that comparison show a red warning even when people don't look closely (step 4).</p>`,
                chips: { prosody: [ [ 'delivers the badges', 'warn' ] ] },
                inner: { h_screen: scr.e2ee('Bob'), g_screen: scr.e2ee('Alice') }
            },
            {
                scene: 'meeting',
                title: 'Short-lived keys for the check',
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody' ],
                plain: `
                    <p>Alice opens Bob's menu and chooses <b>Verify participant</b>. Their vaults each create a <b>short-lived key pair</b> just for this check, and swap the public halves.</p>
                    <p>Bob's vault first sends a <b>sealed commitment</b> to its key: a fingerprint that fixes the key without revealing it. Neither side, and no one in between, can change their key after seeing the other's.</p>`,
                hood: `
                    <ul>
                        <li>Olm SAS (short authentication string), the same scheme as Matrix: <code>sas-start</code> → <code>sas-accept</code> (Bob's commitment, a hash of his ephemeral key and the start message) → <code>sas-key</code> both ways (ephemeral Curve25519 public keys) → the commitment is checked.</li>
                        <li>Both sides compute an ECDH shared secret. Someone in the middle would hold two different secrets.</li>
                        <li>Fresh short-lived keys keep the check independent of the long-term keys it is about to confirm.</li>
                    </ul>`,
                flows: [
                    ...relay('h', 'sas-start', 'sas'),
                    ...relay('g', 'sas-accept (commitment)', 'sas', 3100),
                    ...relay('h', 'sas-key', 'sas', 6200),
                    ...relay('g', 'sas-key', 'sas', 6600)
                ],
                chips: {
                    h_vault: [ [ '⏱ short-lived key', 'key' ] ],
                    g_vault: [ [ '⏱ short-lived key', 'key', 2900 ] ]
                },
                inner: { h_screen: '<div class="scr"><span class="small">Verify participant: <b>Bob</b></span><span class="small">Waiting for Bob…</span></div>', g_screen: '<div class="scr"><span class="small"><b>Alice</b> wants to verify you</span></div>' }
            },
            {
                scene: 'meeting',
                title: 'Comparing the emoji',
                focus: [ 'h_screen', 'g_screen', 'h_vault', 'g_vault' ],
                plain: `
                    <p>Both vaults turn their shared secret into <b>seven emoji</b>. Alice and Bob read them to each other.</p>
                    <p>If someone were in the middle, each side would have a different secret and <b>different emoji</b>. Here they match, so both press <b>“They match”</b>.</p>`,
                hood: `
                    <ul>
                        <li>6 bytes of the SAS output (<code>OLM_SAS_NUM_BYTES = 6</code>) give 7 emoji of 6 bits each from a 64-emoji table.</li>
                        <li>Real output from the attack kit's honest run on dev: ☁️ cloud, 🎺 trumpet, 🐶 dog, 🚩 flag, 😀 smiley, 🔒 lock, 🌍 globe, the same on both sides.</li>
                    </ul>`,
                inner: {
                    h_screen: scr.emoji(EMOJI, '<span class="small">[ They match ] [ They don’t match ]</span>'),
                    g_screen: scr.emoji(EMOJI, '<span class="small">[ They match ] [ They don’t match ]</span>')
                },
                notes: [ { x: 380, y: 620, w: 440, k: 'info', html: '🗣️ “Cloud, trumpet, dog, flag, smiley, lock, globe.” — “Same here!”' } ]
            },
            {
                scene: 'meeting',
                title: 'The automatic final check',
                focus: [ 'h_vault', 'g_vault', 'h_lib', 'g_lib', 'prosody', 'h_screen', 'g_screen' ],
                plain: `
                    <p>After both press “They match”, the vaults run one more check automatically. Each vault sends a <b>seal of its own identity keys</b>, made with the shared secret. The other vault compares it with the badge it has been using for that person.</p>
                    <p>Both pass, so each sees <b>“Verified”</b>: <i>“Your emoji matched and their encryption keys were confirmed. No one is intercepting the encryption between you.”</i></p>`,
                hood: `
                    <ul>
                        <li><code>sas-mac</code> carries MACs keyed by the SAS secret (info <code>Jitsi-KEY_VERIFICATION_MAC</code>) over the sender's Ed25519 <b>and Curve25519</b> identity keys, plus a MAC over the key IDs (<code>Jitsi-KEY_IDS</code>).</li>
                        <li>The receiver checks them against the keys its Olm session was built on. Adding Curve25519 to the MAC is part of the upstream fix. It is what catches the strongest attack in chapter 7, even when the emoji match.</li>
                    </ul>`,
                flows: [
                    ...relay('h', 'sas-mac', 'sas'),
                    ...relay('g', 'sas-mac', 'sas', 300)
                ],
                chips: {
                    h_vault: [ [ '✓ Bob’s keys confirmed', 'ok', 3300 ] ],
                    g_vault: [ [ '✓ Alice’s keys confirmed', 'ok', 3000 ] ]
                },
                inner: {
                    h_screen: [ [ scr.emoji(EMOJI, '<span class="lbl ok">They match ✓</span>'), 0 ], [ scr.verified('Bob'), 3400 ] ],
                    g_screen: [ [ scr.emoji(EMOJI, '<span class="lbl ok">They match ✓</span>'), 0 ], [ scr.verified('Alice'), 3100 ] ]
                }
            },
            {
                scene: 'meeting',
                title: 'When verification fails',
                focus: [ 'h_screen', 'g_screen', 'h_vault', 'g_vault' ],
                plain: `
                    <p>If the emoji differ, or the automatic check fails, the lock label <b>turns red and names the participant</b>, and a warning stays on screen. There are two versions:</p>
                    <ul>
                        <li><i>“The emoji you compared with Bob did not match…”</i></li>
                        <li><i>“The emoji matched, but Bob's encryption keys could not be confirmed…”</i></li>
                    </ul>
                    <p>Both end with the same advice: <b>don't share anything sensitive</b>, and leave if you can't explain it.</p>`,
                hood: `
                    <p>The UI strings are <code>e2ee.verificationEmojiMismatch</code> and <code>e2ee.verificationKeysMismatch</code>. Answering “They don't match” also raises the warning, which the kit checks with <code>--answer no</code>.</p>`,
                state: { h_screen: 'bad', g_screen: 'bad' },
                inner: {
                    h_screen: scr.failed('Bob', 'Someone may be intercepting this meeting’s encryption. Don’t share anything sensitive.'),
                    g_screen: scr.failed('Alice', 'Someone may be intercepting this meeting’s encryption. Don’t share anything sensitive.')
                }
            }
        ]
    });

    // ================================================================ 6
    const NUM = '2930 0312 4695';

    WT.chapters.push({
        id: 'group',
        title: 'The group safety number',
        steps: [
            {
                scene: 'meeting',
                title: 'One number instead of many pairs',
                show: [ 'carol' ],
                plain: `
                    <p>Emoji work for two people, but pairs add up quickly. With 6 people there are <b>15 pairs</b> to compare.</p>
                    <p>The <b>group safety number</b> replaces all of them with <b>one 12-digit number</b> for the whole meeting. One person reads it aloud, and everyone checks that theirs is the same. The host starts it from Security options → <b>Compare safety number with everyone</b>.</p>
                    <p>It confirms two things at once: <b>nobody is in the middle</b>, and <b>nobody extra is listening</b>.</p>`,
                hood: `
                    <p>The protocol is APE Space's public patch <code>group-safety-number.patch</code> (new file <code>modules/e2ee/GroupVerification.js</code>). It runs inside the key vault, and its messages travel over the same per-participant signalling as the Olm messages. The number covers exactly the participants this browser shares its media key with, and the dialog names them.</p>`,
                inner: { h_screen: scr.e2ee('Bob, Carol'), g_screen: scr.e2ee('Alice, Carol') },
                notes: [ { x: 20, y: 620, w: 400, k: 'info', html: 'Pairs to compare: <b>n(n−1)/2</b> — 3 people: 3 · 6 people: 15 · 10 people: 45. Group number: <b>always 1</b>.' } ]
            },
            {
                scene: 'meeting',
                title: 'Round 1: sealed commitments',
                show: [ 'carol' ],
                focus: [ 'h_vault', 'g_vault', 'carol', 'prosody', 'h_lib', 'g_lib' ],
                plain: `
                    <p>Each vault draws a <b>random value</b>. It doesn't send the value yet. It sends everyone a <b>commitment</b>: a fingerprint of its identity keys together with the random value.</p>
                    <p>A commitment is like a sealed envelope on the table: it fixes the value now and opens later.</p>`,
                hood: `
                    <ul>
                        <li><code>group-sas-commit</code> = SHA-256(<code>"apespace-group-sas-commit-v1"</code>, round ID, participant ID, <code>ed25519|curve25519|nonce</code>). The nonce is 32 random bytes.</li>
                        <li>It is sent to each key recipient. A round times out after 30 s, and a participant on an older build shows as “didn't respond”.</li>
                    </ul>`,
                flows: [
                    { e: 'h_lib-prosody', label: '✉ commit', k: 'sas', at: 0, dur: 1000 },
                    { e: 'g_lib-prosody', label: '✉ commit', k: 'sas', at: 100, dur: 1000 },
                    { e: 'carol-prosody', label: '✉ commit', k: 'sas', at: 200, dur: 1100 },
                    { e: 'g_lib-prosody', rev: true, label: '✉ commits', k: 'sas', at: 1400, dur: 1000 },
                    { e: 'h_lib-prosody', rev: true, label: '✉ commits', k: 'sas', at: 1400, dur: 1000 },
                    { e: 'carol-prosody', rev: true, label: '✉ commits', k: 'sas', at: 1400, dur: 1100 }
                ],
                chips: {
                    h_vault: [ [ '🎲 random value', 'key' ] ],
                    g_vault: [ [ '🎲 random value', 'key' ] ],
                    carol: [ [ '🎲 random value', 'key' ] ]
                },
                inner: { h_screen: '<div class="scr"><span class="small">Comparing safety number…</span></div>', g_screen: '<div class="scr"><span class="small">Comparing safety number…</span></div>' }
            },
            {
                scene: 'meeting',
                title: 'Round 2: reveal and check',
                show: [ 'carol' ],
                focus: [ 'h_vault', 'g_vault', 'carol', 'prosody', 'h_lib', 'g_lib' ],
                plain: `
                    <p>Only once a vault holds <b>everyone's</b> commitments does it reveal its random value. Each vault then checks every revealed value against that person's commitment, <b>using the badge it holds for that person</b>.</p>
                    <p>A server that showed someone a fake badge is now stuck. It had to commit before it saw anyone's real value, so it can't adjust afterwards.</p>`,
                hood: `
                    <p><code>group-sas-reveal</code> carries the nonce. The receiver recomputes the commitment with <i>its own view</i> of the sender's identity keys. A forged identity either fails this check or changes the final number.</p>`,
                flows: [
                    { e: 'h_lib-prosody', label: '📭 reveal', k: 'sas', at: 0, dur: 1000 },
                    { e: 'g_lib-prosody', label: '📭 reveal', k: 'sas', at: 100, dur: 1000 },
                    { e: 'carol-prosody', label: '📭 reveal', k: 'sas', at: 200, dur: 1100 },
                    { e: 'g_lib-prosody', rev: true, label: '📭 reveals', k: 'sas', at: 1400, dur: 1000 },
                    { e: 'h_lib-prosody', rev: true, label: '📭 reveals', k: 'sas', at: 1400, dur: 1000 },
                    { e: 'carol-prosody', rev: true, label: '📭 reveals', k: 'sas', at: 1400, dur: 1100 }
                ],
                chips: {
                    h_vault: [ [ '✓ reveals match commits', 'ok', 2500 ] ],
                    g_vault: [ [ '✓ reveals match commits', 'ok', 2500 ] ],
                    carol: [ [ '✓ reveals match commits', 'ok', 2600 ] ]
                },
                inner: { h_screen: '<div class="scr"><span class="small">Comparing safety number…</span></div>', g_screen: '<div class="scr"><span class="small">Comparing safety number…</span></div>' }
            },
            {
                scene: 'meeting',
                title: 'Everyone reads the same number',
                show: [ 'carol' ],
                focus: [ 'h_screen', 'g_screen', 'carol' ],
                plain: `
                    <p>Each vault computes the number from <b>everyone's keys and random values</b>. If everyone saw the same keys, everyone gets the same number.</p>
                    <p>Alice reads hers aloud: <b>“2930 0312 4695.”</b> Bob and Carol see the same and answer <b>“Everyone sees the same number”</b>. One comparison, done.</p>`,
                hood: `
                    <ul>
                        <li>Number = the first 40 bits of SHA-256(<code>"apespace-group-sas-v1"</code>, round ID, every participant's <code>ed25519|curve25519|nonce</code> sorted), shown as 12 digits in groups of four.</li>
                        <li>The number shown is the real output of the kit's three-person honest run on dev: 2930 0312 4695 for all three.</li>
                        <li>A server would have to guess a 12-digit match: 1 chance in 10¹².</li>
                    </ul>`,
                inner: {
                    h_screen: scr.num(NUM, '<span class="small">Alice · Bob · Carol</span>'),
                    g_screen: scr.num(NUM, '<span class="small">Alice · Bob · Carol</span>')
                },
                chips: { carol: [ [ `🔢 ${NUM}`, 'ok' ] ] },
                state: { h_screen: 'ok', g_screen: 'ok', carol: 'ok' }
            },
            {
                scene: 'meeting',
                title: 'When people change, or a number differs',
                show: [ 'carol' ],
                focus: [ 'h_screen', 'g_screen', 'carol' ],
                plain: `
                    <ul>
                        <li><b>Someone joins or leaves</b> after the comparison: the number is marked <i>“participants changed, compare again”</i>.</li>
                        <li><b>Someone sees a different number</b> and says so: their label turns red, and <b>every other participant is told</b> who saw a different number.</li>
                    </ul>
                    <p>People still have to compare the number. The app can't force anyone to read it aloud. The attack in chapter 7 shows what a forged meeting looks like: the numbers simply don't match.</p>`,
                hood: `
                    <p>A mismatch report is sent as <code>group-sas-mismatch</code>. Events: <code>GROUP_VERIFICATION_READY</code>, <code>…_OUTDATED</code>, <code>…_FAILED</code>, <code>…_REPORTED</code>. Sandbox test: three participants confirm, a fourth joins, and the number is marked outdated for all three. In a new round of four, one answers “Someone sees a different number”: their label turns red and the other three are warned with their name.</p>`,
                inner: {
                    h_screen: [ [ scr.num(NUM, '<span class="lbl warn">Participants changed: compare again</span>'), 0 ], [ scr.num('…', '<span class="lbl bad">⚠ Carol sees a different number</span>'), 3500 ] ],
                    g_screen: [ [ scr.num(NUM, '<span class="lbl warn">Participants changed: compare again</span>'), 0 ], [ scr.num('…', '<span class="lbl bad">⚠ Carol sees a different number</span>'), 3500 ] ]
                },
                state: { carol: [ 'bad', 3500 ], h_screen: [ 'warn', 0 ], g_screen: [ 'warn', 0 ] },
                chips: { carol: [ [ '“Someone sees a different number”', 'bad', 3000 ] ] },
                cycle: 7000
            }
        ]
    });
})();
