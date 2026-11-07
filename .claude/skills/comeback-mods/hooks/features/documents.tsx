// Feature 4: Документи. A side pane "Документи" listing what exists for the
// person in three groups (Базово CV, Пригодени, Подготовка), plus a status-line
// segment `6 документа`.
//
// Data: the CV workspace on disk and the dossier's Interviews / Company intel
// sections, found by ../shared/documents (no new dossier section). Read-only.
//
// Opening a file on click: the plugin API has no open / reveal call (`Link`
// leaves "what a click opens" to the surface, and running host programs is off limits to a
// read-only mod), so each file-backed row shows its path in dim text instead.

import type { On } from 'claude-code'

import { dossierFs, findCurrentDossier } from '../shared/dossier'
import { documentCount, scanDocuments, type DocumentsScan } from '../shared/documents'
import { setStatusSegment } from '../shared/status'
import { groupLabel, iconRow, paneHeader, type UiTable } from '../shared/ui'

const PANE = 'comeback-documents'
const EMPTY_TEXT = 'Документите ти ще се появят тук, щом започнем да правим CV.'

export type DocRow = {
  icon: string
  name: string
  /** `DD.MM` */
  date: string
  current?: boolean
  dim?: boolean
  /** The path to find it at. */
  path: string
}

export type DocGroup = { title: string; rows: DocRow[] }

export type DocumentsView = { groups: DocGroup[]; total: number; summary: string }

/** `1 документ`, else `N документа`. */
export function documentsText(n: number): string {
  return n === 1 ? '1 документ' : `${n} документа`
}

/** Epoch ms to the local `DD.MM`. */
export function shortDateMs(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`
}

/** Null when there is nothing to show. Empty groups are left out. */
export function buildDocuments(scan: DocumentsScan): DocumentsView | null {
  const total = documentCount(scan)
  if (total === 0) {
    return null
  }
  const groups: DocGroup[] = [
    {
      title: 'Базово CV',
      rows: scan.base.map((b, i) => ({
        icon: '📄',
        name: b.version === 'latest' ? 'CV' : `CV ${b.version}`,
        date: shortDateMs(b.mtimeMs),
        path: b.path,
        ...(i === 0 ? { current: true } : { dim: true }),
      })),
    },
    {
      title: 'Пригодени',
      rows: scan.tailored.map(t => ({
        icon: '🎯',
        name: `${t.company} · ${t.position}`,
        date: shortDateMs(t.mtimeMs),
        path: t.path,
      })),
    },
    {
      title: 'Подготовка',
      rows: scan.prep.map(p => ({ icon: '🗒', name: p.label, date: shortDateMs(p.mtimeMs), path: p.path })),
    },
  ].filter(g => g.rows.length > 0)

  return { groups, total, summary: documentsText(total) }
}

async function load($: Parameters<typeof dossierFs>[0]) {
  const fs = dossierFs($)
  const dossier = await findCurrentDossier(fs)
  if (dossier === null) {
    return null
  }

  return buildDocuments(await scanDocuments(fs, dossier))
}

function group(t: UiTable, g: DocGroup) {
  const { Box } = t

  return (
    <Box flexDirection="column" gap={1}>
      {groupLabel(t, g.title)}
      {g.rows.map(r =>
        iconRow(t, {
          icon: r.icon,
          name: r.name,
          note: r.date,
          hint: r.path,
          ...(r.current === true ? { pill: { text: 'текущо', tone: 'ok' as const } } : {}),
          ...(r.dim === true ? { dim: true } : {}),
        }),
      )}
    </Box>
  )
}

export function registerDocuments(on: On) {
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    await $.command.register({
      name: 'documents',
      description: 'Покажи панела Документи',
    })
    void $.ui.open({ id: PANE, title: 'Документи' })
    const view = await load($)
    setStatusSegment($, 'documents', view === null ? undefined : view.summary)

    return next(e)
  })

  on('command.run', { command: 'documents' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Документи' })

    return { text: 'Панелът Документи е отворен.' }
  })

  // No prompt.submit / turn.complete hooks here: register.tsx invalidates
  // `ui.render` around each turn, which re-runs the pane hook below.

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const view = await load($)
    setStatusSegment($, 'documents', view === null ? undefined : view.summary)
    const t = $.ui.resolve(e)
    const { Box, Text } = t

    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader(t, 'Документи', view === null ? undefined : view.summary)}
        {view === null ? (
          <Text dimColor>{EMPTY_TEXT}</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {view.groups.map(g => group(t, g))}
          </Box>
        )}
      </Box>
    )
  })
}
