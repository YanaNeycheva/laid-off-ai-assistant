# comeback mods

Claude Code **mods** for people using `/comeback`: panes and bands that sit beside the chat and show the person's own situation, read from their local dossier. All features live in **one plugin**, `.claude/skills/comeback-mods/`, so the code that finds and parses the dossier is written once.

The plugin sits in the project's skills folder on purpose: Claude Code auto-loads a plugin found in `.claude/skills/<name>/`, so anyone who opens this repo in Claude Code (terminal or desktop app) gets the mods with no flag, no install and no copying.

User-facing text is Bulgarian; code, comments and docs are English (see the root `CLAUDE.md`).

## Features

| # | Feature | File | Dossier section | Status |
|---|---|---|---|---|
| 1 | Срокове (deadlines): band + pane | `hooks/features/deadlines.tsx` | `Deadlines` | shipped |
| 2 | Етап (journey) | `hooks/features/journey.tsx` | `Journey` | shipped |
| 3 | Кандидатури (pipeline) | `hooks/features/pipeline.tsx` | - (reads `tracker.md`) | shipped |
| 4 | Документи (documents) | `hooks/features/documents.tsx` | - (scans `Personal/`; reads `CV`, `Interviews`, `Company intel`; no new section, so recipe step 1 is skipped) | shipped |
| 5 | Финансов хоризонт (runway) | `hooks/features/runway.tsx` | `Finances` | shipped |

## Layout

```
.claude/skills/comeback-mods/
  .claude-plugin/plugin.json     name "comeback"; version equals the repo VERSION (a test enforces it)
  hooks/hooks.json               { "modules": ["./register.tsx"] }
  hooks/register.tsx             one registerX(on) call per feature
  hooks/features/<feature>.tsx   one file per feature: its logic, its hooks, its drawing
  hooks/shared/dossier.ts        THE shared dossier reader (below)
  hooks/shared/documents.ts      read-only discovery of CV files (base, tailored) and prep notes in the dossier
  hooks/shared/legal.ts          reader for the Дневник на проверките in bg-legal.md
  hooks/shared/ui.tsx            shared drawing pieces: card, pill, meter, paneHeader, band
  test/                          *.test.ts(x) for `claude plugin test`, fictional fixtures in test/fixtures/
```

## The shared-code rule

Anything two features need is built **once** in `hooks/shared/` and imported. Do not copy the dossier finder, the section parser, the verification-log reader or a card/pill/meter into a feature. If a feature needs a different look, add a variant to `ui.tsx`.

**`hooks/shared/dossier.ts`** is read-only: it never writes, sends or logs person data.

| Export | Use |
|---|---|
| `dossierFs($)` | wraps `$.fs` (the engine forbids passing `$.fs` around as a value); pass the result to the helpers below |
| `loadDossierSection(fs, 'Name')` | the call a feature makes: finds the current person and returns `{ dossier, body, entries }` for the `## Name` section, or `null` |
| `findCurrentDossier(fs)` | the most recently modified `Personal/*/dossier.md`, or `null` |
| `parseSections(markdown)` | `{ 'Section name': body }`; a heading's trailing parenthetical is dropped |
| `parseEntries(body)` | list entries written `- key: value` with indented continuation lines; `{placeholders}` count as empty |
| `parseIsoDate`, `daysBetween`, `isoToday`, `formatBgDate` | date helpers (ISO `YYYY-MM-DD` in, `DD.MM.YYYY` out) |

**`hooks/shared/legal.ts`**: `loadVerificationLog(fs)` returns the rows of the `Дневник на проверките`; `findFact(rows, label)` looks one up. Only a row with status `✅ потвърдено` (`isVerified`) may be shown as a fact; anything else is shown as `за проверка` with the official link.

## Add a feature

1. Add a machine-readable section to `agent/dossier-template.md` (fixed ASCII keys, ISO dates), and one line telling the orchestrator or the right subagent to fill it. Only your own section.
2. Create `hooks/features/<name>.tsx` exporting `register<Name>(on: On)`. Read data with `loadDossierSection(dossierFs($), '<Section>')`; draw with `$.ui.resolve(e)` and the helpers in `shared/ui.tsx`. Keep the logic in plain exported functions so tests can call them.
3. Add one line to `hooks/register.tsx`. The per-turn redraw (`prompt.submit` / `turn.complete` calling `ui.invalidate('ui.render')`) is registered once there for the whole plugin, so a feature must NOT add its own (one unmatched hook per event per plugin).
4. Any Bulgarian legal fact you show must be looked up in the verification log first (see `deadlines.tsx` and its `FACTS` map).
5. Add fictional fixtures to `test/fixtures/` and a `<name>.test.ts(x)`.
6. Never branch on a motion preference: every person sees the same elements and animations.
7. Bump `VERSION` and `plugin.json` together and add a `CHANGELOG.md` entry.

## Develop and check

Open a Claude Code session in the repo root (needs Claude Code with function-hook plugins, 2.1.317 or newer) so `Personal/` and `knowledge-base/` resolve. The plugin loads by itself from the skills folder and reloads when a file in it is saved. The side pane opens on session start; `/deadlines` reopens it.

```
claude plugin validate .claude/skills/comeback-mods
claude plugin test .claude/skills/comeback-mods
```

Type-check with the `tsconfig.json` from the header of the engine's `claude-code.d.ts` (the engine also lays it into `.claude/skills/comeback-mods/.claude-plugin/types/` the first time it loads the plugin). Repo-level checks for the plugin are in `tests/test_mods.py` and run with the rest of `python -m unittest discover -s tests`.

## Deadlines feature: how the verification gate works

`deadlines.tsx` maps each dossier `fact:` key to a row of the `Дневник на проверките`:

| `fact:` key | Log row (`Факт` cell) |
|---|---|
| `bureau-registration` | Срок регистрация в Бюро по труда |
| `noi-application` | Срок молба-декларация НОИ |
| `health-insurance` | no row yet, so always `за проверка` (official link and how-to: НАП обр. 7 page on nra.bg) |

A deadline counts down only if its row exists and is `✅ потвърдено`. Otherwise (row `⚠️ непроверено`, no row, or an unknown key) the pane shows a `за проверка` pill and the official link, and never a number of days. The band shows the nearest verified deadline: neutral beyond 7 days, amber at 7 or fewer, red at 2 or fewer; it is hidden when no verified deadline exists. To make a new fact count down, have `freshness-checker` add and confirm its row, then add the key to `FACTS`.
