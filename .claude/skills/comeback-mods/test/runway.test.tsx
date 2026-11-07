import { expect, mock, test } from 'claude-code/testing'

import {
  buildRunway,
  formatAmount,
  headline,
  monthsShort,
  monthsText,
  statusText,
} from '../hooks/features/runway'
import { parseAmount, parseEntries, parseSections } from '../hooks/shared/dossier'
import {
  FINANCES_CONFIRMED,
  FINANCES_NO_EXPENSES,
  FINANCES_NO_SOURCE,
  FINANCES_UNCONFIRMED,
  TODAY_MS,
  financesDossier,
  financesTree,
  treeFs,
} from './fixtures/data'

const entryOf = (dossier: string) => parseEntries(parseSections(dossier)['Finances'] ?? '')[0]

test('parseAmount reads plain, spaced, grouped and decimal numbers', () => {
  expect(parseAmount('1200')).toBe(1200)
  expect(parseAmount('1 200')).toBe(1200)
  expect(parseAmount('1,200.50')).toBe(1200.5)
  expect(parseAmount('1.200,50')).toBe(1200.5)
  expect(parseAmount('1200,50')).toBe(1200.5)
  expect(parseAmount('1,200')).toBe(1200)
  expect(parseAmount('1200 EUR')).toBe(1200)
  expect(parseAmount('1200 €')).toBe(1200)
  expect(parseAmount('1 500,50')).toBe(1500.5)
  expect(parseAmount('2300')).toBe(2300)
  expect(parseAmount('3000 лв.')).toBe(3000)
  expect(parseAmount('3000 (до 31.12)')).toBe(null)
  expect(parseAmount('2 мес. по 500')).toBe(null)
  expect(parseAmount('3000 лв, от 2024')).toBe(null)
  expect(parseAmount('1000-1500')).toBe(null)
  expect(parseAmount('')).toBe(null)
  expect(parseAmount(undefined)).toBe(null)
  expect(parseAmount('много')).toBe(null)
  expect(parseAmount('-5')).toBe(null)
})

test('monthsText: rounding, <1 and grammar', () => {
  expect(monthsText(7)).toBe('7 месеца')
  expect(monthsText(6.9)).toBe('6 месеца')
  expect(monthsText(1)).toBe('1 месец')
  expect(monthsText(1.4)).toBe('1 месец')
  expect(monthsText(0.4)).toBe('<1 месец')
  expect(monthsShort(2)).toBe('2 м.')
  expect(monthsShort(0.5)).toBe('<1 м.')
  expect(monthsShort(2.9)).toBe('2 м.')
  expect(headline(0.3)).toBe('<1 месец')
  expect(statusText(7)).toBe('~7 месеца хоризонт')
  expect(statusText(0.3)).toBe('<1 месец хоризонт')
})

test('formatAmount groups thousands and marks the currency', () => {
  expect(formatAmount(1000, 'EUR')).toBe('1 000 €')
  expect(formatAmount(1234567, 'EUR')).toBe('1 234 567 €')
  expect(formatAmount(850.5, 'EUR')).toBe('850,50 €')
  expect(formatAmount(900, 'BGN')).toBe('900 BGN')
})

test('confirmed НОИ: all three sources count, in bar order', () => {
  const v = buildRunway(entryOf(FINANCES_CONFIRMED))!
  expect(v.kind).toBe('ok')
  if (v.kind !== 'ok') return
  expect(v.months).toBe(7)
  expect(v.noiPending).toBe(false)
  expect(v.segments.map(s => [s.key, s.tone, s.months])).toEqual([
    ['severance', 'violet', 2],
    ['noi', 'info', 2],
    ['savings', 'ok', 3],
  ])
  expect(Math.round(v.segments.reduce((a, s) => a + s.fraction, 0) * 1000)).toBe(1000)
})

test('unconfirmed НОИ: left out of headline and bar, flagged', () => {
  const v = buildRunway(entryOf(FINANCES_UNCONFIRMED))!
  expect(v.kind).toBe('ok')
  if (v.kind !== 'ok') return
  expect(v.months).toBe(5)
  expect(v.noiPending).toBe(true)
  expect(v.segments.map(s => s.key)).toEqual(['severance', 'savings'])
})

