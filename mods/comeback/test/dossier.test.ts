import { expect, test } from 'claude-code/testing'

import {
  daysBetween,
  findCurrentDossier,
  formatBgDate,
  loadDossierSection,
  parseEntries,
  parseIsoDate,
  parseSections,
} from '../hooks/shared/dossier'
import { findFact, parseVerificationLog } from '../hooks/shared/legal'
import { NEAR, dossier, fakeFs, legalLog } from './fixtures/data'

test('parseSections keys a section by its heading without the parenthetical', () => {
  const sections = parseSections(NEAR)
  expect(Object.keys(sections)).toEqual([
    'Profile',
    'Deadlines',
    'Legal / benefits',
    'Log',
  ])
})

test('parseEntries reads entries, drops placeholders and prose', () => {
  const entries = parseEntries(
    ['Prose line.', '- title: A', '  due: 2026-11-12', '  docs: {документи}', '- **Bold:** ignored'].join('\n'),
  )
  expect(entries).toEqual([{ title: 'A', due: '2026-11-12' }])
})

test('dates: validation and day arithmetic', () => {
  expect(parseIsoDate('2026-11-12')).not.toBe(null)
  expect(parseIsoDate('2026-13-45')).toBe(null)
  expect(parseIsoDate('12.11.2026')).toBe(null)
  expect(daysBetween('2026-11-07', '2026-11-12')).toBe(5)
  expect(daysBetween('2026-11-07', '2026-11-02')).toBe(-5)
  expect(formatBgDate('2026-11-12')).toBe('12.11.2026')
})

test('findCurrentDossier picks the most recently modified dossier', async () => {
  const fs = fakeFs({
    'Personal/2026-10-01-old/dossier.md': { text: dossier('Стар', []), mtimeMs: 1000 },
    'Personal/2026-11-01-new/dossier.md': { text: dossier('Нов', []), mtimeMs: 2000 },
    'Personal/2026-09-01-nodossier/cv.docx': { text: 'x', mtimeMs: 9000 },
  })
  const found = await findCurrentDossier(fs)
  expect(found?.slug).toBe('2026-11-01-new')
  expect(found?.text.includes('Нов')).toBe(true)
})

test('findCurrentDossier is null without a Personal folder', async () => {
  expect(await findCurrentDossier(fakeFs({}))).toBe(null)
})

test('loadDossierSection returns the parsed section of the current person', async () => {
  const fs = fakeFs({ 'Personal/p/dossier.md': { text: NEAR, mtimeMs: 1 } })
  const found = await loadDossierSection(fs, 'Deadlines')
  expect(found?.entries.length).toBe(3)
  expect(found?.entries[0]?.fact).toBe('bureau-registration')
})

test('parseVerificationLog reads status, source and check date', () => {
  const rows = parseVerificationLog(legalLog({ bureau: '⚠️ непроверено' }))
  expect(rows.length).toBe(2)
  const bureau = findFact(rows, 'Срок регистрация в Бюро по труда')
  expect(bureau?.isVerified).toBe(false)
  expect(bureau?.source).toBe('https://www.nssi.bg/example-bureau')
  expect(findFact(rows, 'Срок молба-декларация НОИ')?.isVerified).toBe(true)
  expect(findFact(rows, 'Срок молба-декларация НОИ')?.checked).toBe('2026-11-02')
})
