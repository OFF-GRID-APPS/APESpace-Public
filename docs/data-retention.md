# What APE Space keeps about meetings, and for how long

_Status: draft for APE Space approval · 15 November 2026. For checklist rows MET-01 (who met whom), MET-03 (logs and backups) and MET-04 (meeting names, display names and addresses)._

End-to-end encryption protects what is said and shown in a meeting. It doesn't hide the fact that a meeting happened. To run meetings, APE Space's servers handle meeting details and participants' names and addresses. This document says what is kept, and for how long.

## What is kept

| Data | Where | What it contains | Kept for |
|---|---|---|---|
| Meeting server logs | The meeting servers (web server, signalling, video bridge) | Meeting room names, participant IDs, display names, IP addresses, join and leave times | Deleted every 3 days |
| Meeting records | The APE Space backend database | Meeting details (title, schedule), participants' email addresses | Until the meeting's access ends (meeting end + 30 minutes; instant meetings: 30 minutes after creation). A daily job then deletes every expired record, so a record goes within about 24 hours of its access ending. |
| Database snapshots | APE Space's storage server | Copies of the backend database, every 10 minutes | 7 days. Only authorised server administrators can access them. |
| AI recorder service | A separate service, development releases only | Join and leave events, and audio while the AI recorder is on | Not used in production. It is never used in end-to-end encrypted meetings. |

**The longest any meeting detail is kept.** A meeting record deleted from the database still exists in snapshots for up to 7 days. So meeting details and participants' email addresses are kept for at most about **8 days after the meeting's access ends**. Server logs are kept for at most **3 days**.

**Never kept by APE Space.** The audio, video and screen sharing of an end-to-end encrypted meeting. The servers forward it encrypted, and never hold the keys.

## What the servers learn about a meeting

Even with end-to-end encryption, the servers learn:
- who joined which meeting, when, and for how long;
- display names, and the IP address each participant connected from;
- traffic patterns: who is speaking and when, and how active the video is (but not what is said or shown);
- everything sent in chat, polls, reactions and shared files, which aren't end-to-end encrypted.

## Deletion

- **The jobs.** The log sweep and the meeting-record sweep run automatically, every 3 days and every 24 hours.
- **No run record yet.** The jobs don't yet record their runs. A log line per run (time, number of entries or records deleted) would let deletion be shown to an auditor.
