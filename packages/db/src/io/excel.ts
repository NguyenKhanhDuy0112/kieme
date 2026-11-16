import ExcelJS from 'exceljs';
import { DbError } from '../repo';
import { type Table, toTable } from './table';

const pad = (n: number) => String(n).padStart(2, '0');

/** Cell → the text a tester sees in Excel (dates as dd/MM/yyyy). */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const hasTime = v.getUTCHours() + v.getUTCMinutes() + v.getUTCSeconds() > 0;
    const d = `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
    return hasTime ? `${d} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}` : d;
  }
  if (typeof v === 'object') {
    if ('result' in v)
      return v.result === undefined || v.result === null ? '' : cellTextOf(v.result);
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return String(v.text);
    if ('error' in v) return String(v.error);
  }
  return String(v);
}

function cellTextOf(v: unknown): string {
  if (v instanceof Date)
    return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  return typeof v === 'object' && v !== null && 'error' in v
    ? String((v as { error: unknown }).error)
    : String(v);
}

export interface ExcelInfo {
  sheets: string[];
}

async function load(input: Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(input as unknown as ArrayBuffer);
  } catch (err) {
    throw new DbError('IMPORT_FAILED', 'Not a valid Excel (.xlsx) file', {
      reason: 'badExcel',
      message: err instanceof Error ? err.message : String(err),
    });
  }
  return wb;
}

export async function excelSheets(input: Uint8Array): Promise<string[]> {
  return (await load(input)).worksheets.map((w) => w.name);
}

/** Reads one sheet (default: the first) of an .xlsx file [E-03]. */
export async function readExcel(
  input: Uint8Array,
  sheet?: string,
): Promise<Table & { sheet: string }> {
  const wb = await load(input);
  const ws = sheet === undefined ? wb.worksheets[0] : wb.getWorksheet(sheet);
  if (!ws)
    throw new DbError('IMPORT_FAILED', `Sheet "${sheet}" not found`, { reason: 'noSheet', sheet });
  const raw: string[][] = [];
  const width = ws.columnCount;
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c)));
    raw.push(cells);
  });
  return { ...toTable(raw), sheet: ws.name };
}

/** Table → .xlsx bytes (for "download template" / export). */
export async function writeExcel(table: Table, sheetName = 'Dữ liệu'): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(table.columns);
  ws.getRow(1).font = { bold: true };
  for (const r of table.rows) ws.addRow(table.columns.map((c) => r[c] ?? ''));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
