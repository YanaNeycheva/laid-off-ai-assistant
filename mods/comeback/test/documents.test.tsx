import { expect, mock, test } from 'claude-code/testing'

import { buildDocuments, documentsText, shortDateMs } from '../hooks/features/documents'
import {
  findPrep,
  hasContent,
  scanDocuments,
  workspaceFromDossier,
} from '../hooks/shared/documents'
import { findCurrentDossier } from '../hooks/shared/dossier'
import {
  BARE_DOSSIER,
  FILLED_PREP,
  PLACEHOLDER_PREP,
  TODAY_MS,
  WORKSPACE,
  at,
  personDossier,
  treeFs,
} from './fixtures/data'

async function scan(files: typeof WORKSPACE) {
  const fs = treeFs(files)
  const dossier = (await findCurrentDossier(fs))!

  return scanDocuments(fs, dossier)
}

test('base CVs: versions newest first, pdf beside docx is one row, _latest is not a row', async () => {
  const s = await scan(WORKSPACE)
  expect(s.base.map(b => b.version)).toEqual(['v2.0', 'v1.0'])
  expect(s.base[0]!.path).toBe('Personal/2026-10-mila/Мила Примерна CV_v2.0.docx')
  expect(s.base[0]!.mtimeMs).toBe(at(11, 2))
})

test('tailored CVs: one row per position folder, labelled from the CV file', async () => {
  const s = await scan(WORKSPACE)
  expect(s.tailored.map(t => `${t.company} · ${t.position}`)).toEqual([
    'Alfa · Delivery Lead',
    'Chaos · Program Manager',
  ])
  expect(s.tailored[1]!.mtimeMs).toBe(at(11, 3))
})

test('a position folder with no CV file falls back to the folder name and its own date', async () => {
  const s = await scan({
    ...WORKSPACE,
    'Personal/2026-10-mila/2026-11-06_Beta_Ops-Lead/notes.txt': { text: 'x', mtimeMs: at(11, 6) },
  })
  expect(s.tailored[0]!.company).toBe('Beta')
  expect(s.tailored[0]!.position).toBe('Ops-Lead')
})

test('_latest alone is the one current CV', async () => {
  const s = await scan({
    'Personal/p/dossier.md': { text: BARE_DOSSIER, mtimeMs: 1 },
    'Personal/p/Мила CV_latest.docx': { text: 'x', mtimeMs: at(11, 1) },
  })
  expect(s.base.map(b => b.version)).toEqual(['latest'])
})

test('prep rows come from filled dossier sections only', async () => {
  const s = await scan(WORKSPACE)
  expect(s.prep.map(p => p.label)).toEqual([
    'Пробно интервю — обратна връзка',
    'Chaos — въпроси за задаване',
  ])
  expect(s.prep[0]!.path).toBe('Personal/2026-10-mila/dossier.md')
  expect(s.prep[0]!.mtimeMs).toBe(at(11, 6))
})

test('placeholder sections are not prep', async () => {
  const dossier = {
    dir: 'Personal/p',
    slug: 'p',
    path: 'Personal/p/dossier.md',
    mtimeMs: 1,
    text: personDossier(PLACEHOLDER_PREP),
  }
  expect(findPrep(dossier)).toEqual([])
  expect(hasContent('- **Ключ:** {}\n- **Друг:** {нещо}')).toBe(false)
  expect(hasContent('- **Ключ:** стойност')).toBe(true)
  expect(hasContent('- **Ключ:**\n  - вложен ред')).toBe(true)
})

test('workspace path: set, placeholder, trailing slash', () => {
  expect(workspaceFromDossier(FILLED_PREP)).toBe('')
  expect(workspaceFromDossier('## CV (x)\n- **Workspace път:** Personal/p/cv/\n')).toBe('Personal/p/cv')
})

test('a set workspace path is the scan target', async () => {
  const files = {
    'Personal/p/dossier.md': {
      text: personDossier('## CV (x)\n- **Workspace път:** Personal/p/cv\n'),
      mtimeMs: 1,
    },
    'Personal/p/cv/Мила CV_v1.0.docx': { text: 'x', mtimeMs: at(11, 1) },
  }
  expect((await scan(files)).base.map(b => b.version)).toEqual(['v1.0'])
})

test('groups, current pill marker, dim older rows and DD.MM dates', async () => {
  const v = buildDocuments(await scan(WORKSPACE))!
  expect(v.groups.map(g => g.title)).toEqual(['Базово CV', 'Пригодени', 'Подготовка'])
  expect(v.groups[0]!.rows.map(r => [r.name, r.current === true, r.dim === true])).toEqual([
    ['CV v2.0', true, false],
    ['CV v1.0', false, true],
  ])
  expect(v.groups[0]!.rows.map(r => r.date)).toEqual([shortDateMs(at(11, 2)), shortDateMs(at(10, 20))])
  expect(v.groups[1]!.rows.map(r => r.name)).toEqual(['Alfa · Delivery Lead', 'Chaos · Program Manager'])
  expect(v.groups[1]!.rows.map(r => r.icon)).toEqual(['🎯', '🎯'])
  expect(v.groups[0]!.rows[0]!.icon).toBe('📄')
  expect(v.groups[2]!.rows.map(r => r.icon)).toEqual(['🗒', '🗒'])
  expect(v.total).toBe(6)
  expect(v.summary).toBe('6 документа')
})

test('count grammar', () => {
  expect(documentsText(1)).toBe('1 документ')
  expect(documentsText(2)).toBe('2 документа')
  expect(documentsText(6)).toBe('6 документа')
})

test('empty: dossier but nothing to show gives no view (status cleared)', async () => {
  const s = await scan({ 'Personal/p/dossier.md': { text: BARE_DOSSIER, mtimeMs: 1 } })
  expect(s).toEqual({ base: [], tailored: [], prep: [] })
  expect(buildDocuments(s)).toBe(null)
})

test('no dossier gives no person', async () => {
  expect(await findCurrentDossier(treeFs({ 'other/x.md': { text: '', mtimeMs: 1 } }))).toBe(null)
})

// ---- drawing ----

const PANE = {
  plugin: 'comeback',
  component: 'Pane',
  requestId: 'comeback-documents',
  props: {
    title: 'Документи',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** The engine may hand the mocks an absolute path; the tree is keyed from `Personal`. */
const rel = (path: string) => path.replaceAll('\\', '/').replace(/^.*?(?=Personal)/, '')

function withTree(on: Parameters<typeof mock.clock>[0], files: typeof WORKSPACE) {
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

test('pane shows the three groups, rows, current pill, dates and paths', async ($, on) => {
  withTree(on, WORKSPACE)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    for (const text of ['Базово CV', 'Пригодени', 'Подготовка', '6 документа', 'текущо']) {
      expect(await ui.find({ type: 'Text', text })).toBeDefined()
    }
    expect(await ui.find({ type: 'Text', text: 'CV v2.0' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Chaos · Program Manager' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Пробно интервю — обратна връзка' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Chaos — въпроси за задаване' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: shortDateMs(at(11, 2)) })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /CV_v2\.0\.docx/ })).toBeDefined()
    await ui.unmount()
  }
})

test('empty pane shows one calm line', async ($, on) => {
  withTree(on, { 'Personal/p/dossier.md': { text: BARE_DOSSIER, mtimeMs: 1 } })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Документите ти ще се появят тук/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Базово CV' })).toBeUndefined()
  await ui.unmount()
})
