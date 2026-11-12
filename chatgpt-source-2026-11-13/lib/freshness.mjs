export const FRESH_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;
export function isFresh(job, now = Date.now(), windowDays = 21) {
 const posted = Date.parse(job.postedAt);
 const age = now - posted;
 return Number.isFinite(posted) && age >= 0 && age <= windowDays * 86400000
  && job.openVerified === true && job.eligibility === 'confirmed' && job.historyCheck === 'clear';
}
