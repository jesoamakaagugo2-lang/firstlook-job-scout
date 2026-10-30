# Firstlook
Private job scouting desk for Jesoamaka Agugo. Source and deployment managed by Sites.

## Scheduled writer
The owner-private platform boundary protects every endpoint. Never make this Site public without adding endpoint authorization.
Retrieve current Site with native get_site using the persisted project_id. Obtain the supported siwc_bypass_bearer_token and send only to this Site as OAI-Sites-Authorization: Bearer <token>. Never persist or output it. If absent, stop and report the access failure; do not fabricate a successful scan.
GET /api/scout returns the search brief, persistent jobs, reports, history, and action statuses.
POST /api/scout accepts {runId,summary,jobs,sources,notes?,history?,type?}. A run ID is idempotent; use a unique UTC-hour ID per scan, retaining it on retries. Each job requires company,role,url,evidence,eligibility ('confirmed' or 'unconfirmed' or 'ineligible'),postedAt (ISO timestamp or null),openVerified (boolean),historyCheck ('clear' or 'prior application' or 'prior rejection' or 'unconfirmed'),location,salary,notes. Never invent an hour when only a day is available; use null and explain the date evidence. Keep ambiguous timestamps out of the fresh feed. Record source URLs and coverage failures in sources. Zero matches still require a report.

Fresh feed additionally requires a verified posting within 24 hours, confirmed eligibility, open vacancy and clear history. The page reevaluates age so stale roles age out. First seen and last verified are separate fields. Matching URLs deduplicate; agents must also compare employer, role and requisition to catch alternate URLs and reposts. The new URL must be an official employer or ATS application page. Existing user statuses take precedence.

## Source policy
Search employer pages, ATS and accessible public recruiter/founder posts on LinkedIn, X, Reddit, Threads, Bluesky, Instagram and TikTok. Do not bypass sign-in, CAPTCHA, restrictions or paywalls. Never claim entire-internet coverage or applicant rank. Avoid talent pools, closed roles, reposts with old original dates, mismatched geography and paid application services. Treat unsupported social platforms as coverage gaps.

## Application history
Authoritative October tracker: libfile_dfdd33c3255081919b697aeef76ea59f. Read through Library when available to resolve exact company+role history before recommendations. Import rows via history with company,role,status; retain uncertain submissions as unconfirmed. Current desk action statuses override older tracker entries. No outgoing applications or messages are authorized by scouting.

## Verification
TypeScript check; Sites build; schema migration; browser visual and navigation checks; authenticated writer POST/readback; idempotent replay. Run routine scans as data writes without republishing.
