"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useT } from "@/lib/i18n/provider";
import { downloadTextFile, parseCsv, toCsv } from "@/lib/utils/csv";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, toNumberOrNull, type ImportRow } from "@/lib/validations/products";
import { importProductsAction, type ImportRowResult } from "../actions";

interface ParsedRow { fileRow: number; data: ImportRow; problem: string | null }

/** Quick check in the browser so obvious mistakes are shown BEFORE importing. The server checks again. */
function checkRow(data: ImportRow): string | null {
  if (!data.name.trim()) return "Name is empty";
  const selling = toNumberOrNull(data.selling_price);
  if (selling === null || selling < 0) return "Selling price must be a number";
  for (const key of ["purchase_price", "wholesale_price", "min_selling_price", "opening_stock", "min_stock_level"] as const) {
    if (data[key].trim() !== "" && (toNumberOrNull(data[key]) === null || Number(data[key]) < 0)) return `${key} must be a number`;
  }
  return null;
}

const CHUNK = 100;

export function ImportForm({ canSeeCost }: { canSeeCost: boolean }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<ImportRowResult[]>([]);
  const [summary, setSummary] = useState<{ created: number; failed: number } | null>(null);

  function downloadTemplate() {
    const example = ["Sample product", "", "8901234567890", "Drinks", "BrandX", "pcs", "500", "650", "600", "550", "20", "5", "", "Example row - delete me"];
    downloadTextFile("stockora-products-template.csv", toCsv([...IMPORT_COLUMNS], [example]));
  }

  async function handleFile(file: File) {
    setFileError(null); setSummary(null); setFailed([]); setRows(null);
    try {
      const table = parseCsv(await file.text());
      const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
      if (!header.includes("name") || !header.includes("selling_price")) return setFileError(t("products.import.noHeader"));
      if (table.length - 1 > MAX_IMPORT_ROWS) return setFileError(t("products.import.tooMany", { max: MAX_IMPORT_ROWS }));
      const parsed: ParsedRow[] = table.slice(1).map((cells, index) => {
        const data = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, (cells[header.indexOf(c)] ?? "").trim()])) as ImportRow;
        return { fileRow: index + 2, data, problem: checkRow(data) };
      });
      setRows(parsed);
    } catch {
      setFileError(t("products.import.readError"));
    }
  }

  async function startImport() {
    if (!rows) return;
    const valid = rows.filter((r) => !r.problem);
    setProgress({ done: 0, total: valid.length }); setFailed([]); setSummary(null);
    let created = 0;
    const failures: ImportRowResult[] = [];
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK);
      // Rows are sent with their original file row numbers so error messages are easy to find.
      const results: ImportRowResult[] = [];
      for (const item of chunk) {
        const response = await importProductsAction([item.data], item.fileRow);
        if (response.error) results.push({ row: item.fileRow, ok: false, error: response.error });
        else results.push(...response.results);
      }
      for (const r of results) { if (r.ok) created++; else failures.push(r); }
      setProgress({ done: Math.min(i + CHUNK, valid.length), total: valid.length });
    }
    // rows that failed the browser check are reported too
    for (const r of rows.filter((x) => x.problem)) failures.push({ row: r.fileRow, ok: false, error: r.problem! });
    setFailed(failures.sort((a, b) => a.row - b.row));
    setSummary({ created, failed: failures.length });
    setProgress(null);
  }

  const validCount = rows?.filter((r) => !r.problem).length ?? 0;
  const invalidCount = (rows?.length ?? 0) - validCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={downloadTemplate}><Download className="size-4" aria-hidden /> {t("products.import.template")}</Button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label={t("products.import.choose")}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }} />
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={!!progress}><Upload className="size-4" aria-hidden /> {t("products.import.choose")}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("products.import.help", { max: MAX_IMPORT_ROWS })}</p>
      {!canSeeCost && <Alert>{t("products.import.costIgnored")}</Alert>}
      {fileError && <Alert variant="error">{fileError}</Alert>}

      {rows && !summary && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>{t("products.import.rows", { count: rows.length })}</span>
            <span className="text-success">{t("products.import.valid", { count: validCount })}</span>
            {invalidCount > 0 && <span className="text-danger">{t("products.import.invalid", { count: invalidCount })}</span>}
          </div>
          <TableWrap>
            <Table>
              <THead><Tr><Th>#</Th><Th>name</Th><Th>sku</Th><Th>category</Th><Th>selling_price</Th><Th>opening_stock</Th><Th /></Tr></THead>
              <TBody>
                {rows.slice(0, 50).map((r) => (
                  <Tr key={r.fileRow}>
                    <Td>{r.fileRow}</Td><Td>{r.data.name}</Td><Td>{r.data.sku}</Td><Td>{r.data.category}</Td>
                    <Td>{r.data.selling_price}</Td><Td>{r.data.opening_stock}</Td>
                    <Td className="text-danger">{r.problem}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          {rows.length > 50 && <p className="text-xs text-muted-foreground">… {rows.length - 50} more</p>}
          <Button type="button" onClick={startImport} loading={!!progress} disabled={validCount === 0}>
            {progress ? t("products.import.importing", progress) : t("products.import.start", { count: validCount })}
          </Button>
        </div>
      )}

      {summary && (
        <div className="space-y-3">
          <Alert variant={summary.failed ? "info" : "success"}>{t("products.import.done", summary)}</Alert>
          {failed.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-3 text-sm">
              <p className="mb-2 font-medium">{t("products.import.failedRows")}</p>
              <ul className="space-y-1">
                {failed.map((f) => <li key={f.row}>{t("products.import.row", { row: f.row })}: <span className="text-danger">{f.error}</span></li>)}
              </ul>
            </div>
          )}
          <Button type="button" variant="outline" onClick={() => { setRows(null); setSummary(null); setFailed([]); }}>{t("products.import.reset")}</Button>
        </div>
      )}
    </div>
  );
}
