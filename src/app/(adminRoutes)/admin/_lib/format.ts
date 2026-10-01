/**
 * Always IST, in a fixed locale. `toLocaleString()` formats on the server in
 * the server's locale and again in the browser in the viewer's, and the two
 * disagree (9/30/2026 vs 30/9/2026), which breaks hydration.
 */
const date = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

const moment = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export function formatDate(value: Date | string) {
  return date.format(new Date(value));
}

export function formatMoment(value: Date | string) {
  return moment.format(new Date(value));
}
