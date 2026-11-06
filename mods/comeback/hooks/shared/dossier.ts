// Shared dossier access for every comeback feature. READ-ONLY: nothing in this
// file writes, sends or logs person data. Features call `loadDossierSection`
// for their own section and never re-implement finding or parsing.
//
// Dossier schema: agent/dossier-template.md. A person's dossier lives at
// Personal/<date>-<slug>/dossier.md under the session's working directory.

/** The part of `$.fs` this module needs; `$.fs` satisfies it structurally. */
export type DossierFs = {
  list: (path?: string) => Promise<Array<{ name: string; kind: string }>>
  stat: (path: string) => Promise<{ mtimeMs: number }>
  read: (path: string) => Promise<string | { base64: string }>
}

/**
 * Wraps `$.fs` for the helpers below. The engine forbids passing `$.fs` itself
 * around as a value (it must be spelled `$.fs.list(...)` at each call), so this
 * is the one place that spells the three calls out. Features pass their `$`.
 */
export function dossierFs($: {
  fs: {
    list: (path?: string) => Promise<Array<{ name: string; kind: string }>>
    stat: (path: string) => Promise<{ mtimeMs: number }>
    read: (path: string) => Promise<string | { base64: string }>
  }
}): DossierFs {
  return {
    list: path => $.fs.list(path),
    stat: path => $.fs.stat(path),
    read: path => $.fs.read(path),
  }
}

export type Dossier = {
  /** `Personal/<date>-<slug>`, relative to the working directory. */
  dir: string
  /** `<date>-<slug>`. */
  slug: string
  /** `Personal/<date>-<slug>/dossier.md`. */
  path: string
  mtimeMs: number
  text: string
}

/** One list entry of a machine-readable section: `key: value` pairs. */
export type Entry = Record<string, string>

export const PERSONAL_DIR = 'Personal'
export const DOSSIER_FILE = 'dossier.md'

/** Reads a file as text; rejects if it is missing or not text. */
export async function readText(fs: DossierFs, path: string): Promise<string> {
  const got = await fs.read(path)
  if (typeof got !== 'string') {
    throw new Error(`${path} is not text`)
  }

  return got
}

/**
 * The current person: the MOST RECENTLY MODIFIED `Personal/*\/dossier.md`.
 * Returns null when there is no Personal folder or no dossier in it.
 */
export async function findCurrentDossier(
  fs: DossierFs,
): Promise<Dossier | null> {
  let people: Array<{ name: string; kind: string }>
  try {
    people = await fs.list(PERSONAL_DIR)
  } catch {
    return null
  }

  let best: { slug: string; mtimeMs: number } | null = null
  for (const person of people) {
    if (person.kind !== 'dir') {
      continue
    }
    try {
      const stat = await fs.stat(`${PERSONAL_DIR}/${person.name}/${DOSSIER_FILE}`)
      if (best === null || stat.mtimeMs > best.mtimeMs) {
        best = { slug: person.name, mtimeMs: stat.mtimeMs }
      }
    } catch {
      // A person folder without a dossier is skipped.
    }
  }
  if (best === null) {
    return null
  }

  const dir = `${PERSONAL_DIR}/${best.slug}`
  const path = `${dir}/${DOSSIER_FILE}`
  try {
    return { dir, slug: best.slug, path, mtimeMs: best.mtimeMs, text: await readText(fs, path) }
  } catch {
    return null
  }
}

/**
 * Splits a dossier into its `## ` sections. A section is keyed by its heading
 * without any trailing parenthetical: `## Deadlines (machine-read ...)` is
 * `Deadlines`. Sub-headings (`###`) stay inside their section's body.
 */
export function parseSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {}
  let name: string | null = null
  let lines: string[] = []

  const close = () => {
    if (name !== null) {
      sections[name] = lines.join('\n').trim()
    }
  }

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading && heading[1] !== undefined) {
      close()
      name = heading[1].replace(/\s*\(.*$/, '').trim()
      lines = []
    } else {
      lines.push(line)
    }
  }
  close()

  return sections
}

/** A `{placeholder}` left by the template counts as empty. */
function cleanValue(raw: string): string {
  const value = raw.trim()

  return /^\{.*\}$/.test(value) ? '' : value
}

/**
 * Parses a section body of entries written as
 *
 *     - title: Something
 *       due: 2026-11-12
 *
 * A `- key: value` line starts an entry; indented `key: value` lines continue
 * it. Keys are ASCII words. Empty and `{placeholder}` values are dropped, and
 * lines in any other shape (prose, `- **Bold:** x` bullets) are ignored.
 */
export function parseEntries(body: string): Entry[] {
  const entries: Entry[] = []
  let current: Entry | null = null

  for (const line of body.split(/\r?\n/)) {
    const start = /^-\s+([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    const more = /^\s+([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    const hit = start ?? more
    if (!hit || hit[1] === undefined) {
      continue
    }
    if (start) {
      current = {}
      entries.push(current)
    }
    if (current === null) {
      continue
    }
    const value = cleanValue(hit[2] ?? '')
    if (value !== '') {
      current[hit[1]] = value
    }
  }

  return entries
}

export type SectionResult = {
  dossier: Dossier
  /** The section body, or '' when the dossier has no such section. */
  body: string
  entries: Entry[]
}

/**
 * The one call a feature makes: finds the current person and returns their
 * dossier with the named section parsed. Null when there is no dossier.
 */
export async function loadDossierSection(
  fs: DossierFs,
  section: string,
): Promise<SectionResult | null> {
  const dossier = await findCurrentDossier(fs)
  if (dossier === null) {
    return null
  }
  const body = parseSections(dossier.text)[section] ?? ''

  return { dossier, body, entries: parseEntries(body) }
}

// ---------------------------------------------------------------- dates

/** `YYYY-MM-DD` and a real calendar day, else null. */
export function parseIsoDate(value: string | undefined): number | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!hit) {
    return null
  }
  const [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])]
  const ms = Date.UTC(y, m - 1, d)
  const back = new Date(ms)
  const isReal =
    back.getUTCFullYear() === y &&
    back.getUTCMonth() === m - 1 &&
    back.getUTCDate() === d

  return isReal ? Math.round(ms / 86400000) : null
}

/** Whole days from `from` to `to` (both ISO dates); null if either is invalid. */
export function daysBetween(from: string, to: string): number | null {
  const a = parseIsoDate(from)
  const b = parseIsoDate(to)

  return a === null || b === null ? null : b - a
}

/** Today's local calendar date as `YYYY-MM-DD`, from epoch milliseconds. */
export function isoToday(nowMs: number): string {
  const d = new Date(nowMs)
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** `2026-11-12` to `12.11.2026`, the way the person reads dates. */
export function formatBgDate(iso: string): string {
  const [y, m, d] = iso.split('-')

  return `${d}.${m}.${y}`
}
