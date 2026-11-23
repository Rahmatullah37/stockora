/**
 * Tiny CSV helpers (no extra library). Works in the browser and on the server.
 */

/** One value -> a safe CSV cell (quotes, commas and new lines are escaped). */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Prevent spreadsheet formula injection (=, +, -, @ at the start).
  if (/^[=+\-@]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(","), ...rows.map((row) => row.map(cell).join(","))];
  // BOM so Excel opens UTF-8 (Urdu/Pashto) text correctly.
  return "﻿" + lines.join("\r\n");
}

/** Parses CSV text into rows of strings. Handles quoted cells and both line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') { current += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else current += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(current); current = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(current); current = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else current += char;
  }
  row.push(current);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Browser only: downloads text as a file. */
export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
