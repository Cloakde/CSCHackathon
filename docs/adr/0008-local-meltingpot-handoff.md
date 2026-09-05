# ADR 0008 — Local Synthetic MeltingPot Handoff

**Status:** Accepted for synthetic TASK-301–303 implementation; independently reviewed by `m3_review` at `5427e097ec73234e886f63049189cf136fcc7378`

## Decision

Implement the approved M3 journey using the existing LiveLecture service at `http://127.0.0.1:3000` and the isolated MeltingPot rework app at `http://127.0.0.1:3111`. Both remain a private, single-machine synthetic demo. There is no public authentication, account isolation, database, paid provider, recording, or persistent lecture storage in this implementation.

Keep all existing LiveLecture API and grounding schemas unchanged. The extension validates the existing completed-session response, then uses a closed destination setting: `prototype` keeps the existing `/sessions/:sessionId` route at port 3000; `meltingpot` derives `/lectures/:sessionId` at port 3111. A user-supplied redirect destination is never accepted. The packaged extension selects MeltingPot; the existing browser rehearsal retains the prototype, and a separately labeled MeltingPot rehearsal uses the same extension component. Finish and link opening remain distinct actions; an unavailable destination does not erase the finished session or its reopening link. Never silently fall back.

## MeltingPot Isolation

`LIVELECTURE_REWORK_ENABLED=true` activates an isolated mode before the inherited proxy creates an authentication client. The safe launcher rejects local environment files case-insensitively, removes inherited service settings, binds only `127.0.0.1:3111`, and starts with this mode enabled. The normal app is never started by this task.

The proxy covers every application/API route, including paths with file-like suffixes and encoded variants. In rework mode it allows only the canonical `/lectures` entry, `/lectures/:sessionId`, the exact lecture APIs below, and required own Next/static assets. Root may redirect to `/lectures`. It rejects inherited login, class, study, model, database, and admin routes before they run. Required assets are narrowly identified; an asset suffix alone is not a bypass. The original non-rework routing behavior is preserved. New lecture routes are unavailable when rework mode is off.

Rework responses use `Cache-Control: no-store` and a same-origin-only content security policy; inherited Supabase rewrites and external connect destinations are disabled. Set dynamic client navigation cache lifetime to zero in this mode. The private shell does not import authenticated dashboards, shared Pot study containers, analytics, or class reporting.

## Relay Contract

Browser calls stay on MeltingPot's own origin:

| Path                                | Method | Request                          | Upstream operation             |
| ----------------------------------- | ------ | -------------------------------- | ------------------------------ |
| `/api/lectures/:sessionId`          | GET    | No body                          | Existing session GET           |
| `/api/lectures/:sessionId`          | DELETE | No body                          | Existing session DELETE        |
| `/api/lectures/:sessionId/practice` | POST   | `{ confusionEventIds: [oneId] }` | Existing weak-area-drills POST |

Require mode enablement, exact wire Host `127.0.0.1:3111`, and the nonsecret `X-LiveLecture-Rework: synthetic-v1` header on every API request. Any supplied Origin must be exactly `http://127.0.0.1:3111`; a missing Origin remains within the documented local-machine trust boundary. Cross-origin preflights are rejected; no broad CORS is added. Validate the request again in the relay even when the proxy ran. Only the internal Next representation `localhost:3111` may be accepted in request URLs while retaining the exact wire Host/Origin checks, as in ADR 0006.

Reject queries, unknown/encoded operation paths, unsupported methods, invalid canonical IDs, bodies on GET/DELETE, and POST bodies over 1 KiB. Require JSON for POST. Bound total incoming-body reading to five seconds, including bodyless GET/DELETE validation, and reject stalled input. Bound each upstream operation, including body reading, to five seconds and each response to 256 KiB. Abort upstream work on cancellation; do not follow redirects. Bound request rates to 240 per minute per process. Failures return fixed safe messages and existing API error envelopes, not raw upstream errors.

The server relay calls only the fixed LiveLecture origin and its three known operations. Send `X-LiveLecture-Demo: scripted-v1`, JSON content type when needed, and no incoming cookies, Authorization, Origin, forwarding headers, or arbitrary URL. Use `credentials: omit`, `redirect: error`, and `cache: no-store`. LiveLecture's existing CORS/origin/header restrictions are not widened.

## Data and Lifetime

Consume the existing `SessionView`, `WeakAreaDrillResponse`, API envelopes, stable IDs, and `assertWeakAreaDrillLinkage` from a narrowly vendored runtime-schema package. Copy schema source files byte-for-byte from the pinned LiveLecture base, record hashes and origin, and verify parity during paired checks. Do not maintain a second handwritten wire schema or import the storage/AI implementation into MeltingPot.

Validate both relay and browser boundaries. A review must match the requested session ID, be `simulation`, and be `completed`. Practice must match the selected confusion event and its concept/evidence in that same validated view. The relay reads and validates the session around practice generation to reject active, deleted, expired, mismatched, or stale results; it must never substitute another session. Resolve displayed citation timestamps/text only from validated chunks.

No new server session store, browser storage, shared-class writes, or reporting is added. Answers exist only in React memory. Selection/session changes cancel prior work and clear the exercise; generation checks discard late responses. Confirmed deletion clears view, practice, answer, and citation state and delegates deletion to LiveLecture. Unavailable/deleted-session errors clear stale private content. A citation opens and focuses its passage with a way back to the practice; it preserves the current answer. Sharing with a class is outside this task.

## Evidence

Keep simulation and prewritten-help disclosures separate and visible. The private label describes this local demo boundary, not production user authentication. Test two genuinely different concepts, source linkage, practice feedback, citation focus/return, retries, reset/deletion, response races, and rejection of inherited-service routes. No browser automation or human acceptance is authorized by this implementation request.

Paired automated checks use the exact MeltingPot candidate and delivered extension component. A production HTTP smoke may explicitly reuse the existing local LiveLecture server only after proving its backend source is byte-identical to the candidate backend; it creates and deletes only its own synthetic sessions and records that server's revision separately. CI still runs the full LiveLecture check on the exact candidate with its own production server. Do not stop the user's current demo or claim that a reused server is a new deployment. Human Chrome, learner/content, actual AI, and judge-access evidence remain pending and continue to gate M4/release claims.
