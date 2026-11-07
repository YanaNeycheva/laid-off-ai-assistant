import { expect, test } from 'claude-code/testing'

import { extractDate, loadTracker, parseTracker } from '../hooks/shared/tracker'
import { BARE_DOSSIER, TRACKER_BOARD, TRACKER_OFFER, fakeFs, trackerMd } from './fixtures/data'

const TODAY = '2026-11-07'

test('template placeholders and untouched targets are not on the board', () => {
  expect(parseTracker(trackerMd(), TODAY)).toEqual([])
  const apps = parseTracker(TRACKER_BOARD, TODAY)
  expect(apps.length).toBe(7)
  expect(apps.some(a => a.company === 'Йота')).toBe(false)
})

test('applied: days since sent, explicit follow-up date wins, 10-day fallback', () => {
  const byName = Object.fromEntries(parseTracker(TRACKER_BOARD, TODAY).map(a => [a.company, a]))
  expect(byName['Алфа Софт']).toMatchObject({ column: 'applied', daysSinceUpdate: 3, followupDue: false }) // follow-up 11.11 is ahead
  expect(byName['Бета Системи']).toMatchObject({ daysSinceUpdate: 6, followupDue: false })
  expect(byName['Гама Лабс']).toMatchObject({ daysSinceUpdate: 12, followupDue: true }) // fallback
  expect(byName['Делта Тех']).toMatchObject({ daysSinceUpdate: 1, followupDue: true }) // explicit past date
})

test('talking: a date in the next-step cell is the interview, none leaves it unset', () => {
  const byName = Object.fromEntries(parseTracker(TRACKER_BOARD, TODAY).map(a => [a.company, a]))
  expect(byName['Епсилон']).toMatchObject({ column: 'talking', interview: '2026-11-14' })
  expect(byName['Зета Груп']?.column).toBe('talking')
  expect(byName['Зета Груп']?.interview).toBeUndefined()
})

test('closed: "да" is an offer, anything else a rejection', () => {
  const cols = Object.fromEntries(parseTracker(TRACKER_OFFER, TODAY).map(a => [a.company, a.column]))
  expect(cols).toEqual({ 'Тета Мед': 'offer', 'Капа Груп': 'rejected' })
  expect(parseTracker(TRACKER_BOARD, TODAY).find(a => a.company === 'Ета Дигитал')?.column).toBe('rejected')
})

test('year-less dates take the year nearest today; explicit years are kept', () => {
  expect(extractDate('интервю — 14.11', TODAY)).toBe('2026-11-14')
  expect(extractDate('05.01', TODAY)).toBe('2027-01-05')
  expect(extractDate('28.12', '2027-01-03')).toBe('2026-12-28')
  expect(extractDate('3.11.2026', TODAY)).toBe('2026-11-03')
  expect(extractDate('няма дата', TODAY)).toBe(null)
  expect(extractDate('31.02', TODAY)).toBe(null)
})

test('bad dates and missing columns do not crash or invent numbers', () => {
  const md = trackerMd({
    applied: ['| Омега | PM | скоро | 99.99 | CV | — |', '| Сигма | PM |'],
    talking: ['| Пи | PM | В процес |'],
  })
  const apps = parseTracker(md, TODAY)
  const omega = apps.find(a => a.company === 'Омега')!
  expect(omega.daysSinceUpdate).toBeUndefined()
  expect(omega.followupDue).toBe(false)
  expect(apps.find(a => a.company === 'Сигма')?.followupDue).toBe(false)
  expect(apps.find(a => a.company === 'Пи')?.interview).toBeUndefined()
  expect(parseTracker('', TODAY)).toEqual([])
  expect(parseTracker('## 🟢 В движение\nбез таблица\n', TODAY)).toEqual([])
})

test('loadTracker reads the dossier folder, then one level below, else null', async () => {
  const f = (text: string) => ({ text, mtimeMs: 1 })
  const direct = fakeFs({ 'Personal/p/dossier.md': f(BARE_DOSSIER), 'Personal/p/tracker.md': f('A') })
  expect(await loadTracker(direct, 'Personal/p')).toBe('A')
  const nested = fakeFs({ 'Personal/p/dossier.md': f(BARE_DOSSIER), 'Personal/p/search/tracker.md': f('B') })
  expect(await loadTracker(nested, 'Personal/p')).toBe('B')
  const none = fakeFs({ 'Personal/p/dossier.md': f(BARE_DOSSIER) })
  expect(await loadTracker(none, 'Personal/p')).toBe(null)
})

test('a sent date that resolves to the future is unknown: no negative days, no follow-up', () => {
  const [app] = parseTracker(trackerMd({ applied: ['| Футура | PM | 20.12 | — | — | — |'] }), TODAY)
  expect(app?.daysSinceUpdate).toBeUndefined()
  expect(app?.followupDue).toBe(false)
})
