// Shared artifact discovery for the comeback features: which CV files and
// prep notes does the current person have? READ-ONLY and framework-free: pure
// functions plus the three `DossierFs` calls (list / stat / read). Nothing here
// writes, sends or logs person data.
//
// File conventions come from .claude/skills/tailor-cv/ats-rules.md:
//   <workspace>/{Name} CV_v1.0.docx            versioned base CVs (a .pdf may sit beside)
//   <workspace>/{Name} CV_latest.docx          copy of the newest version (not a separate document)
//   <workspace>/YYYY-MM-DD_Company_Position/   one folder per tailored position,
//       {Name} CV - Company - Position.docx/.pdf
// Prep notes are not files: interview-coach writes `## Interviews` and
// company-intel writes `## Company intel` (one `### <company / title>` block per
// posting) into the dossier itself.

import { parseSections, type Dossier, type DossierFs } from './dossier'

export type BaseCv = {
  /** `v2.0` */
  version: string
  /** Path of the .docx (else the .pdf) relative to the working directory. */
  path: string
  mtimeMs: number
}

export type TailoredCv = {
  company: string
  position: string
  /** The `YYYY-MM-DD_Company_Position` folder. */
  path: string
  mtimeMs: number
}

export type PrepNote = {
  /** The Bulgarian row label. */
  label: string
  /** The dossier holds the note, so every prep row points at it. */
  path: string
  /** The dossier's mtime: a section has no date of its own. */
  mtimeMs: number
}

export type DocumentsScan = {
  /** Newest version first. */
  base: BaseCv[]
  /** Newest first. */
  tailored: TailoredCv[]
  prep: PrepNote[]
}

export const INTERVIEW_LABEL = 'Пробно интервю — обратна връзка'

/** `Workspace път` from the dossier `## CV` section; '' when unset or a placeholder. */
export function workspaceFromDossier(dossierText: string): string {
  const cv = parseSections(dossierText)['CV'] ?? ''
  const hit = /^-\s+\*\*Workspace път:\*\*[ \t]*(.*)$/m.exec(cv)
  const value = (hit?.[1] ?? '').trim().replace(/^`|`$/g, '')

  return value === '' || /^\{.*\}$/.test(value) ? '' : value.replace(/[\\/]+$/, '')
}

/** True when a section body holds at least one real (non-placeholder) value. */
export function hasContent(body: string): boolean {
  for (const raw of body.split(/\r?\n/)) {
    const value = raw
      .trim()
      .replace(/^[-*]\s+/, '')
      .replace(/^\*\*[^*]+\*\*\s*/, '')
      .trim()
    if (value !== '' && !/^\{.*\}$/.test(value)) {
      return true
    }
  }

  return false
}

/** `Chaos / Program Manager — https://...` to `Chaos`. */
export function companyOfHeading(heading: string): string {
  return (heading.split(/\s*[/—–]\s*|\s+-\s+/)[0] ?? heading).trim()
}

