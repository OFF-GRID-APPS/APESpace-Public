// Scene layouts. Every scene is drawn on a 1200 x 700 canvas.
//
// Node:  { id, x, y, w, h, label, sub, icon, tone, kind: 'zone' | 'box' | 'tag', optional }
//        optional nodes are hidden unless a step lists them in `show`.
// Edge:  { id, a, b, kind, label, as, bs, ax, ay, bx, by, pts }
//        a/b are node ids. as/bs force the side ('l','r','t','b'); ax/ay/bx/by pin
//        the anchor coordinate on that side. pts overrides the whole route.
//        Packets travel from a to b (or b to a with rev: true).
window.WT = window.WT || {};

(function () {
    // One participant's browser, placed with its left edge at x0.
    function browser(p, x0, name, role) {
        const dx = x0 - 20;
        const X = v => v + dx;

        return [
            { id: p, kind: 'zone', x: X(20), y: 20, w: 340, h: 590, label: `${name}'s browser`, sub: role, icon: '💻' },
            { id: `${p}_cam`, x: X(40), y: 56, w: 300, h: 40, icon: '🎥', label: 'Camera & microphone', tone: 'user', layout: 'row' },
            { id: `${p}_app`, x: X(40), y: 108, w: 300, h: 72, icon: '🧩', label: 'APE Space app', sub: 'closed source · one signed release for all', tone: 'closed' },
            { id: `${p}_lib`, x: X(40), y: 192, w: 300, h: 72, icon: '📚', label: 'lib-jitsi-meet', sub: 'open-source meeting & encryption library', tone: 'public' },
            { id: `${p}_vault`, x: X(40), y: 276, w: 135, h: 120, icon: '🔐', label: 'Key vault', sub: 'sandboxed · holds every key', tone: 'vault' },
            { id: `${p}_worker`, x: X(205), y: 276, w: 135, h: 120, icon: '⚙️', label: 'E2EE worker', sub: 'locks & unlocks each frame', tone: 'public' },
            { id: `${p}_rtc`, x: X(40), y: 430, w: 300, h: 44, icon: '📡', label: 'WebRTC', sub: 'the browser’s media engine', tone: 'browser', layout: 'row' },
            { id: `${p}_screen`, x: X(40), y: 488, w: 300, h: 112, icon: '🖥️', label: `What ${name} sees`, tone: 'screen' }
        ];
    }

    function browserEdges(p, x0, side) {
        const dx = x0 - 20;
        const X = v => v + dx;
        const rail = side === 'l' ? X(30) : X(30);

        return [
            { id: `${p}_cam-${p}_app`, a: `${p}_cam`, b: `${p}_app`, kind: 'internal' },
            { id: `${p}_app-${p}_lib`, a: `${p}_app`, b: `${p}_lib`, kind: 'internal' },
            { id: `${p}_lib-${p}_vault`, a: `${p}_lib`, b: `${p}_vault`, kind: 'internal', ax: X(107), bx: X(107) },
            { id: `${p}_vault-${p}_worker`, a: `${p}_vault`, b: `${p}_worker`, kind: 'key' },
            { id: `${p}_worker-${p}_rtc`, a: `${p}_worker`, b: `${p}_rtc`, kind: 'internal', ax: X(272), bx: X(272) },
            { id: `${p}_app-${p}_rtc`, a: `${p}_app`, b: `${p}_rtc`, kind: 'internal',
              pts: [[X(40), 144], [rail, 144], [rail, 452], [X(40), 452]] },
            { id: `${p}_rtc-${p}_screen`, a: `${p}_rtc`, b: `${p}_screen`, kind: 'internal', ax: X(112), bx: X(112) }
        ];
    }

    WT.scenes = {
        // ------------------------------------------------------------ the meeting
        meeting: {
            nodes: [
                ...browser('h', 20, 'Alice', 'host'),
                ...browser('g', 840, 'Bob', 'guest'),
                { id: 'srv', kind: 'zone', x: 430, y: 20, w: 340, h: 590, label: 'APE Space servers', sub: 'run by us, the operator', icon: '🏢', tone: 'server' },
                { id: 'web', x: 450, y: 56, w: 300, h: 60, icon: '🗂️', label: 'Web server', sub: 'serves the meeting page and app files', tone: 'server' },
                { id: 'mallory', optional: true, kind: 'tag', layout: 'row', x: 450, y: 121, w: 300, h: 32, icon: '😈', label: 'Mallory', tone: 'attacker' },
                { id: 'prosody', x: 450, y: 158, w: 300, h: 96, icon: '📨', label: 'Prosody · signalling', sub: 'the switchboard: who is here, and every setup message (XMPP)', tone: 'server' },
                { id: 'jicofo', x: 450, y: 278, w: 300, h: 62, icon: '🎛️', label: 'Jicofo · focus', sub: 'invites everyone to the video bridge', tone: 'server' },
                { id: 'jvb', x: 450, y: 364, w: 300, h: 106, icon: '🔀', label: 'JVB · video bridge', sub: 'forwards everyone’s audio and video', tone: 'server' },
                { id: 'ghost', optional: true, x: 450, y: 494, w: 300, h: 100, icon: '👻', label: 'Hidden participant', sub: 'joins where recorders join: not in the participant list', tone: 'attacker' },
                { id: 'carol', optional: true, x: 450, y: 622, w: 300, h: 70, icon: '💻', label: 'Carol’s browser', sub: 'joins the meeting later', tone: 'user', layout: 'row' }
            ],
            edges: [
                ...browserEdges('h', 20, 'l'),
                ...browserEdges('g', 840, 'r'),
                { id: 'h_app-web', a: 'h_app', b: 'web', kind: 'file', ay: 144, by: 86 },
                { id: 'g_app-web', a: 'g_app', b: 'web', kind: 'file', ay: 144, by: 86 },
                { id: 'h_lib-prosody', a: 'h_lib', b: 'prosody', kind: 'signal', by: 228 },
                { id: 'g_lib-prosody', a: 'g_lib', b: 'prosody', kind: 'signal', by: 228 },
                { id: 'h_rtc-jvb', a: 'h_rtc', b: 'jvb', kind: 'media', by: 452 },
                { id: 'g_rtc-jvb', a: 'g_rtc', b: 'jvb', kind: 'media', by: 452 },
                { id: 'prosody-jicofo', a: 'prosody', b: 'jicofo', kind: 'signal' },
                { id: 'jicofo-jvb', a: 'jicofo', b: 'jvb', kind: 'signal' },
                { id: 'ghost-prosody', a: 'ghost', b: 'prosody', kind: 'signal', pts: [[750, 544], [762, 544], [762, 240], [750, 240]] },
                { id: 'carol-prosody', a: 'carol', b: 'prosody', kind: 'signal', pts: [[450, 657], [440, 657], [440, 240], [450, 240]] },
                { id: 'carol-jvb', a: 'carol', b: 'jvb', kind: 'media', ax: 640, bx: 640 }
            ]
        },

        // ------------------------------------------------------------ release pipeline
        pipeline: {
            nodes: [
                { id: 'srcz', kind: 'zone', x: 20, y: 40, w: 250, h: 340, label: 'Private source repository', icon: '🔒', tone: 'closed' },
                { id: 'pr', x: 40, y: 88, w: 210, h: 78, icon: '👩‍💻', label: 'Pull request', sub: 'a change, reviewed by the Project Lead', tone: 'closed' },
                { id: 'develop', x: 40, y: 196, w: 210, h: 62, icon: '🌿', label: 'develop branch', sub: 'feeds the development server', tone: 'closed' },
                { id: 'main', x: 40, y: 296, w: 210, h: 62, icon: '🌳', label: 'master branch', sub: 'feeds production', tone: 'closed' },
                { id: 'oidc', x: 20, y: 430, w: 250, h: 84, icon: '🎫', label: 'GitHub identity token', sub: 'GitHub vouches: “this is the build workflow of this repo, on this branch”', tone: 'github' },

                { id: 'ciz', kind: 'zone', x: 310, y: 40, w: 400, h: 430, label: 'GitHub Actions', sub: 'build-docker-image.yml', icon: '⚙️', tone: 'ci' },
                { id: 'build', x: 330, y: 86, w: 360, h: 92, icon: '🐳', label: 'Reproducible build', sub: 'pinned base images · locked dependencies · same source → same bytes', tone: 'ci' },
                { id: 'fp', x: 330, y: 188, w: 360, h: 88, icon: '🧮', label: 'Fingerprint every file', sub: 'SHA-256 of each file → manifest.json → its SHA-256 is the release ID', tone: 'ci' },
                { id: 'rec', x: 330, y: 286, w: 360, h: 70, icon: '🧾', label: 'Build record', sub: 'release ID · commit · branch · image digest · time', tone: 'ci' },
                { id: 'sign', x: 330, y: 368, w: 360, h: 86, icon: '✍️', label: 'Sign the record (keyless)', sub: 'cosign + Sigstore: no long-lived key exists to steal', tone: 'ci' },

                { id: 'sgz', kind: 'zone', x: 310, y: 500, w: 400, h: 184, label: 'Sigstore', sub: 'public signing service (OpenSSF)', icon: '🛡️', tone: 'sigstore' },
                { id: 'fulcio', x: 330, y: 548, w: 175, h: 118, icon: '🪪', label: 'Fulcio', sub: 'certificate authority: issues a 10-minute certificate naming the workflow', tone: 'sigstore' },
                { id: 'rekor', x: 515, y: 548, w: 175, h: 118, icon: '📜', label: 'Rekor', sub: 'public log: entries can be added, never changed or removed', tone: 'sigstore' },

                { id: 'reg', x: 760, y: 40, w: 420, h: 70, icon: '📦', label: 'Container registry (GHCR)', sub: 'the built image, addressed by its digest', tone: 'github' },
                { id: 'pubz', kind: 'zone', x: 760, y: 150, w: 420, h: 300, label: 'Public repository', sub: 'on GitHub', icon: '🌍', tone: 'github' },
                { id: 'rel', x: 780, y: 198, w: 380, h: 100, icon: '🗃️', label: 'releases/&lt;release ID&gt;/', sub: 'manifest.json · builds/&lt;time&gt;-&lt;branch&gt;-&lt;commit&gt;.json · …json.sigstore.json', tone: 'github' },
                { id: 'cfg', x: 780, y: 310, w: 186, h: 128, icon: '🔧', label: 'e2ee-module/ + config.json', sub: 'public patches and the expected encryption fingerprints', tone: 'public' },
                { id: 'rules', x: 976, y: 310, w: 184, h: 128, icon: '🚫', label: 'Append-only', sub: 'no force-push, no deletion: history can’t be rewritten', tone: 'github' },

                { id: 'devenv', x: 760, y: 500, w: 200, h: 100, icon: '🧪', label: 'Development server', sub: 'conference.dev.apespace…', tone: 'server' },
                { id: 'prodenv', x: 980, y: 500, w: 200, h: 100, icon: '🏭', label: 'Production server', sub: 'customers’ meetings', tone: 'server' }
            ],
            edges: [
                { id: 'pr-develop', a: 'pr', b: 'develop', kind: 'file' },
                { id: 'develop-main', a: 'develop', b: 'main', kind: 'file' },
                { id: 'develop-build', a: 'develop', b: 'build', kind: 'file', by: 116 },
                { id: 'main-build', a: 'main', b: 'build', kind: 'file', by: 140 },
                { id: 'build-fp', a: 'build', b: 'fp', kind: 'file' },
                { id: 'fp-rec', a: 'fp', b: 'rec', kind: 'file' },
                { id: 'rec-sign', a: 'rec', b: 'sign', kind: 'file' },
                { id: 'build-reg', a: 'build', b: 'reg', kind: 'file' },
                { id: 'reg-devenv', a: 'reg', b: 'devenv', kind: 'file', pts: [[760, 96], [744, 96], [744, 550], [760, 550]] },
                { id: 'reg-prodenv', a: 'reg', b: 'prodenv', kind: 'file', pts: [[1180, 96], [1192, 96], [1192, 550], [1180, 550]] },
                { id: 'sign-oidc', a: 'sign', b: 'oidc', kind: 'trust', ay: 430, by: 472 },
                { id: 'sign-fulcio', a: 'sign', b: 'fulcio', kind: 'trust', ax: 418, bx: 418 },
                { id: 'sign-rekor', a: 'sign', b: 'rekor', kind: 'trust', ax: 602, bx: 602 },
                { id: 'sign-rel', a: 'sign', b: 'rel', kind: 'file', ay: 392, by: 270 }
            ]
        },

        // ------------------------------------------------------------ verification page
        verify: {
            nodes: [
                { id: 'youz', kind: 'zone', x: 20, y: 40, w: 440, h: 640, label: 'Your browser', sub: 'every check runs here', icon: '💻' },
                { id: 'vpage', x: 40, y: 90, w: 400, h: 62, icon: '🔎', label: 'Verification page', sub: 'a static page with no backend', tone: 'public' },
                { id: 'v1', x: 40, y: 161, w: 400, h: 80, icon: '1️⃣', label: 'Load the signed releases', sub: 'each manifest’s SHA-256 must equal its release ID', tone: 'browser' },
                { id: 'v2', x: 40, y: 250, w: 400, h: 84, icon: '2️⃣', label: 'Check every signature', sub: 'with the browser’s own cryptography', tone: 'browser' },
                { id: 'v3', x: 40, y: 343, w: 400, h: 80, icon: '3️⃣', label: 'Which release does each server run?', sub: 'fingerprint its app bundle, find the release that lists it', tone: 'browser' },
                { id: 'v4', x: 40, y: 432, w: 400, h: 80, icon: '4️⃣', label: 'Compare every file', sub: 'download, fingerprint, compare with the signed manifest', tone: 'browser' },
                { id: 'v5', x: 40, y: 521, w: 400, h: 72, icon: '5️⃣', label: 'Encryption code = public rebuild', sub: 'six files, six expected fingerprints', tone: 'browser' },
                { id: 'vres', x: 40, y: 602, w: 400, h: 74, icon: '🧾', label: 'Result', tone: 'screen' },

                { id: 'ghz', kind: 'zone', x: 520, y: 40, w: 300, h: 300, label: 'GitHub (public)', icon: '🌍', tone: 'github' },
                { id: 'pages', x: 540, y: 90, w: 260, h: 70, icon: '📄', label: 'GitHub Pages', sub: 'the page’s own code + config.json', tone: 'github' },
                { id: 'api', x: 540, y: 176, w: 260, h: 66, icon: '🗂️', label: 'List of releases', sub: 'the releases/ folder of the public repo', tone: 'github' },
                { id: 'raw', x: 540, y: 258, w: 260, h: 66, icon: '🧾', label: 'Release files', sub: 'manifests · build records · signatures', tone: 'github' },

                { id: 'cfgz', kind: 'zone', x: 880, y: 40, w: 300, h: 300, label: 'config.json', sub: 'in the public repo', icon: '🔧', tone: 'sigstore' },
                { id: 'roots', x: 900, y: 88, w: 260, h: 112, icon: '🔑', label: 'Trust anchors', sub: 'Sigstore’s root certificate and log key, and the one accepted signer: APE Space’s build workflow', tone: 'sigstore' },
                { id: 'encfp', x: 900, y: 212, w: 260, h: 114, icon: '🔢', label: 'Expected encryption fingerprints', sub: 'lib-jitsi-meet · worker · vault page · vault script · olm.js · olm.wasm', tone: 'public' },

                { id: 'envz', kind: 'zone', x: 520, y: 380, w: 300, h: 300, label: 'APE Space servers', icon: '🏢', tone: 'server' },
                { id: 'vdev', x: 540, y: 428, w: 260, h: 110, icon: '🧪', label: 'Development', sub: 'conference.dev.apespace.apept.net', tone: 'server' },
                { id: 'vprod', x: 540, y: 554, w: 260, h: 110, icon: '🏭', label: 'Production', sub: 'customers’ meetings', tone: 'server' },

                { id: 'rebz', kind: 'zone', x: 880, y: 380, w: 300, h: 300, label: 'Anyone’s own rebuild', icon: '🛠️', tone: 'public' },
                { id: 'rebuild', x: 900, y: 428, w: 260, h: 120, icon: '🔁', label: 'e2ee-module/build.sh', sub: 'Jitsi’s public source + 8 public patches + Olm from npm → the same six fingerprints', tone: 'public' },
                { id: 'upstream', x: 900, y: 566, w: 260, h: 98, icon: '🌐', label: 'Public sources', sub: 'github.com/jitsi/lib-jitsi-meet v2118 · npm @matrix-org/olm 3.2.15', tone: 'github' }
            ],
            edges: [
                { id: 'pages-vpage', a: 'pages', b: 'vpage', kind: 'file' },
                { id: 'api-v1', a: 'api', b: 'v1', kind: 'file' },
                { id: 'raw-v1', a: 'raw', b: 'v1', kind: 'file', ay: 282, by: 226 },
                { id: 'raw-v2', a: 'raw', b: 'v2', kind: 'file', ay: 304, by: 300 },
                { id: 'roots-pages', a: 'roots', b: 'pages', kind: 'trust', ay: 128, by: 128 },
                { id: 'encfp-pages', a: 'encfp', b: 'pages', kind: 'trust', ay: 250, by: 148 },
                { id: 'rebuild-encfp', a: 'rebuild', b: 'encfp', kind: 'equal', label: '=' },
                { id: 'upstream-rebuild', a: 'upstream', b: 'rebuild', kind: 'file' },
                { id: 'vdev-v3', a: 'vdev', b: 'v3', kind: 'file', ay: 456, by: 390 },
                { id: 'vprod-v3', a: 'vprod', b: 'v3', kind: 'file', ay: 580, by: 410 },
                { id: 'vdev-v4', a: 'vdev', b: 'v4', kind: 'file', ay: 510, by: 472 },
                { id: 'vprod-v4', a: 'vprod', b: 'v4', kind: 'file', ay: 630, by: 496 }
            ]
        },

        // ------------------------------------------------------------ browser extension
        extension: {
            nodes: [
                { id: 'youz', kind: 'zone', x: 20, y: 40, w: 800, h: 640, label: 'Your browser', icon: '💻' },
                { id: 'tabz', kind: 'zone', x: 40, y: 92, w: 760, h: 262, label: 'Meeting tab', sub: 'an APE Space meeting', icon: '📑' },
                { id: 'mpage', x: 60, y: 136, w: 220, h: 96, icon: '📄', label: 'Meeting page', sub: 'index.html: static, signed, with its security policy', tone: 'closed' },
                { id: 'mfiles', x: 320, y: 136, w: 210, h: 96, icon: '📦', label: 'Scripts & modules', sub: 'app bundle · lib-jitsi-meet · worker · vault · Olm', tone: 'closed' },
                { id: 'panel', x: 560, y: 136, w: 220, h: 96, icon: '🟠', label: 'Inspector panel', sub: '“E2EE Inspector recording”; everyone is told in chat', tone: 'inspector' },
                { id: 'hook', x: 60, y: 248, w: 220, h: 92, icon: '🪝', label: 'Inspector hook', sub: 'in the page: records frames, keys, key-exchange messages', tone: 'inspector' },
                { id: 'vhook', x: 320, y: 248, w: 210, h: 92, icon: '🪝', label: 'Hook in the key vault', sub: 'reports each media key sent to the worker', tone: 'inspector' },
                { id: 'cap', x: 560, y: 248, w: 220, h: 92, icon: '💾', label: 'Capture file', sub: '.ndjson, saved to your own computer', tone: 'inspector' },

                { id: 'extz', kind: 'zone', x: 40, y: 384, w: 760, h: 280, label: 'APESpace Verify extension', sub: 'open source, installed from the public repo', icon: '🧩', tone: 'public' },
                { id: 'popup', x: 60, y: 430, w: 220, h: 100, icon: '🎛️', label: 'Popup', sub: 'Inspector mode on/off · leak check scope · open the viewer', tone: 'public' },
                { id: 'badge', x: 320, y: 430, w: 210, h: 100, icon: '✅', label: 'Toolbar badge', sub: '✓ all match · ! a file differs · … checking', tone: 'public' },
                { id: 'viewer', x: 60, y: 546, w: 220, h: 104, icon: '🖼️', label: 'Capture viewer', sub: 'six sections · works offline · nothing leaves the tab', tone: 'public' },
                { id: 'leak', x: 320, y: 546, w: 210, h: 104, icon: '🔍', label: 'Leak scan', sub: 'outgoing messages and requests searched for the keys', tone: 'public' },
                { id: 'bg', x: 560, y: 430, w: 220, h: 220, icon: '⚙️', label: 'Background worker', sub: 'the code check: notes each file the meeting loads, downloads it again, fingerprints it, compares it with the signed release', tone: 'public' },

                { id: 'mserv', kind: 'zone', x: 880, y: 40, w: 300, h: 300, label: 'APE Space servers', icon: '🏢', tone: 'server' },
                { id: 'msrv', x: 900, y: 90, w: 260, h: 96, icon: '🗂️', label: 'Web server', sub: 'the meeting’s files', tone: 'server' },
                { id: 'mpros', x: 900, y: 204, w: 260, h: 116, icon: '📨', label: 'Signalling & video bridge', sub: 'key-exchange messages and encrypted media pass through here', tone: 'server' },

                { id: 'ghz', kind: 'zone', x: 880, y: 384, w: 300, h: 296, label: 'Public repository', icon: '🌍', tone: 'github' },
                { id: 'grel', x: 900, y: 432, w: 260, h: 100, icon: '🗃️', label: 'Signed releases', sub: 'manifests + signed build records', tone: 'github' },
                { id: 'gcfg', x: 900, y: 548, w: 260, h: 112, icon: '🔧', label: 'config.json', sub: 'trust anchors · the one accepted signer · meeting sites', tone: 'sigstore' }
            ],
            edges: [
                { id: 'msrv-tabz', a: 'msrv', b: 'tabz', kind: 'file', ay: 138, by: 184 },
                { id: 'mpros-tabz', a: 'mpros', b: 'tabz', kind: 'signal', ay: 262, by: 300 },
                { id: 'tabz-bg', a: 'tabz', b: 'bg', kind: 'internal', ax: 670, bx: 670 },
                { id: 'bg-msrv', a: 'bg', b: 'msrv', kind: 'file', ay: 470, by: 160 },
                { id: 'bg-grel', a: 'bg', b: 'grel', kind: 'file', ay: 500, by: 482 },
                { id: 'bg-gcfg', a: 'bg', b: 'gcfg', kind: 'trust', ay: 600, by: 604 },
                { id: 'bg-badge', a: 'bg', b: 'badge', kind: 'internal', ay: 480, by: 480 },
                { id: 'popup-hook', a: 'popup', b: 'hook', kind: 'internal', ax: 170, bx: 170 },
                { id: 'vhook-hook', a: 'vhook', b: 'hook', kind: 'key' },
                { id: 'panel-cap', a: 'panel', b: 'cap', kind: 'internal' },
                { id: 'bg-leak', a: 'bg', b: 'leak', kind: 'internal', ay: 600, by: 600 }
            ]
        },

        // ------------------------------------------------------------ chain of proof
        chain: {
            nodes: [
                { id: 'srcz', kind: 'zone', x: 20, y: 40, w: 220, h: 360, label: 'Public sources', icon: '🌐', tone: 'github' },
                { id: 'jitsi', x: 36, y: 86, w: 188, h: 92, icon: '📚', label: 'Jitsi’s source', sub: 'lib-jitsi-meet v2118 (commit 67fd2c84)', tone: 'github' },
                { id: 'patches', x: 36, y: 192, w: 188, h: 92, icon: '🩹', label: '8 public patches', sub: 'key auth · hidden recipients · group number · key vault · newcomer keys · replay · 2 more', tone: 'public' },
                { id: 'olmnpm', x: 36, y: 298, w: 188, h: 90, icon: '📦', label: 'Olm 3.2.15', sub: '@matrix-org/olm from npm', tone: 'github' },
                { id: 'rb', x: 280, y: 160, w: 200, h: 140, icon: '🔁', label: 'build.sh', sub: 'anyone runs it: clones, patches, builds in Docker (node:20)', tone: 'public' },
                { id: 'fps', x: 520, y: 160, w: 200, h: 140, icon: '🔢', label: 'Six fingerprints', sub: '686d5d75… 61ae549c… e5e9a557… 3998dee7… cf9a793b… 3fc8dbfe…', tone: 'public' },
                { id: 'cfgx', x: 770, y: 40, w: 190, h: 100, icon: '🔧', label: 'config.json', sub: 'the expected encryption fingerprints', tone: 'sigstore' },
                { id: 'manx', x: 770, y: 180, w: 190, h: 100, icon: '🗃️', label: 'Signed release', sub: 'manifest: every file’s SHA-256, signed by CI', tone: 'github' },
                { id: 'srvx', x: 770, y: 320, w: 190, h: 100, icon: '🏢', label: 'Served by dev & prod', sub: 'checked by the verification page', tone: 'server' },
                { id: 'brx', x: 1000, y: 160, w: 180, h: 140, icon: '💻', label: 'Loaded in your meeting', sub: 'checked by the extension, every meeting', tone: 'browser' },

                { id: 'lockz', kind: 'zone', x: 20, y: 450, w: 1160, h: 230, label: 'Only those files run, and the keys stay in the vault', icon: '🛡️', tone: 'public' },
                { id: 'csp', x: 40, y: 500, w: 265, h: 160, icon: '📄', label: 'Signed page + security policy', sub: 'the meeting page is a release file; its Content Security Policy lets only release scripts run: no injected or third-party code, no eval', tone: 'public' },
                { id: 'cfgw', x: 325, y: 500, w: 265, h: 160, icon: '🧪', label: 'Settings read as data', sub: 'each server’s config.js runs in an isolated worker; only plain settings come back, and E2EE settings are fixed in the release', tone: 'public' },
                { id: 'vaultx', x: 610, y: 500, w: 265, h: 160, icon: '🔐', label: 'Keys in the vault', sub: 'a sandboxed frame the app can’t reach into; media keys go straight to the encryption worker', tone: 'vault' },
                { id: 'appx', x: 895, y: 500, w: 265, h: 160, icon: '🧩', label: 'The closed app', sub: 'the same signed code for everyone; the Inspector watches it; an audit can name the exact release ID it covers', tone: 'closed' }
            ],
            edges: [
                { id: 'jitsi-rb', a: 'jitsi', b: 'rb', kind: 'file', by: 196 },
                { id: 'patches-rb', a: 'patches', b: 'rb', kind: 'file', by: 230 },
                { id: 'olmnpm-rb', a: 'olmnpm', b: 'rb', kind: 'file', by: 264 },
                { id: 'rb-fps', a: 'rb', b: 'fps', kind: 'file' },
                { id: 'fps-cfgx', a: 'fps', b: 'cfgx', kind: 'equal', label: '=', ay: 180, by: 100 },
                { id: 'fps-manx', a: 'fps', b: 'manx', kind: 'equal', label: '=' },
                { id: 'cfgx-manx', a: 'cfgx', b: 'manx', kind: 'equal', label: '=' },
                { id: 'manx-srvx', a: 'manx', b: 'srvx', kind: 'equal', label: '=' },
                { id: 'manx-brx', a: 'manx', b: 'brx', kind: 'equal', label: '=' },
                { id: 'srvx-brx', a: 'srvx', b: 'brx', kind: 'equal', label: '=', ay: 360, by: 280 }
            ]
        }
    };
})();
