// Feature 5: Финансов хоризонт (runway). A side pane "Хоризонт" with a rough
// number of months the person's money lasts, a stacked bar by source and a
// status-line segment `~7 месеца хоризонт`.
//
// Data: the `Finances` section of the dossier (see agent/dossier-template.md).
// The mod ONLY adds and divides numbers the person shared: it never derives the
// НОИ benefit from legal rules. The НОИ pot counts only when `noi-confirmed` is
// `да`; otherwise it is left out of the headline AND the bar and flagged
// "за потвърждение в НОИ". Always an estimate. Read-only.

import type { On } from 'claude-code'

import { dossierFs, loadDossierSection, parseAmount, type Entry } from '../shared/dossier'
import { setStatusSegment } from '../shared/status'
import { card, legend, paneHeader, pill, stackedMeter, type Tone, type UiTable } from '../shared/ui'

const PANE = 'comeback-runway'
const NOTE = 'ориентировъчно'
const PENDING_PILL = 'за потвърждение в НОИ'
const NO_EXPENSES_TEXT = 'Добави месечните си разходи, за да покажа хоризонт.'
const NO_SOURCE_TEXT =
  'Добави спестявания, обезщетение при съкращение или потвърдена сума от НОИ, за да покажа хоризонт.'
const FOOTER = 'Ориентир, не обещание. Сумата на обезщетението се потвърждава в НОИ.'
const EMPTY_TEXT = 'Когато споделиш числата си, хоризонтът ще се покаже тук.'

export type RunwaySegment = {
  key: 'severance' | 'noi' | 'savings'
  label: string
  tone: Tone
  /** Money in this pot. */
  pot: number
  /** Unrounded months this pot covers. */
  months: number
  /** Share of the counted total, 0..1. */
  fraction: number
}

export type RunwayView =
  | { kind: 'no-expenses' }
  | { kind: 'no-source'; expenses: number; currency: string; noiPending: boolean }
  | {
      kind: 'ok'
      /** Unrounded months of everything that counts. */
      months: number
      segments: RunwaySegment[]
      expenses: number
      currency: string
      /** A НОИ amount exists but is not confirmed: excluded from months and segments. */
      noiPending: boolean
    }

/** `да` / `yes` (any case) counts as confirmed. */
export function isConfirmed(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase()

  return v === 'да' || v === 'yes'
}

/** `1 месец`, `7 месеца`, `<1 месец`. Rounds DOWN: overstating a runway is the unsafe direction. */
export function monthsText(months: number): string {
  if (months < 1) {
    return '<1 месец'
  }
  const n = Math.floor(months)

  return n === 1 ? '1 месец' : `${n} месеца`
}

/** Legend value: `2 м.`, `<1 м.`. */
export function monthsShort(months: number): string {
  return months < 1 ? '<1 м.' : `${Math.floor(months)} м.`
}

/** `1 200 €`; up to two decimals only when not whole. Other currencies show their code. */
export function formatAmount(amount: number, currency: string): string {
  const fixed = Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
  const [whole = '', frac] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const sign = currency.toUpperCase() === 'EUR' ? '€' : currency
  const number = frac === undefined ? grouped : `${grouped},${frac}`

  return `${number} ${sign}`
}

/** Headline and status text share one number: `~7 месеца`. */
export function headline(months: number): string {
  return months < 1 ? monthsText(months) : `~${monthsText(months)}`
}

export function statusText(months: number): string {
  return `${headline(months)} хоризонт`
}

