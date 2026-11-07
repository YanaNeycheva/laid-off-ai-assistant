// Feature 1: Срокове (deadlines). A band above the prompt with the nearest
// verified deadline, and a side pane listing all of them.
//
// Data: the `Deadlines` section of the person's dossier (ASCII keys, see
// agent/dossier-template.md) plus the verification log in bg-legal.md.
// Gate: a deadline counts down ONLY if its fact is `✅ потвърдено` in that log;
// otherwise it is drawn as `за проверка` with the official link. Read-only.

import type { On } from 'claude-code'

import {
  daysBetween,
  dossierFs,
  formatBgDate,
  isoToday,
  loadDossierSection,
  parseIsoDate,
  type Entry,
} from '../shared/dossier'
import { findFact, loadVerificationLog, type FactRow } from '../shared/legal'
import type { StartApi } from '../shared/session'
import { band, card, meter, paneHeader, pill, toneColor, type Tone } from '../shared/ui'

const PANE = 'comeback-deadlines'
const FOOTER = 'Ориентировъчно. Провери в НОИ и Агенцията по заетостта.'
/** Window used for the meter when an entry has no `start`. */
const DEFAULT_WINDOW_DAYS = 30
export const WARN_DAYS = 7
export const BAD_DAYS = 2

/** `fact` keys an entry may use, mapped to the Дневник на проверките row. */
export const FACTS: Record<string, { label: string; fallbackSource: string }> = {
  'bureau-registration': {
    label: 'Срок регистрация в Бюро по труда',
    fallbackSource: 'https://az.government.bg',
  },
  'noi-application': {
    label: 'Срок молба-декларация НОИ',
    fallbackSource: 'https://www.nssi.bg',
  },
  // No row in the log yet: always `за проверка` until freshness-checker adds one.
  'health-insurance': {
    label: 'Срок здравно осигуряване',
    fallbackSource: 'https://nap.bg',
  },
}

export type DeadlineView = {
  title: string
  docs: string
  /** ISO due date; shown only when verified. */
  due: string
  isVerified: boolean
  /** Verified only. */
  daysLeft: number | null
  tone: Tone
  /** Share of the window still left, 0..1. Verified only. */
  fraction: number
  /** Verified: the log's check date (ISO). */
  checked: string
  /** Unverified: the official source to look at. */
  source: string
}

export function toneFor(daysLeft: number): Tone {
  if (daysLeft <= BAD_DAYS) {
    return 'bad'
  }

  return daysLeft <= WARN_DAYS ? 'warn' : 'neutral'
}

export function daysText(daysLeft: number): string {
  if (daysLeft < 0) {
    return 'изтекъл'
  }
  if (daysLeft === 0) {
    return 'днес'
  }

  return daysLeft === 1 ? '1 ден' : `${daysLeft} дни`
}

/** Entries without a valid ISO `due` or a `title` are dropped. */
export function buildDeadlines(
  entries: Entry[],
  log: FactRow[],
  today: string,
): DeadlineView[] {
  const views: DeadlineView[] = []

  for (const entry of entries) {
    const title = entry.title
    const due = entry.due
    if (!title || parseIsoDate(due) === null || due === undefined) {
      continue
    }
    const fact = FACTS[entry.fact ?? '']
    const row = fact ? findFact(log, fact.label) : undefined
    const isVerified = row !== undefined && row.isVerified
    const daysLeft = daysBetween(today, due)
    const start = entry.start && parseIsoDate(entry.start) !== null ? entry.start : null
    const window =
      (start !== null ? daysBetween(start, due) : null) ?? DEFAULT_WINDOW_DAYS

    views.push({
      title,
      docs: entry.docs ?? '',
      due,
      isVerified,
      daysLeft: isVerified ? daysLeft : null,
      tone: isVerified && daysLeft !== null ? toneFor(daysLeft) : 'info',
      fraction:
        isVerified && daysLeft !== null && window > 0 ? daysLeft / window : 0,
      checked: row?.checked ?? '',
      source: row?.source || fact?.fallbackSource || 'knowledge-base/bg-legal.md',
    })
  }

  // Verified first by nearest due date, then the ones that need checking.
  return views.sort((a, b) => {
    if (a.isVerified !== b.isVerified) {
      return a.isVerified ? -1 : 1
    }

    return a.due < b.due ? -1 : a.due > b.due ? 1 : 0
  })
}

