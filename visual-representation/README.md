# APE Space E2EE walkthrough

An interactive, step-by-step explainer of how APE Space meetings are end-to-end encrypted, how attacks are caught, and how anyone can check the code.

## Open it

Online: <https://off-grid-apps.github.io/APESpace-Public/visual-representation/>.

From a copy of this repository: open `index.html` in a browser (double-click it). It needs no server, no build step and no internet connection.

- **Next / Back**, the arrow keys, or the chapter list move between steps.
- `p` pauses and resumes the animation, and `r` replays the current step.
- **Speed** (next to the replay button) sets the animation speed from 0.25× to 2×. The `−` and `+` keys do the same. The choice is remembered in that browser.
- Each step has a plain explanation and a collapsible **Under the hood** panel for technical reviewers.
- A step can be linked directly: `index.html#7-5` opens chapter 7, step 5.

## Chapters

1. The big picture
2. Joining a meeting (host and guest)
3. A meeting without E2EE
4. Turning on E2EE (identity keys, sealed channels, media keys, key vault, encrypted media, join and leave)
5. Emoji verification
6. The group safety number
7. Attacks, and how they're caught (the `e2ee-attacks` kit)
8. Shipping a new release (CI, reproducible build, Sigstore, public repository, develop → master)
9. The verification page
10. The browser extension (code check, Inspector, leak scan, capture viewer)
11. Your browser = the public code (the chain of fingerprints, and the stated limits)

## Edit it

| File | What it holds |
|---|---|
| `js/scenes.js` | Diagram layouts: components (nodes) and connections (edges) on a 1200 × 700 canvas |
| `js/steps-meeting.js` | Chapters 1–6 |
| `js/steps-attacks.js` | Chapter 7 |
| `js/steps-release.js` | Chapters 8–11 |
| `js/glossary.js` | Glossary entries |
| `js/engine.js` | Rendering, animation and navigation |
| `css/styles.css` | Colours (light and dark), layout |

Each step is a plain object: `title`, `plain` and `hood` (HTML text), `focus` (components to highlight), `flows` (moving messages: edge, label, kind, start time and duration in ms), and optional `state`, `chips`, `inner`, `labels` and `notes`. The comment at the top of `steps-meeting.js` lists every field.

Fingerprints, release IDs, emoji and safety numbers shown are real values from the November 2026 development builds and attack-kit runs. Update them when releases change.
