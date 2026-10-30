# Firstlook — Cloudflare cutover

Cloudflare is the intended sole live home:
https://firstlook-job-scout.jesoamakaagugo2.workers.dev

The ChatGPT automation `Automation_98819d3c112881919225ae0e71d680fe`
performs discovery. GitHub Actions is only its authenticated transport; it does
not search for jobs. D1 is the authoritative live database. The relay uses private
GitHub issues as request/response envelopes, never as a second application tracker.
Routine issues do not push commits or trigger Cloudflare builds.

## Status and order of operations

1. Deploy the current main branch with the existing commands:
   `pnpm run build:cloudflare` / `pnpm run deploy:cloudflare`.
   The deployment applies `drizzle/0001_consolidate_firstlook.sql`.
   Its audited snapshot has 153 tracker rows, three jobs and three scan reports.
   Seven unknown-employer tracker rows were previously excluded. These are preserved
   with their original uncertainty, not relabelled as confirmed applications.
   Migration never deletes destination records. Repeated migration is idempotent.
2. Configure the Worker secret `SCOUT_REPORT_TOKEN` and the GitHub Actions repository
   secret of the same name with the same cryptographically random value (32+ chars).
   Never put it in code, an issue, a task prompt, a URL, a log or a chat message.
3. Allow machine requests through Cloudflare Access using ONE method:
   - A separate self-hosted Access application for the EXACT hostname and
     `/api/report` path with a Bypass policy. Do not bypass `/api/*`, the whole
     Worker, or the dashboard. Worker bearer authentication still protects it.
   - Or a Service Auth policy for the report path. Store the generated service
     credentials in GitHub Actions secrets `CF_ACCESS_CLIENT_ID` and
     `CF_ACCESS_CLIENT_SECRET`. The relay sends these plus the Worker bearer token.
   Keep the owner-only Access policy on all other paths.
4. Verify before changing the hourly task:
   - Anonymous dashboard request is blocked.
   - Anonymous report request is blocked, including with the Access path bypass.
   - An owner login loads the dashboard and its last-scan panel.
   - Create an owner-authored private GitHub issue titled `[Firstlook scout] verify`
     with JSON body `{"kind":"verify"}`. The relay must close it with
     `FIRSTLOOK_CONNECTION_VERIFIED`, historyCount 153, jobsCount 3 and the
     preserved report timestamps. Inspect the live dashboard on phone and desktop.
   - Create a `state` request, then a real `report` request. The success comment
     must say `FIRSTLOOK_READBACK_VERIFIED` and include the exact run ID.
     Retry the same run ID and verify no duplicate report is created.
5. Only after verification, update the EXISTING hourly automation using
   `SCOUT_AUTOMATION.md`, retaining its schedule and ID. Capture any newer original
   reports created during cutover and migrate those too. Then retire the original
   Site, rather than deleting data before the replacement works.

This checkout's tests/build do not prove live deployment, credential configuration,
or delivery. Do not claim those until the live checks pass.

## Configure secrets from an authenticated terminal

Run in this private repository on your own authenticated computer. This creates
one value and passes it through stdin without displaying or writing it:

```bash
FIRSTLOOK_REPORT_TOKEN="$(openssl rand -hex 32)"
printf '%s' "$FIRSTLOOK_REPORT_TOKEN" | pnpm exec wrangler secret put SCOUT_REPORT_TOKEN --config wrangler.jsonc
printf '%s' "$FIRSTLOOK_REPORT_TOKEN" | gh secret set SCOUT_REPORT_TOKEN --repo jesoamakaagugo2-lang/firstlook-job-scout
unset FIRSTLOOK_REPORT_TOKEN
```

Cloudflare Dashboard > Worker > Settings > Variables and Secrets also supports
adding an encrypted secret. GitHub > Repository > Settings > Secrets and variables
> Actions holds the matching repository secret. Store the value in a password
manager if entering it manually; do not post it in chat.

## Email

The Worker queues a maximum of one fresh-match email per UTC hour and one daily
digest at 20:00 WAT (19:00 UTC). Zero-match hours produce a saved report, not mail.
The cron at minute 5 retries pending delivery and produces the digest even if a
scan fails that day. Failures/expired attempts are shown in scan reports.

Configure a Resend account/sender and `wrangler secret put RESEND_API_KEY`.
Set `EMAIL_FROM` to an address Resend allows that account to send from. All mail
is sent only to `OWNER_EMAIL`, currently jesoamakaagugo2@gmail.com. No sender/key
has been provisioned by this commit. Delivery remains disabled until both exist.
Check one controlled delivery and provider logs before declaring email working.

Mail uses stable idempotency keys, durable payloads and an optimistic delivery
lease. Do not retry after the 23-hour delivery window without checking provider
logs; this avoids resending outside the provider's idempotency retention.

## Backups and restore

- D1 Time Travel supplies provider-managed point-in-time recovery; its retention
  depends on the Cloudflare plan. Verify the actual account's available history.
- `backup.yml` exports all entries weekly to a private Actions artifact, retained
  for 30 days, after the relay credential is configured. A manual workflow trigger
  is included for the first verification. Keep the repo private.
- Optional `BACKUPS` R2 bucket binding enables a second weekly Worker snapshot.
  It is not provisioned automatically; configure a retention policy explicitly.
- A JSON backup contains all entry IDs, kinds, payloads and creation times. To
  restore into a NEW database, validate the entry shape, prepare parameterized
  INSERT statements, preserve IDs and timestamps, then compare counts and a sample
  of histories/reports. Never restore over the live database without first taking
  a fresh export. Test a restore before relying on backups.

## Ranking and follow-ups

Scores: role fit 30, confirmed eligibility 30, pay 20, freshness 20. Unknown pay
gets 10, not an assumed salary. Scores cannot override freshness/history gates.
Real timestamps require timezone and time-of-day; a date-only value is rejected
as an input timestamp (send null). Tracking parameters are removed while
requisition query parameters are retained. Company/title normalization and
conservative history matching send ambiguities to review.

Follow-ups use known application dates and saved statuses, skip weekends (not
public holidays), and start after five business days. They are review prompts,
not proof no reply exists; recent emails and follow-ups may not yet be recorded.
Nothing applies, follows up or contacts employers automatically.
