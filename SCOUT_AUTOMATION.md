# Hourly scout transport instructions — activate only after cutover verification

Keep the existing ChatGPT automation ID, enabled state and hourly minute-33 schedule.
Use the linked GitHub connector. No Cloudflare credentials belong in the task.

1. Create a private issue in `jesoamakaagugo2-lang/firstlook-job-scout`, authored
   by the owner, title `[Firstlook scout] state <UTC-hour>`, body `{"kind":"state"}`.
   Poll comments for the completed relay response. Reassemble the text after each
   `FIRSTLOOK_STATE_PART n/N` marker in order and parse the JSON. If the relay fails
   or times out, report the failure explicitly. Never silently fall back to an old
   snapshot or the retired Site.
2. Read the returned brief, all history/statuses, jobs and prior reports. Search
   official employer/ATS and accessible public recruiter/founder posts on LinkedIn,
   X, Reddit, Threads, Bluesky, Instagram and TikTok. Disclose coverage gaps. Nigeria
   eligibility must be explicit or clearly worldwide/Africa; EMEA alone unconfirmed.
   Prefer USD700/EUR700 monthly or the edited pay floor. Undisclosed pay may qualify.
   Keep the original posting timestamp; date-only/unknown dates become null/review.
   Exclude closed jobs, talent pools, prior applications/rejections, old reposts,
   duplicate reports and uncertain histories from the fresh feed. Do not apply or
   contact anyone, claim exhaustive coverage, or claim applicant rank.
3. Create a report issue titled `[Firstlook scout] report <UTC-hour>` with JSON
   body `{"kind":"report","report":{"runId":"<unique UTC-hour ID>","summary":"...",
   "jobs":[],"sources":[],"notes":"..."}}`. Retain runId on retries. Each job uses
   {company,role,url:official HTTPS,evidence,postedAt:verified ISO timestamp or null,
   eligibility:confirmed|unconfirmed|ineligible,openVerified:boolean,
   historyCheck:clear|prior application|prior rejection|unconfirmed,location,salary,
   notes}. Optional salaryMonthly and salaryCurrency USD/EUR support pay scoring;
   do not invent conversions. Save zero-match and partial/failure reports too.
   Limit a report issue to 60,000 characters; if necessary keep highest-quality
   leads and document omitted review leads in notes. Preserve a single run ID.
4. Poll comments until `FIRSTLOOK_READBACK_VERIFIED` contains that exact report ID.
   This is the proof of persistence. A created issue, successful workflow start,
   HTTP POST alone or changed page code is not proof. If missing, explicitly say
   the Cloudflare report was not verified saved.
5. Deliver a concise in-chat report with fresh matches/dates/pay/eligibility,
   direct application links and history checks, or zero matches; include failures.
   Hourly fresh-match emails and the daily digest are handled by the Worker only
   after its email configuration passes verification.
