/**
 * Safe CSV (dissertation §10): every cell is quoted, and a cell that a spreadsheet would run as a
 * formula (= + - @, tab, carriage return) gets a leading apostrophe. Pure, shared by every export.
 */

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  let text = value instanceof Date ? value.toISOString() : String(value)
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** RFC 4180 parser: quoted cells, doubled quotes, CRLF or LF. Returns rows of strings. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const text = input.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

/** Parse with a header row; keys are lower-cased with spaces as underscores. */
export function parseCsvObjects(input: string): Array<Record<string, string>> {
  const [header, ...rows] = parseCsv(input)
  if (!header) return []
  const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}
