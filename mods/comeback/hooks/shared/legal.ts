// Shared reader for the verification log (`Дневник на проверките`) in
// knowledge-base/bg-legal.md. Any feature that shows a Bulgarian legal fact
// must check it here first: only a confirmed row may be shown as fact.

import { parseSections, readText, type DossierFs } from './dossier'

export const LEGAL_PATH = 'knowledge-base/bg-legal.md'
const LOG_SECTION = 'Дневник на проверките'

export type FactRow = {
  /** The `Факт` cell: the lookup key. */
  fact: string
  value: string
  /** First URL in the `Официален източник` cell, or ''. */
  source: string
  /** `Последна проверка`, an ISO date, or '' when unchecked. */
  checked: string
  status: string
  /** True only for `✅ потвърдено`. */
  isVerified: boolean
}

/** Parses the log table out of bg-legal.md text. Unknown shapes yield []. */
export function parseVerificationLog(markdown: string): FactRow[] {
  const body = parseSections(markdown)[LOG_SECTION] ?? ''
  const rows: FactRow[] = []

  for (const line of body.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) {
      continue
    }
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim())
    const [fact, value, sourceCell, checked, status] = cells
    const isHeader = fact === 'Факт' || /^-+$/.test((fact ?? '').replace(/[:\s]/g, ''))
    if (isHeader || fact === undefined || cells.length < 5) {
      continue
    }
    rows.push({
      fact,
      value: value ?? '',
      source: /https?:\/\/[^\s)]+/.exec(sourceCell ?? '')?.[0] ?? '',
      checked: /^\d{4}-\d{2}-\d{2}$/.test(checked ?? '') ? (checked ?? '') : '',
      status: status ?? '',
      isVerified: (status ?? '').includes('✅'),
    })
  }

  return rows
}

/** Reads and parses the log; [] if bg-legal.md cannot be read. */
export async function loadVerificationLog(fs: DossierFs): Promise<FactRow[]> {
  try {
    return parseVerificationLog(await readText(fs, LEGAL_PATH))
  } catch {
    return []
  }
}

export function findFact(rows: FactRow[], fact: string): FactRow | undefined {
  return rows.find(row => row.fact === fact)
}