/** Pure: the dossier's Finances entry (or none) to what the pane shows. */
export function buildRunway(entry: Entry | undefined): RunwayView | null {
  if (entry === undefined) {
    return null
  }
  const expenses = parseAmount(entry['monthly-expenses'])
  const savings = parseAmount(entry.savings) ?? 0
  const severance = parseAmount(entry.severance) ?? 0
  const noiMonthly = parseAmount(entry['noi-monthly']) ?? 0
  const noiMonths = parseAmount(entry['noi-months']) ?? 0
  const noiPot = noiMonthly * noiMonths
  const confirmed = isConfirmed(entry['noi-confirmed'])
  // A НОИ figure that was given but is not both confirmed and complete is
  // flagged, never silently dropped.
  const noiGiven = noiMonthly > 0 || noiMonths > 0
  const noiPending = noiGiven && !(confirmed && noiPot > 0)
  const currency = entry.currency ?? 'EUR'

  if (expenses === null || expenses <= 0) {
    return { kind: 'no-expenses' }
  }

  // Order is the bar's order: severance, НОИ, savings.
  const pots: Array<Omit<RunwaySegment, 'months' | 'fraction'>> = [
    { key: 'severance', label: 'Обезщетение при съкращение', tone: 'violet', pot: severance },
    { key: 'noi', label: 'Обезщетение от НОИ', tone: 'info', pot: confirmed ? noiPot : 0 },
    { key: 'savings', label: 'Спестявания', tone: 'ok', pot: savings },
  ]
  const counted = pots.filter(p => p.pot > 0)
  const total = counted.reduce((sum, p) => sum + p.pot, 0)
  if (total <= 0) {
    return { kind: 'no-source', expenses, currency, noiPending }
  }

  return {
    kind: 'ok',
    months: total / expenses,
    segments: counted.map(p => ({ ...p, months: p.pot / expenses, fraction: p.pot / total })),
    expenses,
    currency,
    noiPending,
  }
}

async function load($: Parameters<typeof dossierFs>[0]): Promise<RunwayView | null> {
  const found = await loadDossierSection(dossierFs($), 'Finances')

  return found === null ? null : buildRunway(found.entries[0])
}

function statusFor(view: RunwayView | null): string | undefined {
  return view !== null && view.kind === 'ok' ? statusText(view.months) : undefined
}

function pending(t: UiTable) {
  const { Box, Text } = t

  return (
    <Box flexDirection="column">
      <Box>{pill(t, PENDING_PILL, 'info')}</Box>
      <Text dimColor>Сумата от НОИ не е включена в хоризонта по-горе.</Text>
    </Box>
  )
}

export function registerRunway(on: On) {
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    await $.command.register({
      name: 'runway',
      description: 'Покажи панела Финансов хоризонт',
    })
    void $.ui.open({ id: PANE, title: 'Хоризонт' })
    setStatusSegment($, 'runway', statusFor(await load($)))

    return next(e)
  })

  on('command.run', { command: 'runway' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Хоризонт' })

    return { text: 'Панелът Финансов хоризонт е отворен.' }
  })

  // No prompt.submit / turn.complete hooks here: register.tsx invalidates
  // `ui.render` around each turn, which re-runs the pane hook below.

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const view = await load($)
    setStatusSegment($, 'runway', statusFor(view))
    const t = $.ui.resolve(e)
    const { Box, Text } = t
    const columns = Math.max(10, e.props.bodyColumns - 4)

    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader(t, 'Хоризонт', NOTE)}
        {view === null ? <Text dimColor>{EMPTY_TEXT}</Text> : null}
        {view !== null && view.kind === 'no-expenses' ? <Text dimColor>{NO_EXPENSES_TEXT}</Text> : null}
        {view !== null && view.kind === 'no-source' ? (
          <Box flexDirection="column" gap={1}>
            <Text dimColor>{NO_SOURCE_TEXT}</Text>
            {view.noiPending ? pending(t) : null}
          </Box>
        ) : null}
        {view !== null && view.kind === 'ok' ? (
          <Box flexDirection="column" gap={1}>
            <Text weight="semibold">{headline(view.months)}</Text>
            {stackedMeter(t, {
              segments: view.segments.map(s => ({ fraction: s.fraction, tone: s.tone })),
              columns,
            })}
            {legend(
              t,
              view.segments.map(s => ({ tone: s.tone, label: s.label, value: monthsShort(s.months) })),
            )}
            {card(
              t,
              'neutral',
              <Box flexDirection="column">
                <Text>{`Разходи: ${formatAmount(view.expenses, view.currency)}/мес. (по твоите данни).`}</Text>
                {view.noiPending ? <Text dimColor>Сумата от НОИ е за потвърждение в НОИ.</Text> : null}
              </Box>,
            )}
            {view.noiPending ? pending(t) : null}
            <Text dimColor>{FOOTER}</Text>
          </Box>
        ) : null}
      </Box>
    )
  })
}
