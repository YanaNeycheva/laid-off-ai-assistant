// Feature 3: Кандидатури (application pipeline). A side pane "Кандидатури" with
// the applications as four columns (Кандидатствах, Разговор, Оферта, Отказ), plus
// a status-line segment `7 кандидатури · 2 разговора`.
//
// Data: the person's own `tracker.md`, parsed by ../shared/tracker (no dossier
// section, so there is no second copy to drift). Read-only.

import type { On } from 'claude-code'

import { dossierFs, findCurrentDossier, formatBgDate, isoToday } from '../shared/dossier'
import type { StartApi } from '../shared/session'
import { setStatusSegment } from '../shared/status'
import { FOLLOWUP_DAYS, loadTracker, parseTracker, type TrackerApp, type TrackerColumn } from '../shared/tracker'
import { COLORS, card, paneHeader, pill, type UiTable } from '../shared/ui'

export { FOLLOWUP_DAYS }

const PANE = 'comeback-pipeline'
const EMPTY_TEXT = 'Кандидатурите ти ще се появят тук, щом тръгнем.'
const NO_OFFER_TEXT = 'Още няма. Нормално е на 3-та седмица.'
const FOLLOWUP_TEXT = 'време за follow-up'

/** The funnel, in display order. */
export const COLUMNS: readonly { key: TrackerColumn; title: string }[] = [
  { key: 'applied', title: 'Кандидатствах' },
  { key: 'talking', title: 'Разговор' },
  { key: 'offer', title: 'Оферта' },
  { key: 'rejected', title: 'Отказ' },
]

export type ColumnView = { key: TrackerColumn; title: string; count: number; cards: TrackerApp[] }

export type PipelineView = { columns: ColumnView[]; total: number; summary: string }

/** `1 ден`, else `N дни`. */
export function dayCount(n: number): string {
  return n === 1 ? '1 ден' : `${n} дни`
}

export function applicationsText(n: number): string {
  return n === 1 ? '1 кандидатура' : `${n} кандидатури`
}

export function conversationsText(n: number): string {
  return n === 1 ? '1 разговор' : `${n} разговора`
}

/** `2026-11-14` to `14.11`. */
export function shortDate(iso: string): string {
  return formatBgDate(iso).slice(0, 5)
}

/** Null when there are no applications. */
export function buildPipeline(apps: TrackerApp[]): PipelineView | null {
  if (apps.length === 0) {
    return null
  }
  const columns: ColumnView[] = COLUMNS.map(c => {
    const cards = apps.filter(a => a.column === c.key)

    return { ...c, count: cards.length, cards }
  })
  const talking = columns.find(c => c.key === 'talking')!.count

  return {
    columns,
    total: apps.length,
    summary: `${applicationsText(apps.length)} · ${conversationsText(talking)}`,
  }
}

async function load($: Parameters<typeof dossierFs>[0] & { clock: { now: () => Promise<number> } }) {
  const fs = dossierFs($)
  const dossier = await findCurrentDossier(fs)
  if (dossier === null) {
    return null
  }
  const text = await loadTracker(fs, dossier.dir)
  if (text === null) {
    return null
  }

  return buildPipeline(parseTracker(text, isoToday(await $.clock.now())))
}

/** The dim second line of a card. */
export function detail(c: TrackerApp): string {
  if (c.column === 'talking' && c.interview !== undefined) {
    return `${c.role === '' ? 'интервю' : `${c.role} · интервю`} ${shortDate(c.interview)}`
  }
  const days = c.column === 'applied' && c.daysSinceUpdate !== undefined ? dayCount(c.daysSinceUpdate) : ''

  return [c.role, days].filter(p => p !== '').join(' · ')
}

function cardRow(t: UiTable, c: TrackerApp) {
  const { Box, Text } = t
  const line = detail(c)

  return card(
    t,
    c.followupDue ? 'warn' : 'neutral',
    <Box flexDirection="column">
      <Text weight="semibold" dimColor={c.column === 'rejected'}>
        {c.company}
      </Text>
      {line === '' ? null : <Text dimColor>{line}</Text>}
      {c.followupDue ? <Text color={COLORS.warn}>{FOLLOWUP_TEXT}</Text> : null}
    </Box>,
  )
}

function column(t: UiTable, col: ColumnView) {
  const { Box, Text } = t

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text weight="semibold">{col.title}</Text>
        {pill(t, String(col.count), 'neutral')}
      </Box>
      {col.cards.map(c => cardRow(t, c))}
      {col.key === 'offer' && col.count === 0 ? (
        <Box borderStyle="dashed" borderColor={COLORS.line} paddingX={1}>
          <Text dimColor>{NO_OFFER_TEXT}</Text>
        </Box>
      ) : null}
    </Box>
  )
}

/** Called from register.tsx's single session.start hook. */
export async function startPipeline($: StartApi) {
  await $.command.register({
    name: 'pipeline',
    description: 'Покажи панела Кандидатури',
  })
  void $.ui.open({ id: PANE, title: 'Кандидатури' })
  const view = await load($)
  setStatusSegment($, 'pipeline', view === null ? undefined : view.summary)
}

export function registerPipeline(on: On) {
  on('command.run', { command: 'pipeline' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Кандидатури' })

    return { text: 'Панелът Кандидатури е отворен.' }
  })

  // No prompt.submit / turn.complete hooks here: the engine allows one unmatched
  // hook per event per plugin, and register.tsx already invalidates `ui.render`
  // around each turn. That redraw re-runs the pane hook below.

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const view = await load($)
    setStatusSegment($, 'pipeline', view === null ? undefined : view.summary)
    const t = $.ui.resolve(e)
    const { Box, Text } = t

    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader(t, 'Кандидатури', view === null ? undefined : view.summary)}
        {view === null ? (
          <Text dimColor>{EMPTY_TEXT}</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {view.columns.map(col => column(t, col))}
          </Box>
        )}
      </Box>
    )
  })
}
