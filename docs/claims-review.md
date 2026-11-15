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
- A claim was brought up to date when it no longer matched the current release.
- A claim was qualified when it needs a condition to be true.

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
| The servers can see who is speaking and when, and how active the video is, from the traffic's size and timing | MET-02 |

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
