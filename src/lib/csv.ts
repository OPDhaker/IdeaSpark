export type CsvValue = string | number | null | undefined;

/**
 * One CSV field. Always quoted (RFC 4180), and a value a spreadsheet would
 * read as a formula gets a leading `'`: team and member names are typed by
 * teams, and `=HYPERLINK(...)` in a team name must not run on an admin's
 * machine. A bare `+91…` phone number is left alone.
 */
function field(value: CsvValue) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^\+?\d+$/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** A whole file: header row, CRLF line endings, BOM so Excel reads UTF-8. */
export function toCsv(header: string[], rows: CsvValue[][]) {
  const lines = [header, ...rows].map((row) => row.map(field).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
