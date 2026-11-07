// Feature 2: Етап (journey). A side pane "Твоят път" with a vertical stepper
// over the four stages of the guide, plus a status-line entry `етап 3/4 · търсене`.
//
// Data: the `Journey` section of the person's dossier (`stage` + `next`, see
// agent/dossier-template.md). Calm on purpose: no points, streaks or percentages.
// Read-only.

import type { On } from 'claude-code'

import { dossierFs, loadDossierSection, type Entry } from '../shared/dossier'
import { setStatusSegment } from '../shared/status'
import { COLORS, PULSE_SMIL, paneHeader, toneColor, type Tone, type UiTable } from '../shared/ui'

const PANE = 'comeback-journey'
const EMPTY_TEXT = 'Пътят ти ще се появи тук, щом започнем.'

export type Stage = { key: string; name: string; desc: string }

export const STAGES: readonly Stage[] = [
  { key: 'opora', name: 'Опора', desc: 'Регистрация, бюджет, първите дни' },
  { key: 'cv', name: 'CV', desc: 'Базово CV, ATS-проверено' },
  { key: 'search', name: 'Търсене', desc: 'Профил на целта, мрежа, кандидатури' },
  { key: 'interviews', name: 'Интервюта', desc: 'Разказът за напускането, пробни интервюта' },
]

export type StepView = {
  name: string
  desc: string
  state: 'done' | 'now' | 'pending'
  /** `✓` for done, the 1-based number otherwise. */
  marker: string
  /** Current stage only: the single next step. */
  next?: string
}

export type JourneyView = {
  /** 0-based index of the current stage. */
  index: number
  total: number
  /** `етап 3/4 · търсене` */
  statusText: string
  steps: StepView[]
}

/** Index of a stage key, or -1 when unknown. */
export function stageIndex(key: string | undefined): number {
  return STAGES.findIndex(stage => stage.key === key?.trim())
}

/** Null when there is no entry or its `stage` is not one of the four keys. */
export function buildJourney(entry: Entry | undefined): JourneyView | null {
  const index = stageIndex(entry?.stage)
  if (entry === undefined || index < 0) {
    return null
  }
  const next = entry.next?.trim() ?? ''

  const steps = STAGES.map((stage, i): StepView => {
    if (i < index) {
      return { name: stage.name, desc: stage.desc, state: 'done', marker: '✓' }
    }
    if (i === index) {
      return {
        name: stage.name,
        desc: stage.desc,
        state: 'now',
        marker: String(i + 1),
        ...(next !== '' ? { next } : {}),
      }
    }

    return { name: stage.name, desc: stage.desc, state: 'pending', marker: String(i + 1) }
  })

  return {
    index,
    total: STAGES.length,
    statusText: `етап ${index + 1}/${STAGES.length} · ${STAGES[index]!.name.toLowerCase()}`,
    steps,
  }
}

async function load($: Parameters<typeof dossierFs>[0]): Promise<JourneyView | null> {
  const found = await loadDossierSection(dossierFs($), 'Journey')

  return found === null ? null : buildJourney(found.entries[0])
}

/** The step marker: a gently pulsing disc on the graphical surfaces, static text on the terminal. */
function marker(t: UiTable, step: StepView) {
  const { Box, Text } = t
  const tone: Tone = step.state === 'done' ? 'ok' : step.state === 'now' ? 'info' : 'neutral'

  if (step.state === 'now' && 'Svg' in t) {
    const { Svg } = t
    const source =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">` +
      `<circle cx="10" cy="10" r="9" fill="${COLORS.info}">` +
      `${PULSE_SMIL}</circle>` +
      `<text x="10" y="14" text-anchor="middle" font-size="11" font-weight="bold" fill="#101012">${step.marker}</text></svg>`

    return (
      <Box width={3}>
        <Svg source={source} alt={step.marker} width={20} height={20} isInteractive />
      </Box>
    )
  }

  return (
    <Box width={3}>
      <Text
        color={step.state === 'pending' ? COLORS.dim : toneColor(tone)}
        weight="semibold"
      >
        {step.marker}
      </Text>
    </Box>
  )
}

function stepRow(t: UiTable, step: StepView) {
  const { Box, Text } = t

  return (
    <Box gap={1}>
      {marker(t, step)}
      <Box flexDirection="column">
        <Text weight="semibold" dimColor={step.state === 'pending'}>
          {step.name}
        </Text>
        {step.state === 'now' && step.next !== undefined ? (
          <Box gap={1}>
            <Text weight="semibold" color={COLORS.info}>
              Следва:
            </Text>
            <Text>{step.next}</Text>
          </Box>
        ) : (
          <Text dimColor>{step.desc}</Text>
        )}
      </Box>
    </Box>
  )
}

async function refreshStatus($: Parameters<typeof dossierFs>[0] & {
  ui: { status: (text: string | undefined) => void }
}) {
  const view = await load($)
  setStatusSegment($, 'journey', view === null ? undefined : view.statusText)
}

export function registerJourney(on: On) {
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    await $.command.register({
      name: 'journey',
      description: 'Покажи панела Твоят път',
    })
    void $.ui.open({ id: PANE, title: 'Твоят път' })
    await refreshStatus($)

    return next(e)
  })

  on('command.run', { command: 'journey' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Твоят път' })

    return { text: 'Панелът Твоят път е отворен.' }
  })

  // No prompt.submit / turn.complete hooks here: the engine allows one unmatched
  // hook per event per plugin, and register.tsx already invalidates `ui.render`
  // around each turn. That redraw re-runs the pane hook below, which also
  // refreshes the status line.

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const view = await load($)
    setStatusSegment($, 'journey', view === null ? undefined : view.statusText)
    const t = $.ui.resolve(e)
    const { Box, Text } = t

    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader(t, 'Твоят път', view === null ? undefined : view.statusText)}
        {view === null ? (
          <Text dimColor>{EMPTY_TEXT}</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {view.steps.map(step => stepRow(t, step))}
          </Box>
        )}
      </Box>
    )
  })
}
