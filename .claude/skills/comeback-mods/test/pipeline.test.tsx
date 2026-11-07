import { expect, mock, test } from 'claude-code/testing'

import {
  COLUMNS,
  FOLLOWUP_DAYS,
  applicationsText,
  buildPipeline,
  conversationsText,
  dayCount,
  detail,
} from '../hooks/features/pipeline'
import { parseTracker } from '../hooks/shared/tracker'
import { BARE_DOSSIER, TODAY_MS, TRACKER_BOARD, TRACKER_OFFER, trackerMd } from './fixtures/data'

const TODAY = '2026-11-07'

function view(md: string) {
  return buildPipeline(parseTracker(md, TODAY))
}

test('columns are the four funnel stages in order; threshold is 10 days', () => {
  expect(COLUMNS.map(c => c.title)).toEqual(['Кандидатствах', 'Разговор', 'Оферта', 'Отказ'])
  expect(FOLLOWUP_DAYS).toBe(10)
})

test('counts per column, total and summary', () => {
  const v = view(TRACKER_BOARD)!
  expect(v.columns.map(c => c.count)).toEqual([4, 2, 0, 1])
  expect(v.total).toBe(7)
  expect(v.summary).toBe('7 кандидатури · 2 разговора')
  expect(view(TRACKER_OFFER)!.columns.map(c => c.count)).toEqual([0, 0, 1, 1])
})

test('plurals', () => {
  expect(applicationsText(1)).toBe('1 кандидатура')
  expect(applicationsText(5)).toBe('5 кандидатури')
  expect(conversationsText(1)).toBe('1 разговор')
  expect(conversationsText(2)).toBe('2 разговора')
  expect(dayCount(1)).toBe('1 ден')
  expect(dayCount(3)).toBe('3 дни')
  const one = view(trackerMd({ talking: ['| А | PM | В процес | 14.11 | — | — |'] }))!
  expect(one.summary).toBe('1 кандидатура · 1 разговор')
})

test('card detail lines', () => {
  const cards = Object.fromEntries(view(TRACKER_BOARD)!.columns.flatMap(c => c.cards).map(a => [a.company, a]))
  expect(detail(cards['Алфа Софт']!)).toBe('Project Manager · 3 дни')
  expect(detail(cards['Делта Тех']!)).toBe('Program Manager · 1 ден')
  expect(detail(cards['Епсилон']!)).toBe('HR скрийнинг · интервю 14.11')
  expect(detail(cards['Зета Груп']!)).toBe('Hiring manager')
  expect(detail(cards['Ета Дигитал']!)).toBe('Delivery Lead')
})

test('follow-up: explicit past date, 10-day fallback, only applied cards', () => {
  const at = (sent: string) =>
    parseTracker(trackerMd({ applied: [`| А | PM | ${sent} | — | — | — |`] }), TODAY)[0]!
  expect(at('29.10').followupDue).toBe(false) // 9 days
  expect(at('28.10').followupDue).toBe(true) // 10 days
  expect(at('01.10').followupDue).toBe(true)
  const talking = parseTracker(trackerMd({ talking: ['| А | PM | В процес | 01.10 | — | — |'] }), TODAY)[0]!
  expect(talking.followupDue).toBe(false)
})

test('no apps gives no pipeline', () => {
  expect(view(trackerMd())).toBe(null)
  expect(view('')).toBe(null)
})

// ---- drawing ----

const PANE = {
  plugin: 'comeback',
  component: 'Pane',
  requestId: 'comeback-pipeline',
  props: {
    title: 'Кандидатури',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

function withFiles(on: Parameters<typeof mock.clock>[0], tracker: string | null) {
  mock.clock(on, { now: TODAY_MS })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('fs.list', (_, e) =>
    /Personal$/.test(e.path)
      ? { value: [{ name: 'p', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] }
      : { value: [] },
  )
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 1, isLink: false } }))
  on('fs.read', (_, e) =>
    /tracker\.md$/.test(e.path)
      ? tracker === null
        ? { deny: 'no tracker' }
        : { value: tracker }
      : { value: BARE_DOSSIER },
  )
}

test('board shows columns, counts, cards, interview, follow-up and the empty Оферта line', async ($, on) => {
  withFiles(on, TRACKER_BOARD)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    for (const title of ['Кандидатствах', 'Разговор', 'Оферта', 'Отказ']) {
      expect(await ui.find({ type: 'Text', text: title })).toBeDefined()
    }
    expect(await ui.find({ type: 'Text', text: /7 кандидатури · 2 разговора/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '4' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Алфа Софт' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Project Manager · 3 дни/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Program Manager · 1 ден/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /HR скрийнинг · интервю 14\.11/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'време за follow-up' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Още няма\. Нормално е на 3-та седмица\./ })).toBeDefined()
    await ui.unmount()
  }
})

test('an offer fills the Оферта column and the steadying line goes away', async ($, on) => {
  withFiles(on, TRACKER_OFFER)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Тета Мед' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Още няма/ })).toBeUndefined()
  await ui.unmount()
})

test('follow-up note is absent when nothing is due', async ($, on) => {
  withFiles(on, trackerMd({ applied: ['| Нова | PM | 05.11 | — | — | — |'] }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'време за follow-up' })).toBeUndefined()
  await ui.unmount()
})

test('no apps shows one calm line', async ($, on) => {
  withFiles(on, trackerMd())
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Кандидатурите ти ще се появят тук/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Разговор' })).toBeUndefined()
  await ui.unmount()
})

test('no tracker file shows the same calm line', async ($, on) => {
  withFiles(on, null)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Кандидатурите ти ще се появят тук/ })).toBeDefined()
  await ui.unmount()
})
