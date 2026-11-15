// Walkthrough engine: draws a scene, applies a step (focus, states, chips, notes,
// moving messages) and handles navigation. Classic script, so the page also
// works when opened straight from disk (file://).
(function () {
    'use strict';

    const W = 1200;
    const H = 700;
    const $ = (s, r = document) => r.querySelector(s);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const ICONS = { plain: '🎥', hop: '🔒', enc: '🔐', key: '🗝️', sig: '✉️', file: '📄', bad: '⚠️', ok: '✓', sas: '🔏' };
    const KIND_LEGEND = {
        plain: 'Readable media',
        hop: 'Link-encrypted (the server can unlock it)',
        enc: 'End-to-end encrypted media',
        key: 'Key inside a sealed channel',
        sig: 'Signalling message',
        file: 'File or record',
        sas: 'Verification message',
        bad: 'Forged or rejected',
        ok: 'Check passed'
    };
    const TONE_LEGEND = {
        closed: 'Closed source (signed)',
        public: 'Open source / public',
        vault: 'Key vault',
        server: 'APE Space servers',
        attacker: 'Attacker',
        sigstore: 'Sigstore / trust anchors',
        github: 'GitHub',
        ci: 'Build system (CI)',
        inspector: 'Inspector (test meetings)'
    };

    const store = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
    };

    const el = {};
    const flat = [];
    let cur = -1;
    let sceneId = null;
    let nodes = {};
    let edges = {};
    let parentOf = {};
    let childrenOf = {};
    let packets = [];
    let reveals = [];
    let elapsed = 0;
    let lastTs = 0;
    let playing = true;
    let speed = 1;
    const SPEEDS = [ 0.25, 0.5, 0.75, 1, 1.5, 2 ];
    let cycle = 4000;

    // ------------------------------------------------------------ geometry
    function anchor(n, side, fx, fy) {
        switch (side) {
        case 'l': return [ n.x, fy ?? n.y + n.h / 2 ];
        case 'r': return [ n.x + n.w, fy ?? n.y + n.h / 2 ];
        case 't': return [ fx ?? n.x + n.w / 2, n.y ];
        default: return [ fx ?? n.x + n.w / 2, n.y + n.h ];
        }
    }

    function autoSides(a, b) {
        if (a.x + a.w <= b.x) return [ 'r', 'l' ];
        if (b.x + b.w <= a.x) return [ 'l', 'r' ];

        return b.y > a.y ? [ 'b', 't' ] : [ 't', 'b' ];
    }

    function routeOf(e) {
        if (e.pts) return e.pts;
        const a = nodes[e.a];
        const b = nodes[e.b];
        const [ sa, sb ] = e.as && e.bs ? [ e.as, e.bs ] : autoSides(a, b);

        return [ anchor(a, sa, e.ax, e.ay), anchor(b, sb, e.bx, e.by) ];
    }

    function measure(pts) {
        const segs = [];
        let total = 0;

        for (let i = 1; i < pts.length; i++) {
            const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);

            segs.push(len);
            total += len;
        }

        return { segs, total };
    }

    function pointAt(e, f) {
        let d = Math.max(0, Math.min(1, f)) * e.total;

        for (let i = 0; i < e.segs.length; i++) {
            if (d <= e.segs[i] || i === e.segs.length - 1) {
                const t = e.segs[i] ? d / e.segs[i] : 0;
                const p0 = e.pts[i];
                const p1 = e.pts[i + 1];

                return [ p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t ];
            }
            d -= e.segs[i];
        }

        return e.pts[e.pts.length - 1];
    }

    // ------------------------------------------------------------ scene
    function nodeHTML(n) {
        if (n.kind === 'zone') {
            return `<div class="zlabel"><span>${n.icon ?? ''}</span><span class="zl">${n.label}</span>${
                n.sub ? `<small>${n.sub}</small>` : ''}</div>`;
        }

        return `<div class="nhead"><span class="ico">${n.icon ?? ''}</span><span class="nlabel">${n.label}</span></div>`
            + `<div class="nsub">${n.sub ?? ''}</div><div class="ninner"></div><div class="chips"></div>`;
    }

    function inside(n, z) {
        const cx = n.x + n.w / 2;
        const cy = n.y + n.h / 2;

        return cx > z.x && cx < z.x + z.w && cy > z.y && cy < z.y + z.h;
    }

    function buildScene(id) {
        const sc = WT.scenes[id];

        sceneId = id;
        nodes = {};
        edges = {};
        parentOf = {};
        childrenOf = {};
        el.nodes.innerHTML = '';
        el.edges.innerHTML = '';

        const order = { zone: 0, box: 1, tag: 2 };
        const list = sc.nodes.map(n => ({ kind: 'box', ...n }))
            .sort((a, b) => order[a.kind] - order[b.kind]);

        // Parent zones (smallest containing zone).
        const zones = list.filter(n => n.kind === 'zone');

        for (const n of list) {
            const host = zones.filter(z => z !== n && inside(n, z)).sort((a, b) => a.w * a.h - b.w * b.h)[0];

            if (host) {
                parentOf[n.id] = host.id;
                (childrenOf[host.id] ??= []).push(n.id);
            }
        }

        for (const n of list) {
            const d = document.createElement('div');

            d.className = `${n.kind === 'zone' ? 'zone' : `node ${n.kind}`}${n.layout === 'row' ? ' row' : ''} tone-${n.tone ?? 'neutral'}`;
            Object.assign(d.style, { left: `${n.x}px`, top: `${n.y}px`, width: `${n.w}px`, height: `${n.h}px` });
            d.innerHTML = nodeHTML(n);
            d.dataset.id = n.id;
            el.nodes.appendChild(d);
            nodes[n.id] = { ...n, el: d };
        }

        const ns = 'http://www.w3.org/2000/svg';

        for (const e of sc.edges) {
            const pts = routeOf(e);
            const path = document.createElementNS(ns, 'path');

            path.setAttribute('d', pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' '));
            path.setAttribute('class', `edge k-${e.kind ?? 'internal'}`);
            el.edges.appendChild(path);

            const m = measure(pts);
            const rec = { ...e, pts, ...m, path };

            if (e.label) {
                const t = document.createElementNS(ns, 'text');
                const [ x, y ] = pointAt(rec, 0.5);

                t.setAttribute('x', x);
                t.setAttribute('y', y - 6);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('class', 'edge-label');
                t.textContent = e.label;
                el.edges.appendChild(t);
                rec.labelEl = t;
            }
            edges[e.id] = rec;
        }
    }

    function expandFocus(ids) {
        const set = new Set();
        const addDown = id => {
            set.add(id);
            (childrenOf[id] ?? []).forEach(addDown);
        };

        for (const id of ids) {
            addDown(id);
            let p = parentOf[id];

            while (p) {
                set.add(p);
                p = parentOf[p];
            }
        }

        return set;
    }

    // ------------------------------------------------------------ step
    function timed(v) {
        // A value may be given as [value, atMs] to appear later in the step.
        return Array.isArray(v) && typeof v[1] === 'number' && v.length === 2 && typeof v[0] !== 'object'
            ? { v: v[0], at: v[1] } : { v, at: 0 };
    }

    function chipHTML(c) {
        const [ text, k = 'info' ] = c;

        return `<span class="chip k-${k}">${text}</span>`;
    }

    function applyStep(i) {
        const { s } = flat[i];

        if (s.scene !== sceneId) buildScene(s.scene);

        const show = new Set(s.show ?? []);
        const focus = s.focus ? expandFocus(s.focus) : null;

        reveals = [];

        for (const n of Object.values(nodes)) {
            const d = n.el;
            const hidden = Boolean(n.optional) && !show.has(n.id);

            n.hidden = hidden;
            d.classList.toggle('hidden', hidden);
            d.classList.toggle('dim', Boolean(focus) && !focus.has(n.id));
            d.classList.remove('st-ok', 'st-bad', 'st-warn', 'st-hot', 'st-off');

            const st = s.state?.[n.id];

            if (st) {
                const { v, at } = timed(st);

                if (at) reveals.push({ at, fn: on => d.classList.toggle(`st-${v}`, on) });
                else d.classList.add(`st-${v}`);
            }

            if (n.kind === 'zone') {
                const lbl = s.labels?.[n.id];

                d.querySelector('.zl').innerHTML = lbl?.label ?? n.label;
                continue;
            }

            const lbl = s.labels?.[n.id] ?? {};

            d.querySelector('.nlabel').innerHTML = lbl.label ?? n.label;
            d.querySelector('.ico').innerHTML = lbl.icon ?? n.icon ?? '';
            d.querySelector('.nsub').innerHTML = lbl.sub ?? n.sub ?? '';

            const inner = d.querySelector('.ninner');
            const iv = s.inner?.[n.id];

            inner.innerHTML = '';
            if (iv !== undefined) {
                const list = Array.isArray(iv) ? iv : [ iv ];

                // inner: 'html' | [['html', atMs], ...] (later entries replace earlier ones)
                list.forEach(item => {
                    const { v, at } = typeof item === 'string' ? { v: item, at: 0 } : { v: item[0], at: item[1] };

                    if (!at) inner.innerHTML = v;
                    else reveals.push({ at, fn: on => { if (on) inner.innerHTML = v; } });
                });
            }

            const chips = d.querySelector('.chips');

            chips.innerHTML = '';
            for (const c of s.chips?.[n.id] ?? []) {
                const at = c[2] ?? 0;
                const wrap = document.createElement('span');

                wrap.innerHTML = chipHTML(c);
                const chip = wrap.firstChild;

                chips.appendChild(chip);
                if (at) {
                    chip.style.display = 'none';
                    reveals.push({ at, fn: on => { chip.style.display = on ? '' : 'none'; } });
                }
            }
        }

        const flows = s.flows ?? [];
        const active = new Set([ ...(s.edges ?? []), ...flows.map(f => f.e) ]);

        for (const e of Object.values(edges)) {
            const hidden = nodes[e.a]?.hidden || nodes[e.b]?.hidden;
            const cls = e.path.classList;

            cls.toggle('hidden', Boolean(hidden));
            cls.toggle('active', active.has(e.id));
            cls.toggle('dim', Boolean(focus) && !active.has(e.id));
            cls.remove('st-bad', 'st-ok');
            const st = s.edgeState?.[e.id];

            if (st) {
                const { v, at } = timed(st);

                if (at) reveals.push({ at, fn: on => cls.toggle(`st-${v}`, on) });
                else cls.add(`st-${v}`);
            }
            if (e.labelEl) {
                e.labelEl.classList.toggle('hidden', Boolean(hidden));
                e.labelEl.classList.toggle('dim', Boolean(focus) && !active.has(e.id));
            }
        }

        // Notes on the stage.
        el.overlay.innerHTML = '';
        for (const nt of s.notes ?? []) {
            const d = document.createElement('div');

            d.className = `note k-${nt.k ?? 'info'}${nt.big ? ' big' : ''}`;
            Object.assign(d.style, { left: `${nt.x}px`, top: `${nt.y}px`, width: nt.w ? `${nt.w}px` : '' });
            d.innerHTML = nt.html;
            el.overlay.appendChild(d);
            const at = nt.at ?? 0;

            reveals.push({ at, fn: on => d.classList.toggle('show', on) });
        }

        // Moving messages.
        el.packets.innerHTML = '';
        packets = flows.filter(f => edges[f.e]).map((f, idx) => {
            const d = document.createElement('div');
            const k = f.k ?? 'sig';
            const icon = f.icon ?? ICONS[k] ?? '';

            d.className = `pkt k-${k}`;
            d.innerHTML = `${icon ? `<span>${icon}</span>` : ''}<span>${f.label ?? ''}</span>`;
            el.packets.appendChild(d);

            return { ...f, idx, at: f.at ?? 0, dur: f.dur ?? 1500, el: d, edge: edges[f.e] };
        });
        const end = packets.reduce((m, p) => Math.max(m, p.at + p.dur), 0);

        cycle = s.cycle ?? Math.max(3000, end + 1800);
        elapsed = 0;
        reveals.forEach(r => r.fn(r.at === 0));
        render(0);
    }

    // ------------------------------------------------------------ animation
    function render(dt) {
        if (playing && !reduceMotion.matches) elapsed += dt * speed;
        const still = reduceMotion.matches;
        const t = still ? Infinity : elapsed;

        for (const r of reveals) {
            if (r.at > 0) r.fn(t >= r.at);
        }

        const tc = still ? 0 : (flat[cur]?.s.once && elapsed > cycle ? cycle - 1 : elapsed % cycle);

        // Without motion, show only the latest message on each line, half-way along it.
        const latest = {};

        if (still) {
            for (const p of packets) {
                const key = `${p.e}|${Boolean(p.rev)}`;

                if (!latest[key] || p.at >= latest[key].at) latest[key] = p;
            }
        }

        for (const p of packets) {
            let f;
            let op;

            if (still) {
                if (latest[`${p.e}|${Boolean(p.rev)}`] !== p) {
                    p.el.style.opacity = 0;
                    continue;
                }
                f = 0.5;
                op = 1;
            } else {
                f = (tc - p.at) / p.dur;
                if (f < 0 || f > 1) {
                    p.el.style.opacity = 0;
                    continue;
                }
                op = Math.min(1, f / 0.08, (1 - f) / 0.08);
            }
            const [ x, y ] = pointAt(p.edge, p.rev ? 1 - f : f);

            p.el.style.opacity = op;
            p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        }
    }

    function tick(ts) {
        const dt = lastTs ? Math.min(100, ts - lastTs) : 0;

        lastTs = ts;
        render(dt);
        requestAnimationFrame(tick);
    }

    // ------------------------------------------------------------ layout
    function fit() {
        const w = el.wrap.clientWidth;
        // On narrow screens keep the diagram readable and let it pan sideways in its frame.
        const k = Math.max(w / W, w < 760 ? 0.58 : 0);

        el.stage.style.transform = `scale(${k})`;
        el.wrap.style.height = `${Math.round(H * k)}px`;
        el.wrap.classList.toggle('pan', k > w / W + 0.001);
        el.sizer.style.width = `${Math.round(W * k)}px`;
    }

    // ------------------------------------------------------------ story & nav
    function renderStory() {
        const { c, s, ci, si } = flat[cur];
        const hoodOpen = store.get('wt-hood') === '1';
        const prev = flat[cur - 1];
        const next = flat[cur + 1];

        el.story.innerHTML = `
            <div class="kicker">Chapter ${ci + 1} · ${c.title} — step ${si + 1} of ${c.steps.length}</div>
            <h2>${s.title}</h2>
            <div class="plain">${s.plain ?? ''}</div>
            ${s.hood ? `<details class="hood"${hoodOpen ? ' open' : ''}>
                <summary>Under the hood <span class="tag">for technical reviewers</span></summary>
                <div class="hood-body">${s.hood}</div></details>` : ''}
            <div class="step-nav">
                ${prev ? `<button class="prev" data-go="${cur - 1}">← ${prev.s.title}</button>` : '<span></span>'}
                ${next ? `<button class="next" data-go="${cur + 1}">${next.s.title} →</button>` : ''}
            </div>`;
        const d = el.story.querySelector('.hood');

        d?.addEventListener('toggle', () => store.set('wt-hood', d.open ? '1' : '0'));
        el.story.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(Number(b.dataset.go), true)));
    }

    function buildNav() {
        el.chapters.innerHTML = WT.chapters.map((c, ci) => `
            <li class="chapter" data-ci="${ci}">
                <button data-first="${ci}"><span class="num">${ci + 1}</span><span>${c.title}</span></button>
                <ol class="steps">${c.steps.map((s, si) =>
                    `<li><button data-step="${flat.findIndex(f => f.ci === ci && f.si === si)}">${s.title}</button></li>`).join('')}</ol>
            </li>`).join('');
        el.chapters.addEventListener('click', ev => {
            const b = ev.target.closest('button');

            if (!b) return;
            if (b.dataset.first !== undefined) go(flat.findIndex(f => f.ci === Number(b.dataset.first)));
            else if (b.dataset.step !== undefined) go(Number(b.dataset.step));
            closeNav();
        });
    }

    function updateNav() {
        const { ci, si, c } = flat[cur];

        el.chapters.querySelectorAll('.chapter').forEach(li => {
            li.classList.toggle('current', Number(li.dataset.ci) === ci);
        });
        el.chapters.querySelectorAll('[data-step]').forEach(b => {
            if (Number(b.dataset.step) === cur) b.setAttribute('aria-current', 'step');
            else b.removeAttribute('aria-current');
        });
        el.dots.innerHTML = c.steps.map((s, i) => `<button class="dot" role="tab" aria-selected="${i === si}"
            aria-label="Step ${i + 1}: ${s.title.replace(/"/g, '&quot;')}" title="${s.title.replace(/"/g, '&quot;')}"
            data-go="${flat.findIndex(f => f.ci === ci && f.si === i)}"></button>`).join('');
        el.counter.textContent = `${cur + 1} / ${flat.length}`;
        el.prev.disabled = cur === 0;
        el.next.disabled = cur === flat.length - 1;
    }

    function renderLegend() {
        const { s } = flat[cur];
        const kinds = [ ...new Set((s.flows ?? []).map(f => f.k ?? 'sig')) ];
        const tones = [ ...new Set(Object.values(nodes)
            .filter(n => !n.hidden && !n.el.classList.contains('dim') && n.kind !== 'zone')
            .map(n => n.tone)) ].filter(t => TONE_LEGEND[t]);

        el.legend.innerHTML = [
            ...kinds.filter(k => KIND_LEGEND[k]).map(k =>
                `<span class="item"><span class="pkt-sw chip k-${k === 'sas' ? 'key' : k === 'hop' ? 'info' : k}">${ICONS[k]}</span>${KIND_LEGEND[k]}</span>`),
            ...tones.map(t => `<span class="item"><span class="sw tone-${t}"></span>${TONE_LEGEND[t]}</span>`)
        ].join('');
    }

    function go(i, scroll) {
        if (i < 0 || i >= flat.length) return;
        cur = i;
        applyStep(i);
        renderStory();
        updateNav();
        renderLegend();
        const { ci, si } = flat[i];
        const hash = `#${ci + 1}-${si + 1}`;

        if (location.hash !== hash) history.replaceState(null, '', hash);
        if (scroll) el.stageCard.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }

    function fromHash() {
        const m = location.hash.match(/^#(\d+)-(\d+)$/);

        if (!m) return 0;
        const idx = flat.findIndex(f => f.ci === Number(m[1]) - 1 && f.si === Number(m[2]) - 1);

        return idx < 0 ? 0 : idx;
    }

    function setPlaying(on) {
        playing = on;
        el.play.textContent = on ? '⏸' : '▶';
        el.play.setAttribute('aria-label', on ? 'Pause animation' : 'Play animation');
    }

    function setSpeed(v) {
        speed = v;
        el.speed.value = String(v);
        store.set('wt-speed', String(v));
    }

    function openNav() {
        el.nav.classList.add('open');
        el.scrim.hidden = false;
        el.navToggle.setAttribute('aria-expanded', 'true');
    }

    function closeNav() {
        el.nav.classList.remove('open');
        el.scrim.hidden = true;
        el.navToggle.setAttribute('aria-expanded', 'false');
    }

    function cycleTheme() {
        const order = [ undefined, 'light', 'dark' ];
        const now = document.documentElement.dataset.theme;
        const nextT = order[(order.indexOf(now) + 1) % order.length];

        if (nextT) document.documentElement.dataset.theme = nextT;
        else delete document.documentElement.dataset.theme;
        store.set('wt-theme', nextT ?? '');
        el.theme.title = `Theme: ${nextT ?? 'automatic'}`;
    }

    // ------------------------------------------------------------ init
    function init() {
        Object.assign(el, {
            stage: $('#stage'), wrap: $('#stageWrap'), sizer: $('#stageSizer'), stageCard: $('.stage-card'), edges: $('#edges'), nodes: $('#nodes'),
            overlay: $('#overlay'), packets: $('#packets'), story: $('#story'), chapters: $('#chapters'),
            dots: $('#dots'), counter: $('#counter'), prev: $('#prevBtn'), next: $('#nextBtn'), play: $('#playBtn'),
            replay: $('#replayBtn'), legend: $('#legend'), nav: $('#nav'), scrim: $('#navScrim'),
            navToggle: $('#navToggle'), theme: $('#themeBtn'), speed: $('#speedSel')
        });

        WT.chapters.forEach((c, ci) => c.steps.forEach((s, si) => flat.push({ c, s, ci, si })));

        buildNav();
        fit();
        new ResizeObserver(fit).observe(el.wrap);

        el.prev.addEventListener('click', () => go(cur - 1));
        el.next.addEventListener('click', () => go(cur + 1));
        el.play.addEventListener('click', () => setPlaying(!playing));
        el.replay.addEventListener('click', () => { applyStep(cur); setPlaying(true); });
        el.dots.addEventListener('click', ev => {
            const b = ev.target.closest('[data-go]');

            if (b) go(Number(b.dataset.go));
        });
        el.navToggle.addEventListener('click', () => (el.nav.classList.contains('open') ? closeNav() : openNav()));
        el.scrim.addEventListener('click', closeNav);
        el.theme.addEventListener('click', cycleTheme);

        const saved = Number(store.get('wt-speed'));

        setSpeed(SPEEDS.includes(saved) ? saved : 1);
        el.speed.addEventListener('change', () => setSpeed(Number(el.speed.value)));

        const dlg = $('#glossary');

        $('#glossaryList').innerHTML = WT.glossary.map(([ t, d ]) => `<dt>${t}</dt><dd>${d}</dd>`).join('');
        $('#glossaryBtn').addEventListener('click', () => dlg.showModal());

        document.addEventListener('keydown', ev => {
            if (ev.target.closest('input, textarea, select') || dlg.open || ev.metaKey || ev.ctrlKey || ev.altKey) return;
            if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { go(cur + 1); ev.preventDefault(); }
            else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { go(cur - 1); ev.preventDefault(); }
            else if (ev.key === 'p' || ev.key === 'k') setPlaying(!playing);
            else if (ev.key === 'r') { applyStep(cur); setPlaying(true); }
            else if (ev.key === '+' || ev.key === '=') setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)]);
            else if (ev.key === '-' || ev.key === '_') setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)]);
            else if (ev.key === 'Escape') closeNav();
        });
        window.addEventListener('hashchange', () => go(fromHash()));

        go(fromHash());
        requestAnimationFrame(tick);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