test('confirmed НОИ without months is flagged, not silently dropped', () => {
  const v = buildRunway(entryOf(financesDossier(['savings: 3000', 'monthly-expenses: 1000', 'noi-monthly: 500', 'noi-confirmed: да'])))!
  expect(v.kind).toBe('ok')
  if (v.kind !== 'ok') return
  expect(v.months).toBe(3)
  expect(v.noiPending).toBe(true)
  expect(v.segments.map(s => s.key)).toEqual(['savings'])
})

test('missing expenses: no view with months', () => {
  expect(buildRunway(entryOf(FINANCES_NO_EXPENSES))).toEqual({ kind: 'no-expenses' })
  expect(buildRunway(undefined)).toBe(null)
})

test('expenses but no counted source', () => {
  const v = buildRunway(entryOf(FINANCES_NO_SOURCE))!
  expect(v.kind).toBe('no-source')
  if (v.kind !== 'no-source') return
  expect(v.noiPending).toBe(true)
})

// ---- drawing ----

const PANE = {
  plugin: 'comeback',
  component: 'Pane',
  requestId: 'comeback-runway',
  props: {
    title: 'Хоризонт',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const rel = (path: string) => path.replaceAll('\\', '/').replace(/^.*?(?=Personal)/, '')

function withTree(on: Parameters<typeof mock.clock>[0], files: ReturnType<typeof financesTree>) {
  const fs = treeFs(files)
  mock.clock(on, { now: TODAY_MS })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('fs.list', async (_, e) => {
    try {
      const entries = await fs.list(rel(e.path))

      return { value: entries.map(x => ({ name: x.name, kind: x.kind === 'dir' ? ('dir' as const) : ('file' as const), size: 0, mtimeMs: 0, isLink: false })) }
    } catch {
      return { deny: 'ENOENT' }
    }
  })
  on('fs.stat', async (_, e) => {
    try {
      const s = await fs.stat(rel(e.path))

      return { value: { kind: 'file', size: 1, mtimeMs: s.mtimeMs, isLink: false } }
    } catch {
      return { deny: 'ENOENT' }
    }
  })
  on('fs.read', async (_, e) => {
    try {
      return { value: await fs.read(rel(e.path)) }
    } catch {
      return { deny: 'ENOENT' }
    }
  })
}

const FOOTER = 'Ориентир, не обещание. Сумата на обезщетението се потвърждава в НОИ.'
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

test('confirmed pane: headline, legend, card, no pending line', async ($, on) => {
  withTree(on, financesTree(FINANCES_CONFIRMED))
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    for (const text of ['Хоризонт', 'ориентировъчно', '~7 месеца', 'Обезщетение при съкращение', 'Обезщетение от НОИ', 'Спестявания', '2 м.', '3 м.']) {
      expect(await ui.find({ type: 'Text', text })).toBeDefined()
    }
    expect(await ui.find({ type: 'Text', text: /Разходи: 1 000 €\/мес\. \(по твоите данни\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /за потвърждение в НОИ/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: FOOTER })).toBeDefined()
    await ui.unmount()
  }
})

test('unconfirmed pane: headline excludes НОИ and the pending line shows', async ($, on) => {
  withTree(on, financesTree(FINANCES_UNCONFIRMED))
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: '~5 месеца' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Обезщетение от НОИ' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'за потвърждение в НОИ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Сумата от НОИ е за потвърждение в НОИ.' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /не е включена в хоризонта/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: FOOTER })).toBeDefined()
    await ui.unmount()
  }
})

test('confirmed but incomplete НОИ: pending block renders, headline excludes it', async ($, on) => {
  withTree(on, financesTree(financesDossier(['savings: 3000', 'monthly-expenses: 1000', 'noi-monthly: 500', 'noi-confirmed: да'])))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: '~3 месеца' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'за потвърждение в НОИ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /не е включена в хоризонта/ })).toBeDefined()
  await ui.unmount()
})

test('under one month: headline without a tilde', async ($, on) => {
  withTree(on, financesTree(financesDossier(['savings: 300', 'monthly-expenses: 1000'])))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: '<1 месец' })).toBeDefined()
  await ui.unmount()
})

test('missing expenses: one calm line, no number', async ($, on) => {
  withTree(on, financesTree(FINANCES_NO_EXPENSES))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Добави месечните си разходи, за да покажа хоризонт.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /месеца/ })).toBeUndefined()
  await ui.unmount()
})

test('expenses but no source: what is missing, plus the pending НОИ flag', async ($, on) => {
  withTree(on, financesTree(FINANCES_NO_SOURCE))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Добави спестявания/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'за потвърждение в НОИ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /месеца/ })).toBeUndefined()
  await ui.unmount()
})
