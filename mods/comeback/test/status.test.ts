import { expect, test } from 'claude-code/testing'

import { setStatusSegment } from '../hooks/shared/status'

function recorder() {
  const calls: Array<string | undefined> = []

  return { calls, $: { ui: { status: (text: string | undefined) => void calls.push(text) } } }
}

test('segments compose in the fixed order, joined by a middle dot', () => {
  const { $, calls } = recorder()
  setStatusSegment($, 'pipeline', 'B')
  setStatusSegment($, 'journey', 'A')
  expect(calls).toEqual(['B', 'A · B'])
})

test('clearing one segment keeps the others; clearing all gives undefined', () => {
  const { $, calls } = recorder()
  setStatusSegment($, 'pipeline', undefined) // module state persists across tests
  setStatusSegment($, 'journey', undefined)
  calls.length = 0
  setStatusSegment($, 'journey', 'A')
  setStatusSegment($, 'pipeline', 'B')
  setStatusSegment($, 'journey', undefined)
  setStatusSegment($, 'pipeline', undefined)
  expect(calls).toEqual(['A', 'A · B', 'B', undefined])
})
