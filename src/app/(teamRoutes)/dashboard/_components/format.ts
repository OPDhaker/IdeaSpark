/**
 * Always IST: the event runs in one timezone, and a submission timestamp shown
 * in the viewer's locale would disagree with the deadline beside it.
 */
export function formatMoment(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}
