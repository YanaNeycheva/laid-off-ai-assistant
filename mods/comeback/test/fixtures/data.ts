// Fictional fixtures. The persona is invented; no real Personal/ data is used.
// "Today" in the tests is 2026-11-07.

export const TODAY_MS = Date.UTC(2026, 10, 7, 12, 0, 0)

/** The log table as bg-legal.md has it, trimmed to the rows the tests need. */
export function legalLog(opts: { bureau?: '✅ потвърдено' | '⚠️ непроверено' } = {}) {
  const bureau = opts.bureau ?? '✅ потвърдено'

  return `# Български правни и финансови факти

## Дневник на проверките (last-verified)

> Поддържа се от \`freshness-checker\`.

| Факт | Стойност | Официален източник | Последна проверка | Статус |
|---|---|---|---|---|
| Срок регистрация в Бюро по труда | 7 работни дни | https://www.nssi.bg/example-bureau | 2026-11-02 | ${bureau} |
| Срок молба-декларация НОИ | до 3 месеца от прекратяване на осигуряването | https://administrativeservices.nssi.bg/example-noi | 2026-11-02 | ✅ потвърдено |

## Съкращение vs. уволнение

Текст.
`
}

type Item = { title: string; due: string; start?: string; docs?: string; fact?: string }

export function dossier(name: string, items: Item[]) {
  const entries = items
    .map(item =>
      [
        `- title: ${item.title}`,
        `  due: ${item.due}`,
        item.start ? `  start: ${item.start}` : '',
        item.docs ? `  docs: ${item.docs}` : '',
        item.fact ? `  fact: ${item.fact}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n')

  return `# Dossier — ${name}

## Profile
- **Име:** ${name}

## Deadlines (machine-read by the comeback mod)
${entries}

## Legal / benefits (bg-navigator writes here)
- **Срок за бюро по труда:** {дата}

## Log
- нищо
`
}

/** Bureau 5 days away (amber), NOI 19 days away (neutral), health unverified. */
export const NEAR = dossier('Иван Тестов', [
  {
    title: 'Регистрация в Бюрото по труда',
    due: '2026-11-12',
    start: '2026-10-28',
    docs: 'лична карта, трудова книжка',
    fact: 'bureau-registration',
  },
  {
    title: 'Заявление за обезщетение (НОИ)',
    due: '2026-11-26',
    start: '2026-10-28',
    docs: 'подава се чрез Бюрото',
    fact: 'noi-application',
  },
  { title: 'Здравно осигуряване', due: '2026-12-01', fact: 'health-insurance' },
])

/** Bureau 2 days away: red. */
export const RED = dossier('Иван Тестов', [
  { title: 'Регистрация в Бюрото по труда', due: '2026-11-09', fact: 'bureau-registration' },
])

/** Everything far away: neutral. */
export const FAR = dossier('Мила Примерна', [
  { title: 'Заявление за обезщетение (НОИ)', due: '2027-01-20', fact: 'noi-application' },
])

/** Only an unverified fact: pane card, no band. */
export const UNVERIFIED_ONLY = dossier('Мила Примерна', [
  { title: 'Здравно осигуряване', due: '2026-11-20', fact: 'health-insurance' },
])

/** The template placeholder left unfilled, plus an entry with a bad date. */
export const EMPTY = dossier('Мила Примерна', []).replace(
  '## Deadlines (machine-read by the comeback mod)\n',
  '## Deadlines (machine-read by the comeback mod)\n- title: {заглавие}\n  due: {YYYY-MM-DD}\n- title: Счупена дата\n  due: 2026-13-45\n  fact: bureau-registration\n',
)

/** A fake `$.fs` over an in-memory tree: path -> { text, mtimeMs }. */
export function fakeFs(files: Record<string, { text: string; mtimeMs: number }>) {
  return {
    async list(path?: string) {
      const prefix = `${path ?? ''}/`
      const names = new Set<string>()
      for (const key of Object.keys(files)) {
        if (key.startsWith(prefix)) {
          names.add(key.slice(prefix.length).split('/')[0] ?? '')
        }
      }
      if (names.size === 0) {
        throw new Error('ENOENT')
      }

      return [...names].map(name => ({ name, kind: 'dir' }))
    },
    async stat(path: string) {
      const file = files[path]
      if (!file) {
        throw new Error('ENOENT')
      }

      return { mtimeMs: file.mtimeMs }
    },
    async read(path: string) {
      const file = files[path]
      if (!file) {
        throw new Error('ENOENT')
      }

      return file.text
    },
  }
}

/** A dossier with a `Journey` section (fictional persona). Pass no stage to omit the section. */
export function journeyDossier(stage?: string, next?: string) {
  const section =
    stage === undefined
      ? ''
      : `## Journey (machine-read by the comeback mod — orchestrator fills)
Къде си в четирите етапа.
- stage: ${stage}
${next ? `  next: ${next}\n` : ''}
`

  return `# Dossier — Мила Примерна

## Profile
- **Име:** Мила Примерна

## Target
- **Целеви роли:** {}

${section}## CV (cv-builder writes here)
- **Базова версия:** v1.0

## Log
- нищо
`
}

/** Stage 3 of 4: search. */
export const JOURNEY_SEARCH = journeyDossier('search', 'Изпрати три съобщения до познати в целевите компании.')

/** A minimal dossier so the finder has a person; the tracker sits beside it. */
export const BARE_DOSSIER = `# Dossier — Мила Примерна

## Profile
- **Име:** Мила Примерна
`

type Rows = { talking?: string[]; applied?: string[]; targets?: string[]; closed?: string[] }

/** A fictional `tracker.md` in the shape of agent/templates/tracker.md. */
export function trackerMd(rows: Rows = {}) {
  const lines = (r: string[] | undefined) => (r ?? []).join('\n')

  return `# Търсене на работа — Мила Примерна

## 📊 Инерция — седмица 03.11

- **Смислени контакти:** 3 / цел 4

## 🟢 В движение — активни разговори

| Компания | Роля | Статус | Следваща стъпка (дата) | Връзки | Контакт |
|---|---|---|---|---|---|
| {Acme} | {PM} | Разговор насрочен | {подготовка за интервю — 26.08} | {CV} | {Иван} |
${lines(rows.talking)}

## 🟡 Изпратено, чака — за follow-up

| Компания | Роля | Изпратено | Follow-up на | Връзки | Контакт |
|---|---|---|---|---|---|
| {Beta} | {Senior PM} | {18.08} | {25.08} | {CV} | {—} |
${lines(rows.applied)}

## ⚪ Цели — още недокоснати

| Компания | Роля | Защо тя | Как да вляза | Приоритет |
|---|---|---|---|---|
| {Gamma} | {PM} | {близо} | {студен outreach} | {висок} |
${lines(rows.targets)}

## 📁 Затворени — и какво научихме

| Компания | Роля | Изход | Какво научихме |
|---|---|---|---|
| {Delta} | {PM} | тишина след CV | {проверка на ATS} |
${lines(rows.closed)}

## Легенда

- Статус конвейер.
`
}

/** 4 applied (two need a follow-up), 2 talking (one dated), 0 offers, 1 rejected: `7 кандидатури · 2 разговора`. */
export const TRACKER_BOARD = trackerMd({
  talking: [
    '| Епсилон | HR скрийнинг | Разговор насрочен | интервю — 14.11 | CV: `x` | Иван |',
    '| Зета Груп | Hiring manager | В процес | чакаме отговор | CV: `y` | — |',
  ],
  applied: [
    '| Алфа Софт | Project Manager | 04.11 | 11.11 | CV | — |',
    '| Бета Системи | Ops Lead | 01.11 | — | CV | — |',
    '| Гама Лабс | Delivery Lead | 26.10 | — | CV | — |',
    '| Делта Тех | Program Manager | 06.11 | 05.11 | CV | — |',
  ],
  targets: ['| Йота | PM | близо | outreach | висок |'],
  closed: ['| Ета Дигитал | Delivery Lead | тишина след CV | ATS |'],
})

/** One offer ("да") and one "не след интервю". */
export const TRACKER_OFFER = trackerMd({
  closed: [
    '| Тета Мед | Project Manager | да | Оферта |',
    '| Капа Груп | Ops Lead | не след интервю | стегни разказа |',
  ],
})

// ---------------------------------------------------------------- documents

/** `## Interviews` and `## Company intel` as the subagents write them, filled. */
export const FILLED_PREP = `## CV (cv-builder writes here)
- **Workspace път:** {}
- **Базова версия:** v2.0

## Company intel (company-intel writes here)
### Chaos / Program Manager — https://example.test/chaos
- **Fit read:** Силно съвпадение по delivery.
- **Въпроси за задаване:** Как изглежда първият квартал?

### {компания / длъжност — обява URL}
- **Fit read:** {къде опитът пасва}

## Interviews (interview-coach writes here)
- **Разказ за напускането (текуща форма):** Съкратиха позицията ми, не мен.
- **Топ 2–3 неща за подобрение:** {}
`

/** The same sections left as the template has them. */
export const PLACEHOLDER_PREP = `## CV (cv-builder writes here)
- **Workspace път:** {}

## Company intel (company-intel writes here)
### {компания / длъжност — обява URL}
- **Fit read:** {къде опитът пасва}
- **Въпроси за задаване:** {остри въпроси}

## Interviews (interview-coach writes here)
- **Разказ за напускането (текуща форма):** {}
- **Практикувани въпроси + бележки:** {}
`

export function personDossier(sections: string) {
  return `# Dossier — Мила Примерна

## Profile
- **Име:** Мила Примерна

${sections}`
}

/** mtimes in the documents fixtures: noon UTC on the given 2026 date. */
export const at = (month: number, day: number) => Date.UTC(2026, month - 1, day, 12, 0, 0)

/** The people tree: dossier, 2 base CV versions (+ pdf, + _latest copy), 2 tailored folders. */
export const WORKSPACE: Record<string, { text: string; mtimeMs: number }> = {
  'Personal/2026-10-mila/dossier.md': { text: personDossier(FILLED_PREP), mtimeMs: at(11, 6) },
  'Personal/2026-10-mila/Мила Примерна CV_v1.0.docx': { text: 'x', mtimeMs: at(10, 20) },
  'Personal/2026-10-mila/Мила Примерна CV_v2.0.docx': { text: 'x', mtimeMs: at(11, 2) },
  'Personal/2026-10-mila/Мила Примерна CV_v2.0.pdf': { text: 'x', mtimeMs: at(11, 2) },
  'Personal/2026-10-mila/Мила Примерна CV_latest.docx': { text: 'x', mtimeMs: at(11, 2) },
  'Personal/2026-10-mila/CHANGELOG.md': { text: 'x', mtimeMs: at(11, 2) },
  'Personal/2026-10-mila/2026-11-03_Chaos_Program-Manager/Мила Примерна CV - Chaos - Program Manager.docx': { text: 'x', mtimeMs: at(11, 3) },
  'Personal/2026-10-mila/2026-11-03_Chaos_Program-Manager/Мила Примерна CV - Chaos - Program Manager.pdf': { text: 'x', mtimeMs: at(11, 3) },
  'Personal/2026-10-mila/2026-11-05_Alfa_Delivery-Lead/Мила Примерна CV - Alfa - Delivery Lead.docx': { text: 'x', mtimeMs: at(11, 5) },
}

/**
 * Like `fakeFs`, but entries have a real kind: a path with something below it is
 * a `dir`, a stored path is a `file`. A directory's mtime is its newest descendant.
 */
export function treeFs(files: Record<string, { text: string; mtimeMs: number }>) {
  return {
    async list(path?: string) {
      const prefix = `${path ?? ''}/`
      const seen = new Map<string, string>()
      for (const key of Object.keys(files)) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length)
          const name = rest.split('/')[0] ?? ''
          seen.set(name, rest.includes('/') ? 'dir' : 'file')
        }
      }
      if (seen.size === 0) {
        throw new Error('ENOENT')
      }

      return [...seen].map(([name, kind]) => ({ name, kind }))
    },
    async stat(path: string) {
      const file = files[path]
      if (file) {
        return { mtimeMs: file.mtimeMs }
      }
      const below = Object.entries(files).filter(([k]) => k.startsWith(`${path}/`))
      if (below.length === 0) {
        throw new Error('ENOENT')
      }

      return { mtimeMs: Math.max(...below.map(([, f]) => f.mtimeMs)) }
    },
    async read(path: string) {
      const file = files[path]
      if (!file) {
        throw new Error('ENOENT')
      }

      return file.text
    },
  }
}
