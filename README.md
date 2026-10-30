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


## Deploy this repository in your Cloudflare account

The original Sites deployment and its hourly automation remain independent. This target does not inherit its data, sign-in session, or updater authorization.

Cloudflare Workers Builds settings:
- Project name: `firstlook-job-scout`
- Production branch: `main`
- Build command: `pnpm run build:cloudflare`
- Deploy command: `pnpm run deploy:cloudflare`
- Root directory: repository root
- Disable preview builds during initial setup. Protect all traffic with Cloudflare Access and choose the Cloudflare account policy, session duration 24 hours.

The deploy script applies schema migrations to the explicitly configured D1 database before deploying the built Worker. It does not import application records, delete records or create a recurring scout.

The `DB` binding uses `firstlook-db`, database ID `2ee2930e-828b-41be-b59f-6ceed95f5570`. No credentials are stored in source.

The owner allowlist is `jesoamakaagugo2@gmail.com`. The Worker accepts Cloudflare's platform-verified Access identity when supplied. Workers with Static Assets may not receive that context, so the Worker also supports strict Access JWT verification. Configure the non-secret runtime variables `TEAM_DOMAIN` (your full `https://<team>.cloudflareaccess.com` origin) and `POLICY_AUD` (the Access application's audience tag). Missing verification settings return a setup message without serving workspace data. Variables added in the dashboard are retained on later code deployments via `keep_vars`.

After publishing, verify anonymous access is blocked and the owner can open the desk; import existing reports and history through the protected API and verify readback. Only then connect a supported unattended writer to this Worker and update the existing hourly task to use it. Do not add a public write endpoint or copy the old Sites bypass token: it authorizes only the original Site. Service-token identity authorization is not yet implemented for this target. Until that migration is verified, the existing task continues updating the original private Site.

Checks: `node --test tests/cloudflare-access.test.mjs`; `pnpm run build:cloudflare`.
