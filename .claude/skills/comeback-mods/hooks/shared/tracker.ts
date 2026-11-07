// Shared reader for the person's live `tracker.md` (template:
// agent/templates/tracker.md). READ-ONLY. The tracker is a person-facing file
// with one markdown table per zone; this module walks it tolerantly and turns
// the rows that are on the pipeline into plain records. It never writes.

import { daysBetween, parseIsoDate, readText, type DossierFs } from './dossier'

export const TRACKER_FILE = 'tracker.md'

/** An `applied` row this many days (or more) after it was sent asks for a follow-up. */
export const FOLLOWUP_DAYS = 10

export type TrackerColumn = 'applied' | 'talking' | 'offer' | 'rejected'

export type TrackerApp = {
  company: string
  role: string
  column: TrackerColumn
  /** Applied rows only: whole days since the CV was sent; absent if the date is unknown. */
  daysSinceUpdate?: number
  /** Applied rows only. */
  followupDue: boolean
  /** Talking rows only: ISO date of the next step, when the cell has a date. */
  interview?: string
}

/**
 * The tracker text of the person whose folder is `dossierDir` (`Personal/<slug>`):
 * `<dir>/tracker.md`, else a `tracker.md` one folder level below. Null if none.
 */
export async function loadTracker(fs: DossierFs, dossierDir: string): Promise<string | null> {
  try {
    return await readText(fs, `${dossierDir}/${TRACKER_FILE}`)
  } catch {
    // fall through to the one-level scan
  }
  let entries: Array<{ name: string; kind: string }>
  try {
    entries = await fs.list(dossierDir)
  } catch {
    return null
  }
  for (const entry of entries) {
    if (entry.kind !== 'dir') {
      continue
    }
    try {
      return await readText(fs, `${dossierDir}/${entry.name}/${TRACKER_FILE}`)
    } catch {
      // keep looking
    }
  }

  return null
}

type Zone = 'talking' | 'applied' | 'closed'

function zoneOf(heading: string): Zone | null {
  const h = heading.toLowerCase()
  if (h.includes('недокоснат') || h.includes('цели')) {
    return null
  }
  if (h.includes('движение')) {
    return 'talking'
  }
  if (h.includes('изпратено') || h.includes('чака')) {
    return 'applied'
  }
  if (h.includes('затворен')) {
    return 'closed'
  }

  return null
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
}

function isSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c) || c === '')
}

/** Strips a `{placeholder}` wrapper check: true when the whole cell is `{...}`. */
function isPlaceholder(value: string): boolean {
  return /^\{.*\}$/.test(value.trim())
}

/**
 * First `DD.MM` or `DD.MM.YYYY` in `text` as an ISO date. Without a year the
 * year (of the previous, same or next one) that lands nearest `today` wins.
 * Null when there is no token or it is not a real calendar day.
 */
export function extractDate(text: string, today: string): string | null {
  const hit = /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?!\d)/.exec(text)
  const todayDay = parseIsoDate(today)
  if (!hit || todayDay === null) {
    return null
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  const [d, m] = [Number(hit[1]), Number(hit[2])]
  const iso = (y: number) => `${y}-${pad(m)}-${pad(d)}`

  if (hit[3] !== undefined) {
    const y = hit[3].length === 2 ? 2000 + Number(hit[3]) : Number(hit[3])

    return parseIsoDate(iso(y)) === null ? null : iso(y)
  }
  const year = Number(today.slice(0, 4))
  let best: string | null = null
  let bestGap = Infinity
  for (const y of [year - 1, year, year + 1]) {
    const day = parseIsoDate(iso(y))
    if (day !== null && Math.abs(day - todayDay) < bestGap) {
      best = iso(y)
      bestGap = Math.abs(day - todayDay)
    }
  }

  return best
}

function columnIndex(header: string[], ...needles: string[]): number {
  return header.findIndex(h => needles.some(n => h.toLowerCase().includes(n)))
}

/** Pulls the `applied`, `talking` and closed rows out of a tracker. `today` is `YYYY-MM-DD`. */
export function parseTracker(markdown: string, today: string): TrackerApp[] {
  const apps: TrackerApp[] = []
  let zone: Zone | null = null
  let header: string[] | null = null

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()
    if (/^#{1,6}\s/.test(line)) {
      zone = /^##\s/.test(line) ? zoneOf(line.replace(/^##\s+/, '')) : null
      header = null
      continue
    }
    if (zone === null || !line.startsWith('|')) {
      continue
    }
    const cells = splitRow(line)
    if (isSeparator(cells)) {
      continue
    }
    if (header === null) {
      header = cells
      continue
    }
    const company = cells[0] ?? ''
    const role = cells[1] ?? ''
    if (company === '' || isPlaceholder(company)) {
      continue
    }
    const base = { company, role: isPlaceholder(role) ? '' : role }
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? '') : '')

    if (zone === 'talking') {
      const next = cell(columnIndex(header, 'следваща', 'дата'))
      const interview = extractDate(next, today)
      apps.push({
        ...base,
        column: 'talking',
        followupDue: false,
        ...(interview !== null ? { interview } : {}),
      })
    } else if (zone === 'applied') {
      const sent = extractDate(cell(columnIndex(header, 'изпратено')), today)
      const followup = extractDate(cell(columnIndex(header, 'follow-up')), today)
      // A CV cannot be sent in the future: a negative count means the year guess was off, so it is unknown.
      const rawSince = sent === null ? null : daysBetween(sent, today)
      const since = rawSince !== null && rawSince >= 0 ? rawSince : null
      const followupDue =
        followup !== null
          ? daysBetween(followup, today)! >= 0
          : since !== null && since >= FOLLOWUP_DAYS
      apps.push({
        ...base,
        column: 'applied',
        followupDue,
        ...(since !== null ? { daysSinceUpdate: since } : {}),
      })
    } else {
      const outcome = cell(columnIndex(header, 'изход')).trim().toLowerCase()
      apps.push({
        ...base,
        column: /^да(?![\p{L}])/u.test(outcome) ? 'offer' : 'rejected',
        followupDue: false,
      })
    }
  }

  return apps
}
