import { expect, mock, test } from 'claude-code/testing'

import { STAGES, buildJourney, stageIndex } from '../hooks/features/journey'
import { parseEntries, parseSections } from '../hooks/shared/dossier'
import { JOURNEY_SEARCH, TODAY_MS, journeyDossier } from './fixtures/data'

function view(text: string) {
  const entries = parseEntries(parseSections(text)['Journey'] ?? '')

  return buildJourney(entries[0])
}

test('stageIndex maps each key in order; unknown is -1', () => {
  expect(['opora', 'cv', 'search', 'interviews'].map(stageIndex)).toEqual([0, 1, 2, 3])
  expect(stageIndex('nope')).toBe(-1)
  expect(stageIndex(undefined)).toBe(-1)
  expect(STAGES.length).toBe(4)
})

test('stages before the current are done, current is now with next, after pending', () => {
  const journey = view(JOURNEY_SEARCH)!
  expect(journey.steps.map(s => s.state)).toEqual(['done', 'done', 'now', 'pending'])
  expect(journey.steps.map(s => s.marker)).toEqual(['✓', '✓', '3', '4'])
  expect(journey.steps[2]?.next).toBe('Изпрати три съобщения до познати в целевите компании.')
  expect(journey.steps[3]?.next).toBeUndefined()
  expect(journey.index).toBe(2)
})

test('status text is етап N/4 · name', () => {
  expect(view(JOURNEY_SEARCH)?.statusText).toBe('етап 3/4 · търсене')
  expect(view(journeyDossier('opora', 'Регистрирай се.'))?.statusText).toBe('етап 1/4 · опора')
  expect(view(journeyDossier('interviews', 'Пробно интервю.'))?.statusText).toBe('етап 4/4 · интервюта')
})

test('no section or unknown stage gives no journey', () => {
  expect(view(journeyDossier())).toBe(null)
  expect(view(journeyDossier('bogus', 'x'))).toBe(null)
  expect(view(journeyDossier('{opora | cv | search | interviews}', 'x'))).toBe(null)
})

// ---- drawing ----

const PANE = {
  plugin: 'comeback',
  component: 'Pane',
  requestId: 'comeback-journey',
  props: {
    title: 'Твоят път',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

function withFiles(on: Parameters<typeof mock.clock>[0], dossierText: string) {
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
  on('fs.read', () => ({ value: dossierText }))
}

test('pane shows the title, done ticks and the Следва line on every surface', async ($, on) => {
  withFiles(on, JOURNEY_SEARCH)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Твоят път/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /етап 3\/4 · търсене/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Следва:/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Изпрати три съобщения/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '✓' })).toBeDefined()
    await ui.unmount()
  }
})

test('empty state is one calm line', async ($, on) => {
  withFiles(on, journeyDossier())
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Пътят ти ще се появи тук/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Следва:/ })).toBeUndefined()
  await ui.unmount()
})

test('current stage without next has no next and shows its description', async ($, on) => {
  const text = journeyDossier('cv')
  expect(view(text)?.steps[1]?.next).toBeUndefined()
  expect(view(text)?.steps[1]?.state).toBe('now')

  withFiles(on, text)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Базово CV, ATS-проверено/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Следва:/ })).toBeUndefined()
  await ui.unmount()
})

test('unknown stage renders the empty state', async ($, on) => {
  withFiles(on, journeyDossier('nonsense', 'x'))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Пътят ти ще се появи тук/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Следва:/ })).toBeUndefined()
  await ui.unmount()
})

test('header note carries the етап N/4 status text', async ($, on) => {
  expect(view(JOURNEY_SEARCH)?.statusText).toBe('етап 3/4 · търсене')
  withFiles(on, JOURNEY_SEARCH)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /етап 3\/4 · търсене/ })).toBeDefined()
  await ui.unmount()
})

test('done stages show the tick and pending stages are listed', async ($, on) => {
  withFiles(on, JOURNEY_SEARCH)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: '✓' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Интервюта' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Опора' })).toBeDefined()
  await ui.unmount()
})