/** Prep notes of the dossier: a filled Interviews section, and a filled block per posting. */
export function findPrep(dossier: Dossier): PrepNote[] {
  const sections = parseSections(dossier.text)
  const notes: PrepNote[] = []
  const note = (label: string): PrepNote => ({ label, path: dossier.path, mtimeMs: dossier.mtimeMs })

  if (hasContent(sections['Interviews'] ?? '')) {
    notes.push(note(INTERVIEW_LABEL))
  }
  const intel = sections['Company intel'] ?? ''
  const parts = intel.split(/^###[ \t]+/m).slice(1)
  for (const part of parts) {
    const [heading = '', ...rest] = part.split(/\r?\n/)
    const title = heading.trim()
    if (title === '' || /^\{.*\}$/.test(title) || !hasContent(rest.join('\n'))) {
      continue
    }
    notes.push(note(`${companyOfHeading(title)} — въпроси за задаване`))
  }

  return notes
}

async function listDir(fs: DossierFs, path: string) {
  try {
    return await fs.list(path)
  } catch {
    return []
  }
}

async function mtimeOf(fs: DossierFs, path: string): Promise<number | null> {
  try {
    return (await fs.stat(path)).mtimeMs
  } catch {
    return null
  }
}

const BASE_FILE = /^.+ CV_v(\d+)\.(\d+)\.(docx|pdf)$/i
const LATEST_FILE = /^.+ CV_latest\.(docx|pdf)$/i
const POSITION_DIR = /^\d{4}-\d{2}-\d{2}_([^_]+)_(.+)$/
const TAILORED_FILE = /^.+ CV - (.+) - (.+)\.(docx|pdf)$/i

/** Base CVs in the workspace root, grouped by version (docx + pdf are one document). */
export async function findBaseCvs(fs: DossierFs, workspace: string): Promise<BaseCv[]> {
  const files = (await listDir(fs, workspace)).filter(f => f.kind === 'file')
  const byVersion = new Map<string, { major: number; minor: number; docx?: string; pdf?: string }>()

  for (const f of files) {
    const hit = BASE_FILE.exec(f.name)
    if (!hit) {
      continue
    }
    const key = `${hit[1]}.${hit[2]}`
    const group = byVersion.get(key) ?? { major: Number(hit[1]), minor: Number(hit[2]) }
    if (hit[3]!.toLowerCase() === 'docx') {
      group.docx = f.name
    } else {
      group.pdf = f.name
    }
    byVersion.set(key, group)
  }

  const out: BaseCv[] = []
  for (const [key, g] of [...byVersion.entries()].sort(
    (a, b) => b[1].major - a[1].major || b[1].minor - a[1].minor,
  )) {
    const name = g.docx ?? g.pdf!
    const path = `${workspace}/${name}`
    const mtimeMs = await mtimeOf(fs, path)
    if (mtimeMs !== null) {
      out.push({ version: `v${key}`, path, mtimeMs })
    }
  }

  // Only the canonical copy exists: it is the current CV, shown once.
  if (out.length === 0) {
    const latest = files.find(f => LATEST_FILE.test(f.name))
    if (latest) {
      const path = `${workspace}/${latest.name}`
      const mtimeMs = await mtimeOf(fs, path)
      if (mtimeMs !== null) {
        out.push({ version: 'latest', path, mtimeMs })
      }
    }
  }

  return out
}

/** One entry per `YYYY-MM-DD_Company_Position` subfolder of the workspace. */
export async function findTailoredCvs(fs: DossierFs, workspace: string): Promise<TailoredCv[]> {
  const out: TailoredCv[] = []

  for (const dir of (await listDir(fs, workspace)).filter(f => f.kind === 'dir')) {
    const folder = POSITION_DIR.exec(dir.name)
    if (!folder) {
      continue
    }
    const path = `${workspace}/${dir.name}`
    const inside = (await listDir(fs, path)).filter(f => f.kind === 'file')
    // The CV file name is the more exact source for the label; the folder name is the fallback.
    let company = folder[1]!
    let position = folder[2]!.replace(/_/g, ' ')
    let mtimeMs: number | null = null
    for (const f of inside) {
      const hit = TAILORED_FILE.exec(f.name)
      if (!hit) {
        continue
      }
      company = hit[1]!.trim()
      position = hit[2]!.trim()
      const m = await mtimeOf(fs, `${path}/${f.name}`)
      if (m !== null && (mtimeMs === null || m > mtimeMs)) {
        mtimeMs = m
      }
    }
    mtimeMs ??= await mtimeOf(fs, path)
    if (mtimeMs !== null) {
      out.push({ company, position, path, mtimeMs })
    }
  }

  return out.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

/** Everything the Документи pane shows for the current person's dossier. */
export async function scanDocuments(fs: DossierFs, dossier: Dossier): Promise<DocumentsScan> {
  const workspace = workspaceFromDossier(dossier.text) || dossier.dir

  return {
    base: await findBaseCvs(fs, workspace),
    tailored: await findTailoredCvs(fs, workspace),
    prep: findPrep(dossier),
  }
}

export function documentCount(scan: DocumentsScan): number {
  return scan.base.length + scan.tailored.length + scan.prep.length
}
