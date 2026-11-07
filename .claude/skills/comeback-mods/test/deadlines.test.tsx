import { expect, mock, test } from 'claude-code/testing'

import {
  bandText,
  buildDeadlines,
  nearestVerified,
  toneFor,
} from '../hooks/features/deadlines'
import { parseEntries, parseSections } from '../hooks/shared/dossier'
import { parseVerificationLog } from '../hooks/shared/legal'
import { EMPTY, FAR, dossier, NEAR, RED, TODAY_MS, UNVERIFIED_ONLY, legalLog } from './fixtures/data'

const TODAY = '2026-11-07'

function views(text: string, bureau?: '✅ потвърдено' | '⚠️ непроверено') {
  const entries = parseEntries(parseSections(text)['Deadlines'] ?? '')

  return buildDeadlines(entries, parseVerificationLog(legalLog({ bureau })), TODAY)
}

test('thresholds: neutral far, amber at 7 days, red at 2 days', () => {
  expect(toneFor(30)).toBe('neutral')
  expect(toneFor(8)).toBe('neutral')
  expect(toneFor(7)).toBe('warn')
  expect(toneFor(3)).toBe('warn')
  expect(toneFor(2)).toBe('bad')
  expect(toneFor(0)).toBe('bad')
  expect(toneFor(-1)).toBe('bad')
})

test('near fixture: amber bureau first, neutral NOI, health is за проверка', () => {
  const list = views(NEAR)
  expect(list.map(v => v.title)).toEqual([
    'Регистрация в Бюрото по труда',
    'Заявление за обезщетение (НОИ)',
    'Здравно осигуряване',
  ])
  expect(list[0]?.daysLeft).toBe(5)
  expect(list[0]?.tone).toBe('warn')
  expect(list[1]?.daysLeft).toBe(19)
  expect(list[1]?.tone).toBe('neutral')
  // Unverified: no countdown, official source kept.
  expect(list[2]?.isVerified).toBe(false)
  expect(list[2]?.daysLeft).toBe(null)
  expect(list[2]?.source).toBe('https://nra.bg/wps/wcm/connect/agency/site/uslugi/deklarirane-na-zravno-osigurqvane-za-sobstvena-smetka-obrazec-7')
  // The НАП обр. 7 page is offered so the person need not search nra.bg.
  expect(list[2]?.guide?.url).toBe('https://nra.bg/wps/wcm/connect/agency/site/uslugi/deklarirane-na-zravno-osigurqvane-za-sobstvena-smetka-obrazec-7')
  expect(list[0]?.guide).toBe(null)
  expect(bandText(nearestVerified(list)!)).toBe('⏳ 5 дни до регистрация в Бюрото по труда')
})

test('red fixture is red; far fixture is neutral', () => {
  expect(views(RED)[0]?.tone).toBe('bad')
  expect(views(FAR)[0]?.tone).toBe('neutral')
})

test('a fact the log does not confirm never counts down', () => {
  const list = views(NEAR, '⚠️ непроверено')
  const bureau = list.find(v => v.title.startsWith('Регистрация'))
  expect(bureau?.isVerified).toBe(false)
  expect(bureau?.daysLeft).toBe(null)
  expect(bureau?.source).toBe('https://www.nssi.bg/example-bureau')
  // The band falls to the next verified deadline.
  expect(nearestVerified(list)?.title).toBe('Заявление за обезщетение (НОИ)')
})

test('band prefers the nearest upcoming deadline over an expired one', () => {
  const list = views(
    dossier('Иван Тестов', [
      { title: 'Стар срок', due: '2026-11-01', fact: 'bureau-registration' },
      { title: 'Предстоящ срок', due: '2026-11-20', fact: 'noi-application' },
    ]),
  )
  expect(list[0]?.daysLeft).toBe(-6)
  expect(nearestVerified(list)?.title).toBe('Предстоящ срок')
})

test('all-expired verified deadlines still show the expired band', () => {
  const list = views(
    dossier('Иван Тестов', [
      { title: 'Стар срок', due: '2026-11-01', fact: 'bureau-registration' },
    ]),
  )
  expect(bandText(nearestVerified(list)!)).toBe('⏳ Срокът за стар срок е изтекъл')
})

test('no band target when nothing is verified or nothing is listed', () => {
  expect(nearestVerified(views(UNVERIFIED_ONLY))).toBe(null)
  expect(views(EMPTY)).toEqual([])
})

// ---- drawing: the plugin's own hooks, with fs and the clock mocked beneath ----

const BAND = {
  plugin: 'comeback',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const PANE = {
  plugin: 'comeback',
  component: 'Pane',
  requestId: 'comeback-deadlines',
  props: {
    title: 'Срокове',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

function withFiles(on: Parameters<typeof mock.clock>[0], dossierText: string) {
  mock.clock(on, { now: TODAY_MS })
  // Stands for the engine's own drawing, which the mod falls through to.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('fs.list', (_, e) =>
    /Personal$/.test(e.path)
      ? { value: [{ name: 'p', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] }
      : { value: [] },
  )
  on('fs.stat', () => ({
    value: { kind: 'file', size: 1, mtimeMs: 1, isLink: false },
  }))
  on('fs.read', (_, e) => ({
    value: e.path.endsWith('bg-legal.md') ? legalLog() : dossierText,
  }))
}

test('band shows days left and the check date', async ($, on) => {
  withFiles(on, NEAR)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /5 дни до регистрация/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /проверено на 02.11.2026/ })).toBeDefined()
    await ui.unmount()
  }
})

test('band is hidden when only an unverified deadline exists', async ($, on) => {
  withFiles(on, UNVERIFIED_ONLY)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /⏳/ })).toBeUndefined()
  await ui.unmount()
})

test('pane lists every deadline; unverified shows за проверка and the footer', async ($, on) => {
  withFiles(on, NEAR)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Регистрация в Бюрото/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /5 дни/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /за проверка/ })).toBeDefined()
    expect(
      await ui.find({
        type: 'Text',
        text: 'Ориентировъчно. Провери в НОИ и Агенцията по заетостта.',
      }),
    ).toBeDefined()
    await ui.unmount()
  }
})
