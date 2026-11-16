// Chapters 8-11: shipping a release, the verification page, the browser extension,
// and the chain that ties the code in your browser to public source.
window.WT = window.WT || {};

(function () {
    const REL = '0637578c8430fc94…';
    const WF = 'https://github.com/OFF-GRID-APPS/APESpace-Jitsi-Meet-WebApp/.github/workflows/build-docker-image.yml@refs/heads/develop';

    // ================================================================ 8
    WT.chapters.push({
        id: 'release',
        title: 'Shipping a new release',
        steps: [
            {
                scene: 'pipeline',
                title: 'A change is merged',
                focus: [ 'srcz', 'build' ],
                plain: `
                    <p>A developer opens a <b>pull request</b> with a change. The Project Lead reviews it and merges it into the <b>develop</b> branch.</p>
                    <p>The merge starts the automated build on GitHub Actions. From here on, <b>no person touches the result</b>: the build system builds, fingerprints, signs and publishes on its own.</p>`,
                hood: `
                    <ul>
                        <li>The source repository (<code>OFF-GRID-APPS/APESpace-Jitsi-Meet-WebApp</code>) is private. The app's source is closed, but its <i>output</i> is published and signed.</li>
                        <li>The workflow <code>.github/workflows/build-docker-image.yml</code> runs on every push to <code>develop</code>, <code>main</code>, <code>master</code> or <code>release</code>.</li>
                    </ul>`,
                flows: [
                    { e: 'pr-develop', label: 'merge', k: 'file', at: 0, dur: 900 },
                    { e: 'develop-build', label: 'push → start build', k: 'file', at: 1000, dur: 1200 }
                ],
                chips: { pr: [ [ '✓ reviewed', 'ok' ] ], build: [ [ 'started', 'info', 2200 ] ] }
            },
            {
                scene: 'pipeline',
                title: 'A reproducible build',
                focus: [ 'build', 'reg' ],
                plain: `
                    <p>The build system packages the web app into a container image. The build is <b>reproducible</b>: the same source code always produces <b>byte-for-byte identical files</b>, on GitHub's machines or on anyone else's.</p>
                    <p>That property is what makes everything after it work. If the same source always gives the same bytes, a fingerprint of those bytes identifies exactly one version of the code.</p>`,
                hood: `
                    <ul>
                        <li>Base images are pinned by digest (<code>node:22.23.4</code> and <code>jitsi/web</code>), dependencies are installed with <code>npm ci</code> from the lockfile, and the encryption library is vendored (v2118 + 8 public patches, built in <code>node:20</code>).</li>
                        <li>Sources of randomness are seeded, and asset versions (<code>?v=</code>) are the bundle's hash. Source maps and the source tree are not shipped.</li>
                        <li>Checked: a CI build and a local build gave the same release ID.</li>
                        <li>The image goes to GHCR and is addressed by its <code>sha256</code> digest.</li>
                    </ul>`,
                flows: [ { e: 'build-reg', label: 'image @sha256:…', k: 'file', at: 0, dur: 1300 } ],
                chips: { build: [ [ 'same source → same bytes', 'ok' ] ] }
            },
            {
                scene: 'pipeline',
                title: 'Fingerprint every file',
                focus: [ 'build', 'fp', 'rec' ],
                plain: `
                    <p>The build system opens the image and computes a <b>fingerprint</b> (SHA-256) of every file the server will hand out: about 730 of them. A fingerprint is a 64-character code calculated from a file's contents. Change one byte and the fingerprint changes completely.</p>
                    <p>The list of all fingerprints is the <b>manifest</b>. The fingerprint of the manifest itself becomes the <b>release ID</b>, one code that stands for every byte of that version.</p>
                    <p>Then it writes a short <b>build record</b>: this release ID came from this commit, on this branch, as this image.</p>`,
                hood: `
                    <ul>
                        <li><code>.github/release/make-manifest.mjs</code> walks <code>/usr/share/jitsi-meet</code> and writes <code>{"schema":"apespace-web-manifest/v1","files":{"/path":{"sha256","size"}}}</code>, sorted, with no timestamps. Its SHA-256 is the release ID.</li>
                        <li><code>make-build-record.mjs</code> writes <code>apespace-build-record/v1</code>: release, file count, <code>image@digest</code>, the SHA-256 of the software bill of materials (SBOM), source repository, branch and commit, <code>builtAt</code>, and the Actions run URL.</li>
                    </ul>
<pre><code>{ "release": "0637578c8430fc9441817a75…",
  "files": 732,
  "image": "ghcr.io/off-grid-apps/…@sha256:…",
  "sbom": "a89a542d…",
  "source": { "branch": "develop", "commit": "fcf8952…" },
  "builtAt": "2026-11-…", "run": "https://github.com/…/actions/runs/…" }</code></pre>`,
                flows: [
                    { e: 'build-fp', label: '~730 files', k: 'file', at: 0, dur: 1000 },
                    { e: 'fp-rec', label: `release ${REL.slice(0, 8)}…`, k: 'file', at: 1200, dur: 1000 }
                ],
                inner: {
                    fp: [ [ '', 0 ], [ '<code>/libs/lib-jitsi-meet.min.js → 686d5d75…</code>', 900 ] ]
                }
            },
            {
                scene: 'pipeline',
                title: 'Sign it, with no secret key to steal',
                focus: [ 'sign', 'oidc', 'sgz' ],
                plain: `
                    <p>The build record is then <b>signed</b>, so anyone can tell it really came from APE Space's build system. It works differently from the usual approach:</p>
                    <ol>
                        <li><b>GitHub vouches</b> for what's running: “this is the build workflow of APE Space's repository, on the develop branch”.</li>
                        <li><b>Fulcio</b>, Sigstore's certificate authority, issues a certificate that names exactly that workflow and is valid for about 10 minutes.</li>
                        <li>The record is signed, and the signature is written into <b>Rekor</b>, a public log where entries can be added but never changed or removed.</li>
                    </ol>
                    <p>No long-lived signing key exists, so there's nothing to steal or misuse. <b>Nobody, APE Space included, can sign a record as this workflow from a laptop.</b> Anything signed this way is logged publicly forever.</p>`,
                hood: `
                    <ul>
                        <li><code>cosign sign-blob --yes --bundle build.json.sigstore.json build.json</code> (keyless). The job has <code>id-token: write</code> to obtain a GitHub OIDC token (issuer <code>https://token.actions.githubusercontent.com</code>).</li>
                        <li>The certificate's identity (SAN URI) is <code>${WF}</code>.</li>
                        <li>The bundle contains the signature, the certificate, the Rekor log entry, an inclusion proof and a signed checkpoint, so it can be verified offline.</li>
                        <li>The ephemeral signing key is discarded after use.</li>
                    </ul>`,
                flows: [
                    { e: 'sign-oidc', label: 'who am I?', k: 'sig', at: 0, dur: 900 },
                    { e: 'sign-oidc', rev: true, label: 'identity token', k: 'ok', at: 1000, dur: 900 },
                    { e: 'sign-fulcio', label: 'token + public key', k: 'sig', at: 2100, dur: 900 },
                    { e: 'sign-fulcio', rev: true, label: '10-min certificate', k: 'ok', at: 3100, dur: 900 },
                    { e: 'sign-rekor', label: 'signature + cert', k: 'sig', at: 4200, dur: 900 },
                    { e: 'sign-rekor', rev: true, label: 'log entry + proof', k: 'ok', at: 5200, dur: 900 }
                ],
                chips: { sign: [ [ '✍️ signed', 'ok', 4100 ] ], rekor: [ [ 'entry logged forever', 'ok', 5200 ] ] },
                cycle: 7600
            },
            {
                scene: 'pipeline',
                title: 'Publish to the public repository',
                focus: [ 'sign', 'pubz' ],
                plain: `
                    <p>The build system then pushes four files into APE Space's <b>public repository</b> on GitHub, in a folder named after the release ID: the manifest, the build record, its signature, and a list of every software package in the build (the SBOM).</p>
                    <p>The repository is <b>append-only</b>. New records can be added, but history can't be rewritten or deleted. Combined with the public Rekor log, a release can never be quietly swapped for another.</p>`,
                hood: `
                    <ul>
                        <li>Files: <code>releases/&lt;id&gt;/manifest.json</code>, <code>releases/&lt;id&gt;/builds/&lt;UTC time&gt;-&lt;branch&gt;-&lt;commit7&gt;.json</code> and <code>….json.sigstore.json</code> and <code>….sbom.cdx.json</code>. Commit message: <code>release 0637578c8430fc94: develop build fcf8952</code>.</li>
                        <li>CI writes with a <b>deploy key</b> that has write access to that one repository only (secret <code>TRANSPARENCY_DEPLOY_KEY</code>), and pins GitHub's SSH host key. If two builds publish at once, it retries with a rebase.</li>
                        <li>A branch ruleset blocks force pushes and deletions.</li>
                    </ul>`,
                flows: [ { e: 'sign-rel', label: 'manifest + record + signature', k: 'file', at: 0, dur: 1500 } ],
                chips: { rel: [ [ `new: releases/${REL.slice(0, 8)}…/`, 'ok', 1500 ] ], rules: [ [ '🔒 enforced', 'info' ] ] }
            },
            {
                scene: 'pipeline',
                title: 'The development server updates',
                focus: [ 'reg', 'devenv', 'rel' ],
                plain: `
                    <p>The development server pulls the new image and starts serving it. From this moment, anyone can test this exact release on development, as thoroughly as they like: with the attack kit, the Inspector, or their own tools.</p>
                    <p>And anyone can confirm that development really serves it, with the verification page (chapter 9).</p>`,
                hood: `
                    <p>The development server watches the registry and redeploys when <code>develop</code>'s image changes. The verification page then finds the release by fingerprinting <code>/libs/app.bundle.min.js</code> and compares every file with that release's manifest.</p>`,
                flows: [ { e: 'reg-devenv', label: 'pull new image', k: 'file', at: 0, dur: 1600 } ],
                chips: { devenv: [ [ `runs ${REL.slice(0, 8)}…`, 'ok', 1600 ] ] }
            },
            {
                scene: 'pipeline',
                title: 'Promoting the same release to production',
                focus: [ 'develop', 'main', 'build', 'fp', 'rec', 'sign', 'rel', 'reg', 'prodenv', 'devenv' ],
                plain: `
                    <p>Once the release is tested, <b>develop is merged into master</b>, the production branch. The build system builds again, this time from master.</p>
                    <p>Because the build is reproducible, the files come out <b>byte-for-byte identical</b>, so the release ID is <b>the same</b>. The build system adds a second signed record, “built from master”, to the same release folder, and production pulls the image.</p>
                    <p>So anyone can see that <b>production runs exactly the code that was tested on development</b>, not something similar.</p>
                    <p><b>Today (16 November 2026):</b> the current production server, conference.apespace.getape.net, still runs an earlier version of the app that isn't one of the signed releases and doesn't have these protections, so the verification page reports it as not verified. Its replacement, conference2.apespace.getape.net, already runs the same signed release as development and becomes production after testing, planned by 29 November 2026.</p>`,
                hood: `
                    <ul>
                        <li>The second record is signed by the same workflow with the identity <code>…@refs/heads/master</code>. The checks accept <code>develop</code>, <code>staging</code>, <code>main</code> or <code>master</code> and nothing else.</li>
                        <li>The verification page reports “development and production run the same signed release” only when both environments match the same release ID file for file.</li>
                    </ul>`,
                flows: [
                    { e: 'develop-main', label: 'merge', k: 'file', at: 0, dur: 900 },
                    { e: 'main-build', label: 'push → build', k: 'file', at: 1000, dur: 1100 },
                    { e: 'build-fp', label: 'same bytes', k: 'file', at: 2200, dur: 700 },
                    { e: 'fp-rec', label: `same ID ${REL.slice(0, 8)}…`, k: 'ok', at: 3000, dur: 700 },
                    { e: 'rec-sign', label: 'record (master)', k: 'file', at: 3800, dur: 700 },
                    { e: 'sign-rel', label: '2nd signed record', k: 'file', at: 4600, dur: 1300 },
                    { e: 'reg-prodenv', label: 'pull same release', k: 'file', at: 4600, dur: 1700 }
                ],
                chips: {
                    rel: [ [ 'record: develop ✓', 'ok' ], [ 'record: master ✓', 'ok', 5900 ] ],
                    devenv: [ [ `runs ${REL.slice(0, 8)}…`, 'ok' ] ],
                    prodenv: [ [ `runs ${REL.slice(0, 8)}…`, 'ok', 6300 ] ]
                },
                cycle: 8000
            },
            {
                scene: 'pipeline',
                title: 'When the encryption code itself changes',
                focus: [ 'cfg', 'rel', 'rules', 'build' ],
                plain: `
                    <p>The encryption code has an extra rule. Its expected fingerprints are written in the public repository (<code>config.json</code>), next to the <b>public patches</b> that produce it.</p>
                    <p>So a change to the encryption code needs a <b>public change</b> too: a new patch and new fingerprints that anyone can read and rebuild. Until that's published, the verification page and the extension flag the server's encryption files as not matching.</p>`,
                hood: `
                    <ul>
                        <li><code>e2ee-module/</code> holds the eight patches (<code>olm-key-auth.patch</code> (Jitsi's own fix 4a958bc1), <code>hidden-key-recipients.patch</code>, <code>group-safety-number.patch</code>, <code>e2ee-key-vault.patch</code>, <code>newcomer-key-ratchet.patch</code>, <code>dtx-empty-frames.patch</code> (Jitsi's own fix 8b4d9371), <code>frame-counter-replay.patch</code> and <code>vp8-on-reenable.patch</code>) and <code>build.sh</code>.</li>
                        <li><code>config.json → encryptionLibrary.files</code> lists the six served paths with their SHA-256s. The verification check requires each one to be in the release with exactly that hash, and to be served that way.</li>
                        <li>Order of operations: the fork's build reaches development first, then the public patch and fingerprints are merged. Otherwise the public check would fail.</li>
                    </ul>`,
                chips: { cfg: [ [ '6 expected fingerprints', 'enc' ] ] }
            }
        ]
    });

    // ================================================================ 9
    const ver = 'Verified: development and production run the same signed release';

    WT.chapters.push({
        id: 'page',
        title: 'The verification page',
        steps: [
            {
                scene: 'verify',
                title: 'Open the page',
                focus: [ 'vpage', 'pages', 'cfgz' ],
                plain: `
                    <p>The <b>verification page</b> is a plain web page published from the public repository on GitHub Pages. It has <b>no APE Space server behind it</b>: every check runs in your own browser, and its code is in the same public repository.</p>
                    <p>It comes with a small settings file, <code>config.json</code>, which says which servers to check, which signer to accept, and what the encryption files must look like. Press <b>Verify now</b>.</p>`,
                hood: `
                    <ul>
                        <li>Page: <code>index.html</code> + <code>verify/check.js</code>, sharing <code>extension/lib/{sigstore,releases}.js</code> with the extension.</li>
                        <li>The same check runs from a terminal: <code>node verify/cli.mjs</code> (Node 20+).</li>
                        <li>Trust anchors in <code>config.json</code>: Sigstore's Fulcio root and intermediate certificates, Rekor's public key, the OIDC issuer, and the signer pattern <code>^https://github\\.com/OFF-GRID-APPS/APESpace-Jitsi-Meet-WebApp/\\.github/workflows/build-docker-image\\.yml@refs/heads/(develop|staging|main|master)$</code>.</li>
                    </ul>`,
                flows: [
                    { e: 'pages-vpage', label: 'page + config.json', k: 'file', at: 0, dur: 1200 },
                    { e: 'roots-pages', label: 'trust anchors', k: 'file', at: 0, dur: 800 },
                    { e: 'encfp-pages', label: 'expected fingerprints', k: 'file', at: 200, dur: 800 }
                ],
                labels: { vpage: { sub: 'a static page with no backend · <b>[ Verify now ]</b>' } }
            },
            {
                scene: 'verify',
                title: 'Load the published releases',
                focus: [ 'v1', 'api', 'raw' ],
                plain: `
                    <p>The page lists the releases in the public repository and downloads each release's manifest.</p>
                    <p>For each one it computes the manifest's fingerprint, which <b>must equal the release ID</b> the folder is named after. If anyone had edited a manifest, it would no longer match its own name.</p>`,
                hood: `
                    <p><code>listReleases()</code> reads the repository tree from the GitHub API and <code>loadRelease()</code> downloads from <code>raw.githubusercontent.com</code>. Check: <code>sha256(manifest.json) === release id</code>, or the release is rejected (“manifest does not match its id”). Newest first, so the current release is found quickly.</p>`,
                flows: [
                    { e: 'api-v1', label: 'list of releases', k: 'file', at: 0, dur: 1100 },
                    { e: 'raw-v1', label: 'manifest.json', k: 'file', at: 1200, dur: 1100 },
                    { e: 'raw-v1', label: 'manifest.json', k: 'file', at: 1700, dur: 1100 }
                ],
                inner: { v1: [ [ '', 0 ], [ '<code>sha256(manifest) = 0637578c… ✓</code>', 2800 ] ] },
                state: { v1: [ 'ok', 2800 ] }
            },
            {
                scene: 'verify',
                title: 'Check every signature, in your browser',
                focus: [ 'v2', 'raw', 'roots', 'pages' ],
                plain: `
                    <p>For each build record, the page checks the signature <b>itself</b>, using your browser's built-in cryptography. It doesn't take Sigstore's or GitHub's word for it:</p>
                    <ol>
                        <li>The <b>signature</b> over the record is valid for the certificate's key.</li>
                        <li>The <b>certificate</b> was issued by Sigstore's certificate authority.</li>
                        <li>The certificate names <b>APE Space's build workflow</b> and no one else.</li>
                        <li>The signature is in the <b>public log</b>: the page checks the log's proof of inclusion and the log's own signature, and that the certificate was valid at that moment.</li>
                    </ol>
                    <p>A record that fails any of these counts as “not the official build”.</p>`,
                hood: `
                    <ul>
                        <li><code>extension/lib/sigstore.js</code> uses only WebCrypto. It has a minimal DER/X.509 reader, ECDSA P-256/P-384 verification, a chain to the pinned Fulcio CA, a SAN URI match against the signer regex, and an OIDC issuer extension check (<code>1.3.6.1.4.1.57264.1.8</code>).</li>
                        <li>Rekor: the canonicalised entry must match, the RFC 9162 Merkle inclusion proof must lead to the root, and the checkpoint must be signed by Rekor's key (pinned key ID <code>wNI9atQG…</code>). The certificate's validity window must contain the integration time.</li>
                        <li>Tested: forged records are rejected.</li>
                    </ul>`,
                flows: [
                    { e: 'raw-v2', label: 'record + .sigstore.json', k: 'file', at: 0, dur: 1200 }
                ],
                inner: { v2: [ [ '', 0 ], [ '✓ signature · ✓ certificate · ✓ signer · ✓ public log', 1500 ] ] },
                state: { v2: [ 'ok', 1500 ] },
                chips: { roots: [ [ 'used, not fetched', 'info' ] ] }
            },
            {
                scene: 'verify',
                title: 'Which release does each server run?',
                focus: [ 'v3', 'vdev', 'vprod' ],
                plain: `
                    <p>Now the page asks the servers. It downloads the main app file from development and from production, fingerprints it, and looks for <b>the signed release that lists exactly that fingerprint</b>.</p>
                    <p>If no signed release contains it, the server is running code that APE Space's build system never signed, and the check fails right there.</p>
                    <p>The animation shows both servers on the same release, as after a promotion. <b>Today (16 November 2026)</b> the current production server still runs an earlier version of the app that isn't one of the signed releases and doesn't have these protections, so the verification page reports it as not verified. Its replacement, conference2.apespace.getape.net, already runs the same release as development, and becomes production after testing (planned by 29 November 2026).</p>`,
                hood: `
                    <p><code>checkEnvironment()</code>: <code>sha256(GET /libs/app.bundle.min.js)</code>, then <code>loader.find('/libs/app.bundle.min.js', hash)</code> over the verified releases.</p>`,
                flows: [
                    { e: 'vdev-v3', label: 'app.bundle.min.js', k: 'file', at: 0, dur: 1200 },
                    { e: 'vprod-v3', label: 'app.bundle.min.js', k: 'file', at: 200, dur: 1300 }
                ],
                inner: {
                    v3: [ [ '', 0 ], [ 'Development → <b>0637578c…</b> · Production → <b>0637578c…</b>', 1600 ] ]
                },
                state: { v3: [ 'ok', 1600 ] }
            },
            {
                scene: 'verify',
                title: 'Compare every file',
                focus: [ 'v4', 'vdev', 'vprod' ],
                plain: `
                    <p>The page then downloads <b>every</b> script, stylesheet, data file, WebAssembly module and page of that release from each server, fingerprints each one, and compares it with the signed manifest.</p>
                    <p>It skips images, fonts and sounds, and two settings files that each server writes for its own setup (<code>config.js</code> and <code>interface_config.js</code>). The meeting page reads those as <b>data only</b>, so they can't run code in it (chapter 11).</p>`,
                hood: `
                    <ul>
                        <li>Compared: <code>/\\.(css|js|json|mjs|svg|wasm)$/</code>, plus <code>/index.html</code> and <code>/static/*.html</code> for releases with static pages (marker <code>/static/load-config.js</code>), plus all six encryption files.</li>
                        <li>Downloads use <code>cache: 'no-store'</code>, six at a time.</li>
                        <li>A file the browser isn't allowed to read (no CORS header) is reported as “not checkable”, never as a match. The CLI covers those.</li>
                        <li>Check of development on 15 November 2026: 323 of 323 compared files identical.</li>
                    </ul>`,
                flows: [
                    { e: 'vdev-v4', label: 'file', k: 'file', at: 0, dur: 900 },
                    { e: 'vprod-v4', label: 'file', k: 'file', at: 150, dur: 900 },
                    { e: 'vdev-v4', label: 'file', k: 'file', at: 500, dur: 900 },
                    { e: 'vprod-v4', label: 'file', k: 'file', at: 650, dur: 900 },
                    { e: 'vdev-v4', label: 'file', k: 'file', at: 1000, dur: 900 },
                    { e: 'vprod-v4', label: 'file', k: 'file', at: 1150, dur: 900 },
                    { e: 'vdev-v4', label: 'file', k: 'file', at: 1500, dur: 900 },
                    { e: 'vprod-v4', label: 'file', k: 'file', at: 1650, dur: 900 }
                ],
                inner: { v4: [ [ 'Comparing…', 0 ], [ '<b>323 / 323</b> identical on each server', 2600 ] ] },
                state: { v4: [ 'ok', 2600 ] }
            },
            {
                scene: 'verify',
                title: 'Is the encryption code the public code?',
                focus: [ 'v5', 'encfp', 'rebuild', 'upstream' ],
                plain: `
                    <p>Separately, the six files that make up the encryption code must have <b>exactly the fingerprints listed in config.json</b>.</p>
                    <p>Those fingerprints aren't just APE Space's say-so. They are what <b>anyone</b> gets by rebuilding from Jitsi's public source plus APE Space's public patches, using the script in the repository. Run it yourself, and if your fingerprints match, the code the servers deliver is the code you can read.</p>`,
                hood: `
                    <table>
                        <tr><th>Served as</th><th>SHA-256</th></tr>
                        <tr><td><code>/libs/lib-jitsi-meet.min.js</code></td><td><code>686d5d759c1a7173…</code></td></tr>
                        <tr><td><code>/libs/lib-jitsi-meet.e2ee-worker.js</code></td><td><code>61ae549c1f20e0ff…</code></td></tr>
                        <tr><td><code>/libs/lib-jitsi-meet.e2ee-vault.html</code></td><td><code>e5e9a55757ff0c2f…</code></td></tr>
                        <tr><td><code>/libs/lib-jitsi-meet.e2ee-vault.js</code></td><td><code>3998dee7c80ca1a0…</code></td></tr>
                        <tr><td><code>/libs/olm.js</code></td><td><code>cf9a793bcbad9199…</code></td></tr>
                        <tr><td><code>/libs/olm.wasm</code></td><td><code>3fc8dbfe8f44d550…</code></td></tr>
                    </table>
                    <p><code>cd e2ee-module && ./build.sh</code> (git + Docker) clones Jitsi's repository at v2118.0.0, applies the eight patches, builds in <code>node:20</code>, downloads <code>@matrix-org/olm</code> 3.2.15 from npm, and prints these six hashes.</p>`,
                flows: [
                    { e: 'upstream-rebuild', label: 'public source', k: 'file', at: 0, dur: 1000 },
                    { e: 'rebuild-encfp', label: 'same 6 fingerprints', k: 'ok', at: 1100, dur: 1000 },
                    { e: 'encfp-pages', label: 'expected', k: 'file', at: 2200, dur: 800 }
                ],
                inner: { v5: [ [ '', 0 ], [ '6 / 6 equal to the public rebuild ✓', 3000 ] ] },
                state: { v5: [ 'ok', 3000 ] }
            },
            {
                scene: 'verify',
                title: 'The verdict',
                focus: [ 'youz' ],
                plain: `
                    <p>If everything matches, the page shows <b>“${ver}”</b>. Until the new production server takes over (planned by 29 November 2026), it reports development and the new production server as verified, and the current production server as not running a signed release.</p>
                    <p><b>What that proves:</b> each server delivered exactly the files of a release that APE Space's build system signed and publicly logged, both delivered the same one, and the encryption code is the publicly rebuildable code.</p>
                    <p><b>What it doesn't:</b> it checks what the servers sent <i>to you</i>, <i>when you checked</i>. To cover every meeting you join, including code that might be served to you alone, there is the browser extension (next chapter).</p>`,
                hood: `
                    <p>Verdict logic (<code>checkAll</code>): every environment must have <code>release.signed</code>, zero mismatches and all encryption files correct (<code>allVerified</code>), and all must share one release ID (<code>sameRelease</code>). The app itself is closed source: the check proves it is the same signed code everywhere, not what that code does. That's covered by the Inspector and an independent audit.</p>`,
                state: { v1: 'ok', v2: 'ok', v3: 'ok', v4: 'ok', v5: 'ok', vres: 'ok' },
                labels: { vres: { label: 'Result', icon: '✅' } },
                inner: {
                    vres: `<b style="color:var(--ok)">${ver}</b>`,
                    v1: '<code>11 releases · manifests ✓</code>', v2: '✓ signature · ✓ certificate · ✓ signer · ✓ public log',
                    v3: 'Development → <b>0637578c…</b> · Production → <b>0637578c…</b>', v4: '<b>323 / 323</b> identical on each server', v5: '6 / 6 equal to the public rebuild ✓'
                }
            }
        ]
    });

    // ================================================================ 10
    WT.chapters.push({
        id: 'extension',
        title: 'The browser extension',
        steps: [
            {
                scene: 'extension',
                title: 'APESpace Verify: install it from source',
                focus: [ 'extz' ],
                plain: `
                    <p><b>APESpace Verify</b> is a browser extension for Chrome, Edge and Brave. You load it straight from the public repository's <code>extension</code> folder, so <b>you can read every line of what you install</b>.</p>
                    <p>It has two parts:</p>
                    <ul>
                        <li><b>Code check</b>, always on: verifies every meeting you join against the signed release.</li>
                        <li><b>E2EE Inspector</b>, off by default and for test meetings: lets you see the encryption with your own eyes.</li>
                    </ul>
                    <p>It sends nothing anywhere. It downloads only the meeting's own files and the public signed records.</p>`,
                hood: `
                    <ul>
                        <li>Manifest V3. Permissions: the APE Space meeting sites (<code>host_permissions</code>), plus <code>webRequest</code>, <code>webNavigation</code>, <code>scripting</code> (Inspector only) and <code>storage</code>. <code>&lt;all_urls&gt;</code> is optional and requested only for the all-sites leak check, then given back.</li>
                        <li>Install: <code>chrome://extensions</code> → Developer mode → Load unpacked → <code>extension/</code>.</li>
                    </ul>`,
                chips: { popup: [ [ 'Inspector mode: off', 'mute' ] ] }
            },
            {
                scene: 'extension',
                title: 'Code check: what did this meeting load?',
                focus: [ 'tabz', 'msrv', 'bg' ],
                plain: `
                    <p>When you open an APE Space meeting, the extension notes <b>every script, WebAssembly module and stylesheet</b> the meeting loads. That includes embedded meetings on other sites, and the meeting's background workers. It also notes the meeting page itself.</p>`,
                hood: `
                    <p><code>chrome.webRequest.onCompleted</code> on the meeting sites (page, iframes and workers). <code>webNavigation.onCommitted</code> resets a tab's results when it moves to a new page. Any room URL maps to the release's <code>/index.html</code>.</p>`,
                flows: [
                    { e: 'msrv-tabz', rev: false, label: 'page, scripts, wasm, styles', k: 'file', at: 0, dur: 1400 },
                    { e: 'tabz-bg', label: 'loaded: /libs/…', k: 'sig', at: 1500, dur: 900 },
                    { e: 'tabz-bg', label: 'loaded: index.html', k: 'sig', at: 1900, dur: 900 }
                ],
                inner: { badge: '<b>…</b> checking' },
                labels: { badge: { sub: '' } }
            },
            {
                scene: 'extension',
                title: 'Download again, fingerprint, compare',
                focus: [ 'bg', 'msrv', 'grel', 'gcfg', 'badge' ],
                plain: `
                    <p>Browsers don't let extensions read what a page downloaded, so the extension <b>downloads each file again</b> and fingerprints it. It finds the signed release the meeting's app belongs to, checks that release's signature the same four ways as the verification page, and compares <b>every file</b>.</p>
                    <p>The toolbar icon shows the result: <b>✓</b> every file matches a signed release · <b>!</b> a file differs or isn't in any release (click to see which) · <b>…</b> still checking.</p>`,
                hood: `
                    <ul>
                        <li>To fool this check, a server would have to recognise the extension's second download and answer it differently from the page's.</li>
                        <li>Pages are compared for releases with static pages. <code>config.js</code> and <code>interface_config.js</code> are not compared, because each server generates them and the page reads them as data only.</li>
                        <li>The signature checks use the same code as the verification page (<code>extension/lib/</code>) and the same trust anchors from <code>config.json</code>.</li>
                    </ul>`,
                flows: [
                    { e: 'bg-msrv', label: 'download again', k: 'file', at: 0, dur: 1100 },
                    { e: 'bg-msrv', rev: true, label: 'same files', k: 'file', at: 1200, dur: 1100 },
                    { e: 'bg-grel', rev: true, label: 'signed release', k: 'file', at: 600, dur: 1000 },
                    { e: 'bg-gcfg', rev: true, label: 'trust anchors', k: 'file', at: 300, dur: 900 },
                    { e: 'bg-badge', label: '✓ all match', k: 'ok', at: 2600, dur: 700 }
                ],
                inner: { badge: [ [ '<b>…</b> checking', 0 ], [ '<b style="color:var(--ok);font-size:18px">✓</b> every file matches release 0637578c…', 3300 ] ] },
                labels: { badge: { sub: '' } },
                state: { badge: [ 'ok', 3300 ] }
            },
            {
                scene: 'extension',
                title: 'Why a per-meeting check matters',
                focus: [ 'tabz', 'bg', 'badge', 'msrv' ],
                plain: `
                    <p>The verification page checks what the servers hand out <b>in general</b>. A dishonest server could, in theory, give the normal code to everyone else and a special version <b>to one person</b>.</p>
                    <p>The extension checks <b>the meeting you're in</b>, every time, so it would catch exactly that. If something doesn't match, the icon shows <b>!</b> and names the file. Don't hold sensitive meetings until the cause is clear.</p>`,
                hood: `
                    <p>The app's own Security options also show the fingerprints of the code the meeting loaded, with a link to this check. That makes comparing easy, but it is shown by the code itself, so it isn't proof. The extension checks independently.</p>
                    <p>Defence for users without the extension: the meeting page and its Content Security Policy are part of the signed release, and every browser enforces the policy before any code runs. A server that changed the whole page, policy included, for one user without the extension would not be noticed by that user. The verification page, other users with the extension, and the public record would see a change made for everyone.</p>`,
                flows: [
                    { e: 'msrv-tabz', label: 'a different file, just for you?', k: 'bad', at: 0, dur: 1400 },
                    { e: 'tabz-bg', label: 'loaded', k: 'sig', at: 1500, dur: 800 },
                    { e: 'bg-badge', label: '! mismatch', k: 'bad', at: 2500, dur: 700 }
                ],
                inner: { badge: [ [ '', 0 ], [ '<b style="color:var(--bad);font-size:18px">!</b> /libs/app.bundle.min.js differs', 3200 ] ] },
                state: { badge: [ 'bad', 3200 ] },
                labels: { badge: { label: 'Toolbar badge (example)', sub: '' } }
            },
            {
                scene: 'extension',
                title: 'Inspector mode: watch the encryption',
                focus: [ 'popup', 'hook', 'vhook', 'panel', 'tabz', 'mpros' ],
                plain: `
                    <p>For <b>test meetings</b>, switch on <b>Inspector mode</b> in the popup and join. The extension adds a small recorder to the meeting page and to the key vault. An orange panel shows it's recording, and <b>everyone in the meeting is told in chat</b>.</p>
                    <p>It records three things:</p>
                    <ul>
                        <li>every audio and video frame your browser <b>receives, before it is decrypted</b>, exactly as the server delivered it;</li>
                        <li>the <b>media keys</b> your browser received;</li>
                        <li>every <b>key-exchange message</b> the server passed along.</li>
                    </ul>`,
                hood: `
                    <ul>
                        <li><code>chrome.scripting.registerContentScripts</code> with <code>world: 'MAIN'</code> and <code>runAt: 'document_start'</code> runs <code>inspector/hook.js</code> before any page script, in the page and in the vault frame. The registration doesn't survive a browser restart.</li>
                        <li>Inside the vault, the hook wraps <code>MessagePort.prototype.postMessage</code> and reports each <code>setKey</code> sent to the worker to the page's hook. Inspector mode therefore deliberately makes the keys visible to the test page.</li>
                        <li>While it's on, the meeting uses Chrome's older encoded-streams API so frames can be seen before decryption. Media is not altered.</li>
                        <li>A capture contains that meeting's keys. Use test meetings and delete captures afterwards.</li>
                    </ul>`,
                flows: [
                    { e: 'popup-hook', label: 'Inspector on', k: 'sig', at: 0, dur: 900 },
                    { e: 'mpros-tabz', label: 'scrambled frames', k: 'enc', at: 1000, dur: 1200 },
                    { e: 'mpros-tabz', label: 'key-exchange msgs', k: 'key', at: 1500, dur: 1200 },
                    { e: 'vhook-hook', label: 'media key', k: 'key', at: 2400, dur: 900 },
                    { e: 'panel-cap', label: 'record', k: 'file', at: 3400, dur: 800 }
                ],
                chips: { popup: [ [ 'Inspector mode: ON', 'warn' ] ], panel: [ [ '● recording', 'warn', 900 ] ] },
                state: { panel: [ 'warn', 900 ] }
            },
            {
                scene: 'extension',
                title: 'The leak scan: does a key ever leave?',
                focus: [ 'hook', 'bg', 'leak', 'tabz' ],
                plain: `
                    <p>While recording, the Inspector also <b>searches everything your browser sends out</b> for the media keys: messages to the server, data-channel messages and web requests.</p>
                    <p>It looks for each key in every common disguise: raw bytes, hex, base64 at every position (so a key buried inside a bigger blob is still found), and lists of numbers. In APE Space meetings it finds <b>none</b>.</p>`,
                hood: `
                    <ul>
                        <li><code>inspector/leak-scan.js</code> runs in the page (WebSocket and data-channel sends) and in the background worker (HTTP request bodies, via <code>webRequest.onBeforeRequest</code>). By default it covers the meeting sites, or every site if you allow it.</li>
                        <li>Limit: it can't find a key that release code deliberately encrypts, compresses or splits before sending it. That's why it's paired with code verification (only signed release code runs) and the independent audit.</li>
                    </ul>`,
                flows: [
                    { e: 'mpros-tabz', rev: true, label: 'outgoing message', k: 'sig', at: 0, dur: 1200 },
                    { e: 'tabz-bg', label: 'outgoing request', k: 'sig', at: 300, dur: 900 },
                    { e: 'bg-leak', label: 'scan', k: 'sig', at: 1300, dur: 700 }
                ],
                inner: { leak: [ [ '', 0 ], [ '<b style="color:var(--ok)">0 keys found</b> in outgoing data', 2100 ] ] },
                state: { leak: [ 'ok', 2100 ] }
            },
            {
                scene: 'extension',
                title: 'The capture viewer',
                focus: [ 'cap', 'viewer' ],
                plain: `
                    <p>Save the capture to your computer and open it in the <b>capture viewer</b>, which works offline. It has six sections:</p>
                    <ol>
                        <li><b>What you received</b>, before and after E2EE was switched on: scrambled noise, and the same frames playing as real video once decrypted with the received keys.</li>
                        <li><b>The keys</b> your browser received.</li>
                        <li><b>How the keys travelled</b>: a timeline of every key-exchange message.</li>
                        <li><b>Did a key leave your browser?</b> The leak scan's results.</li>
                        <li><b>Who received your key?</b> Every recipient, checked against the participant list. A hidden recipient would be flagged.</li>
                        <li><b>Compare with another participant's capture</b>: if both of you hold each other's genuine identity keys, nobody sat in the middle.</li>
                    </ol>`,
                hood: `
                    <ul>
                        <li><code>inspector/frame-crypto.js</code> mirrors the library's frame format (HKDF → AES-GCM-128, ratchet window 8). Frames decrypt only if AES-GCM authentication succeeds. <code>containers.js</code> packs streams into <code>.ogg</code>/<code>.ivf</code>/<code>.h264</code> for VLC or ffplay. Playback uses WebCodecs.</li>
                        <li><code>compare.js</code>: an identity-key check in both directions, a <code>session-init</code> check, and a media-key check (each received key equals a key the other side generated). Same identity keys on both sides means no interception.</li>
                        <li>The attack kit uses this same comparison: <code>noInterception: true</code> on the honest run, <code>identity: fail</code> on the forge-everything run.</li>
                    </ul>`,
                inner: {
                    viewer: '<div class="scr"><div class="vid"><span class="tile noise"></span>received → <span class="tile"></span> decrypted</div></div>'
                },
                chips: { cap: [ [ 'contains test keys', 'warn' ] ] }
            }
        ]
    });

    // ================================================================ 11
    WT.chapters.push({
        id: 'chain',
        title: 'Your browser = the public code',
        steps: [
            {
                scene: 'chain',
                title: 'A chain of equal fingerprints',
                plain: `
                    <p>Here is the whole argument in one picture. Each arrow is a <b>fingerprint comparison anyone can repeat</b>:</p>
                    <ol>
                        <li>Jitsi's public source, plus APE Space's eight public patches, plus Olm from npm, rebuilt by <b>anyone</b> with <code>build.sh</code>, gives <b>six fingerprints</b>.</li>
                        <li>Those equal the fingerprints in the public <b>config.json</b>, and the ones in the <b>signed release</b>.</li>
                        <li>The signed release equals what <b>development and production serve</b> (verification page).</li>
                        <li>It equals what <b>your meeting actually loaded</b> (extension, every meeting).</li>
                    </ol>
                    <p>So the encryption code running in your browser is, byte for byte, code you can read and rebuild yourself.</p>`,
                hood: `
                    <p>Every link is independent of APE Space's say-so: GitHub hosts the source, npm hosts Olm, Sigstore and Rekor attest the signature, and your own browser computes the fingerprints. To lie, APE Space would have to break SHA-256, forge a Sigstore certificate for its CI workflow without leaving a public log entry, or serve different bytes to the checker than to the page, and the extension closes that last gap per meeting.</p>`,
                flows: [
                    { e: 'jitsi-rb', label: 'source', k: 'file', at: 0, dur: 900 },
                    { e: 'patches-rb', label: 'patches', k: 'file', at: 150, dur: 900 },
                    { e: 'olmnpm-rb', label: 'Olm', k: 'file', at: 300, dur: 900 },
                    { e: 'rb-fps', label: 'build', k: 'file', at: 1300, dur: 900 },
                    { e: 'fps-cfgx', label: '=', k: 'ok', at: 2300, dur: 800 },
                    { e: 'fps-manx', label: '=', k: 'ok', at: 2300, dur: 800 },
                    { e: 'manx-srvx', label: '=', k: 'ok', at: 3200, dur: 800 },
                    { e: 'manx-brx', label: '=', k: 'ok', at: 3200, dur: 800 },
                    { e: 'srvx-brx', label: '=', k: 'ok', at: 4100, dur: 800 }
                ],
                edges: [ 'cfgx-manx' ],
                state: { fps: [ 'ok', 2200 ], cfgx: [ 'ok', 3100 ], manx: [ 'ok', 3100 ], srvx: [ 'ok', 4000 ], brx: [ 'ok', 4900 ] },
                focus: [ 'srcz', 'rb', 'fps', 'cfgx', 'manx', 'srvx', 'brx' ]
            },
            {
                scene: 'chain',
                title: 'Only those files can run',
                focus: [ 'csp', 'cfgw', 'manx', 'brx' ],
                plain: `
                    <p>Checking files only helps if <b>nothing else</b> can run in the meeting page. Two rules make sure of it:</p>
                    <ul>
                        <li>The <b>meeting page itself</b> is a file of the signed release, and it carries a <b>security policy</b> that the browser enforces before any code runs. It allows only the release's own scripts: no injected code, no third-party scripts, no tricks like <code>eval</code>.</li>
                        <li>Each server's <b>settings file</b> is run in an isolated worker, away from the page. Only plain settings come back, never code, and the settings that decide how encryption works are fixed in the release.</li>
                    </ul>`,
                hood: `
                    <ul>
                        <li>The build expands every server-side include from release files, so the page for any room is exactly the release's <code>index.html</code>. The build fails if a page still uses a server-side include.</li>
                        <li>CSP: scripts from the meeting's own origin plus the page's inline scripts by hash. No <code>unsafe-eval</code>, no inline event handlers, no plugins, no other origins.</li>
                        <li><code>static/load-config.js</code> evaluates <code>config.js</code> and <code>interface_config.js</code> in a worker and returns plain settings. <code>e2ee.externallyManagedKey</code> is forced off whatever <code>config.js</code>, a link or the iframe API say.</li>
                        <li>Sandbox test: the page matched the release byte for byte, code added to <code>config.js</code> didn't run in the page, and injected inline and third-party scripts were blocked.</li>
                    </ul>`,
                state: { csp: 'ok', cfgw: 'ok' }
            },
            {
                scene: 'chain',
                title: 'Keys stay out of the app’s reach',
                focus: [ 'vaultx', 'appx' ],
                plain: `
                    <p>The APE Space app is closed source. So the design keeps it <b>away from the keys</b>: every key lives in the sandboxed <b>key vault</b>, built from public code, and media keys go straight from the vault to the encryption worker.</p>
                    <p>An auditor checking how keys are handled only needs to look at that small, open-source part.</p>`,
                hood: `
                    <p>See chapter 4, step 5. What the vault can't do: the page still shows decrypted video and plays the audio, and a deliberately malicious build could hook browser functions. That's why the remaining defences act on the build itself: one signed, identical release for everyone, the Inspector, and an independent audit.</p>`,
                state: { vaultx: 'ok' }
            },
            {
                scene: 'chain',
                title: 'What about the closed app?',
                focus: [ 'appx', 'manx', 'brx' ],
                plain: `
                    <p>For the closed-source part of the app, the proof is different but still concrete:</p>
                    <ul>
                        <li>It is <b>the same signed code for every customer</b>, so nobody can be given a special version without it showing.</li>
                        <li>The <b>Inspector</b> lets you watch that keys never leave your browser.</li>
                        <li>An <b>independent audit</b> can review it under a confidentiality agreement. Because releases are reproducible and signed, the audit can name the <b>exact release ID</b> it covers, and you can check you're running that release.</li>
                    </ul>`,
                hood: `
                    <p>Reproducible builds are what make an audit portable: the auditor reviews the source of one commit, the build of that commit has one release ID, and the verification page and extension tell each customer whether they are running that release ID.</p>`,
                chips: { appx: [ [ 'release ID = audit scope', 'info' ] ] }
            },
            {
                scene: 'chain',
                title: 'The promise, with its conditions',
                plain: `
                    <blockquote>APE Space cannot read your meeting, provided the verified release is running and participants confirm the safety number.</blockquote>
                    <ul>
                        <li><b>“the verified release is running”</b>: the verification page and the extension (chapters 9–11).</li>
                        <li><b>“participants confirm the safety number”</b>: the group number or emoji (chapters 5–6), which catch the one attack no protocol can stop on its own (chapter 7).</li>
                    </ul>
                    <p><b>What's not covered, stated plainly:</b></p>
                    <ul>
                        <li>Chat and private messages, polls, reactions, shared files, names, who joins and the meeting name are <b>not</b> end-to-end encrypted.</li>
                        <li>The servers can still see who is speaking and when, and how much the video changes, from the size and timing of the encrypted traffic.</li>
                        <li>The app doesn't remember people's keys between meetings, so compare the safety number or emoji in every sensitive meeting.</li>
                        <li>Someone who records a meeting's traffic today might decrypt it with a large quantum computer in the future.</li>
                        <li>The current production server doesn't run this release yet; its replacement, conference2, does (see chapter 8).</li>
                        <li>Encryption can't protect against malware on a participant's device, or a participant who records the meeting.</li>
                        <li>The mobile apps run this same meeting page inside the app. The app shell around it is outside these web checks.</li>
                        <li>The checks rely on GitHub and Sigstore working as designed. Both are public, widely used, and Sigstore's log can be audited by anyone.</li>
                    </ul>`,
                hood: `
                    <p>Where to check:</p>
                    <ul>
                        <li>Public repository: <code>github.com/hishd/apespace-public</code> (signed records, verification page source, extension, rebuild script, attack kit).</li>
                        <li>Verification page: <code>hishd.github.io/apespace-public</code>.</li>
                        <li>Sigstore log search: <code>search.sigstore.dev</code>.</li>
                        <li>Verify a record with Sigstore's own tool, without trusting APE Space's page:</li>
                    </ul>
<pre><code>cosign verify-blob \\
  --bundle releases/&lt;id&gt;/builds/&lt;record&gt;.json.sigstore.json \\
  --certificate-identity-regexp '^https://github\\.com/OFF-GRID-APPS/APESpace-Jitsi-Meet-WebApp/\\.github/workflows/build-docker-image\\.yml@refs/heads/(develop|staging|main|master)$' \\
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \\
  releases/&lt;id&gt;/builds/&lt;record&gt;.json
sha256sum releases/&lt;id&gt;/manifest.json   # must print &lt;id&gt;</code></pre>`,
                state: { fps: 'ok', cfgx: 'ok', manx: 'ok', srvx: 'ok', brx: 'ok', csp: 'ok', cfgw: 'ok', vaultx: 'ok' }
            }
        ]
    });
})();
