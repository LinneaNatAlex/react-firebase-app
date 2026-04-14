/**
 * Visning av tidspunkt for chat-meldinger (Firestore Timestamp / sekund-felt).
 */

function toDate(createdAt) {
  if (!createdAt) return null;
  if (typeof createdAt.toDate === "function") return createdAt.toDate();
  if (createdAt.seconds != null) {
    return new Date(createdAt.seconds * 1000 + (createdAt.nanoseconds || 0) / 1e6);
  }
  return null;
}

/**
 * @param {unknown} createdAt
 * @returns {string} Tom streng hvis ukjent tid.
 */
export function formatChatMessageTime(createdAt) {
  const d = toDate(createdAt);
  if (!d || Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Til `<time dateTime="…">` når tilgjengelig. */
export function chatMessageDateTimeIso(createdAt) {
  const d = toDate(createdAt);
  if (!d || Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