/**
 * The deadline the band shows: the nearest UPCOMING verified one (views are
 * sorted by due date). Only when none is upcoming, the most recently expired
 * verified one. Null when nothing is verified.
 */
export function nearestVerified(views: DeadlineView[]): DeadlineView | null {
  const verified = views.filter(view => view.isVerified)
  const upcoming = verified.find(view => (view.daysLeft ?? -1) >= 0)

  return upcoming ?? verified[verified.length - 1] ?? null
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

export function bandText(view: DeadlineView): string {
  const days = view.daysLeft ?? 0
  if (days < 0) {
    return `⏳ Срокът за ${lowerFirst(view.title)} е изтекъл`
  }
  if (days === 0) {
    return `⏳ Днес е крайният срок: ${view.title}`
  }

  return `⏳ ${daysText(days)} до ${lowerFirst(view.title)}`
}

function host(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
}

async function load($: Parameters<typeof dossierFs>[0] & { clock: { now: () => Promise<number> } }) {
  const fs = dossierFs($)
  const found = await loadDossierSection(fs, 'Deadlines')
  if (found === null) {
    return { person: null, views: [] as DeadlineView[] }
  }
  const log = await loadVerificationLog(fs)
  const today = isoToday(await $.clock.now())

  return {
    person: found.dossier.slug,
    views: buildDeadlines(found.entries, log, today),
  }
}

/** Called from register.tsx's single session.start hook. */
export async function startDeadlines($: StartApi) {
  await $.command.register({
    name: 'deadlines',
    description: 'Покажи панела Срокове',
  })
  void $.ui.open({ id: PANE, title: 'Срокове' })
}

export function registerDeadlines(on: On) {
  on('command.run', { command: 'deadlines' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Срокове' })

    return { text: 'Панелът Срокове е отворен.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { views } = await load($)
    const nearest = nearestVerified(views)
    if (nearest === null || e.props.hasSurvey) {
      return next(e)
    }
    const t = $.ui.resolve(e)
    const { Box, Text } = t
    const color = toneColor(nearest.tone === 'neutral' ? 'ok' : nearest.tone)

    return band(
      t,
      nearest.tone,
      <Box gap={1}>
        <Text color={nearest.tone === 'neutral' ? undefined : color} weight="semibold">
          {bandText(nearest)}
        </Text>
        {nearest.checked !== '' ? (
          <Text dimColor>проверено на {formatBgDate(nearest.checked)}</Text>
        ) : null}
      </Box>,
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { views } = await load($)
    const t = $.ui.resolve(e)
    const { Box, Text, Link } = t
    const columns = Math.max(10, e.props.bodyColumns - 4)

    return (
      <Box flexDirection="column" gap={1}>
        {paneHeader(t, 'Срокове', views.length === 0 ? undefined : `${views.length} активни`)}
        {views.length === 0 ? <Text dimColor>Все още няма добавени срокове.</Text> : null}
        {views.map(view =>
          card(
            t,
            view.isVerified ? view.tone : 'neutral',
            <Box flexDirection="column">
              <Box justifyContent="space-between" gap={1}>
                <Text weight="semibold">{view.title}</Text>
                {view.isVerified && view.daysLeft !== null
                  ? pill(t, daysText(view.daysLeft), view.tone)
                  : pill(t, 'за проверка', 'info')}
              </Box>
              {view.isVerified ? (
                <Text dimColor>
                  до {formatBgDate(view.due)}
                  {view.docs !== '' ? ` · ${view.docs}` : ''}
                </Text>
              ) : (
                <Box gap={1}>
                  <Text dimColor>не е потвърдено · виж</Text>
                  {/^https?:/.test(view.source) ? (
                    <Link href={view.source} label={host(view.source)} />
                  ) : (
                    <Text dimColor>{view.source}</Text>
                  )}
                </Box>
              )}
              {view.isVerified
                ? meter(t, { fraction: view.fraction, tone: view.tone, columns })
                : null}
            </Box>,
          ),
        )}
        <Text dimColor>{FOOTER}</Text>
      </Box>
    )
  })
}
