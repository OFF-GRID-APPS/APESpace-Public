# Review of published security claims

_Review of 13 November 2026, against the audit readiness checklist. Answers checklist row OPS-04. Next review: before any change to these documents is published, and whenever a claim's checklist row changes status._

**What was reviewed.**
- The customer explainer, "How APESpace proves its meetings are end-to-end encrypted".
- This repository's README.
- The verification page.
- The extension's README.
- The documents in `docs/`.

**The method.**
- Each claim was compared with what the checklist work established and tested.
- A claim was corrected when it was wrong or out of date.
- A claim was qualified when it needs a condition to be true.

## Corrected

| Where | Claim | Problem | Now |
|---|---|---|---|
| README | Signed records of what each environment served, under `environments/<env>/` | No such records are published | Removed. Added the folders that do exist: `docs/`, `e2ee-attacks/` and the SBOM files |
| Verification page | The encryption library is Jitsi's "plus a public security patch" | There are eight public patches | "plus public patches" |
| Explainer | The library is lib-jitsi-meet "plus one public security fix", with fingerprint `72eb1f6e…` | Out of date: eight patches, new fingerprint | Lists the eight changes, fingerprint `686d5d75…` |
| Explainer | "In our latest check, all 302 compared files were identical on both environments" | Production now runs an earlier release and fails the check | States the current state: development verified (323 files), production on an earlier release until updated |
| Explainer | The meeting page isn't compared with the release | The meeting page is now static and signed, and is compared | Only the two settings files aren't compared, and they can't change how encryption works |
| Explainer | "Everyone needs … recent Chrome or Edge. Phone dial-in can't join." | APESpace has no dial-in at all. Clients that can't encrypt now leave. Firefox and Safari aren't yet confirmed. | Chrome, Edge and the APESpace app; says Firefox and Safari are still being confirmed, and that a client that can't encrypt leaves and why |

## Qualified

| Explainer claim | Condition added |
|---|---|
| "Only the people in your meeting can see and hear it" | Two conditions are stated up front: the browser runs the signed release, and for sensitive meetings participants compare the safety number or the emoji |
| "The keys can't be hijacked" | Now "an attempt to intercept the keys can't go unnoticed … as long as participants compare them" |
| "A person who has left can't listen in later" | Keys change about five seconds after someone leaves; until then the old key still works (stated in the limits table) |
| Chat, names and meeting details aren't encrypted | Extended to everything the review found unencrypted: private messages, polls, reactions and shared files |
| "Proof 3 … checks what our servers deliver" | Added that code altered for one person can't be detected without the extension |

## Added, so the limits match the checklist

| Limit | Checklist row |
|---|---|
| Your app doesn't remember people's keys between meetings, so compare in every sensitive meeting | KEY-02, IDN-04 |
| Recorded traffic might be decrypted by a future quantum computer | KEY-08 |
| Code sent to one person: without the extension, a user can't tell | REL-05 |
| The in-app fingerprints make comparing easy, but aren't proof | CLI-05 |

Protections that were missing from the explainer, now described:
- newcomers can't read earlier media;
- replays are rejected;
- hidden participants get no keys;
- server recording, streaming and transcription are blocked;
- only the host can switch encryption off, and everyone is warned when they do;
- the safety number.

## Confirmed as accurate

| Claim | Evidence |
|---|---|
| Keys are created on participants' devices and never sent to the servers | Malicious-server tests: 0 keys obtained from honest clients. Leak scan: no key in any outgoing message. |
| The servers pass along media they can't read | Media path test: 947 of 947 forwarded frames encrypted end to end |
| Nothing is sent unencrypted while encryption starts | Switch-on hold in the app; unsupported clients leave before sending media |
| The AI recorder is blocked during end-to-end encryption | App controls (SRV-05), and the AI service isn't contacted during encrypted meetings |
| Every release is signed by the build workflow, logged in Rekor, and published here | Signed release records and the verification checks |
| The encryption library rebuilds byte for byte | `e2ee-module/build.sh` reproduces all six served files |
| The extension checks every file the user's own meeting loads | The extension's code check |
| Participants' devices are outside the guarantee | Explainer limits table and `docs/device-security.md` |
