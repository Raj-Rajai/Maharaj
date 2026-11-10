/**
 * Pin the Node process to the restaurant's timezone.
 *
 * Why: every "local" Date getter in the backend (getHours, getDate, setHours(0,0,0,0) ...)
 * uses the process timezone. The production server runs in UTC, so on the live site:
 *   - hourly report buckets were shifted 5h30m behind IST (a 2:30 PM sale was plotted at 09:00)
 *   - "today" started at 05:30 IST instead of midnight
 *   - daily KOT / order numbering rolled over at 05:30 IST
 * Local dev on an IST machine hid the problem.
 *
 * Must be imported before any other module creates Dates.
 * Override with APP_TIMEZONE in .env if the restaurant ever moves.
 * (A server-level TZ=UTC is deliberately ignored — that is exactly the bug.)
 */
const zone = process.env.APP_TIMEZONE || 'Asia/Kolkata';
process.env.TZ = zone;

export default zone;
