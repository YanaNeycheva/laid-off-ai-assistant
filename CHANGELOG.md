# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.7.1] - 2026-10-02

### Changed
- README: added a plain-language **CV Only** section explaining how CV building works (make/fix a base
  CV with no job ad → tailor it to a posting), why ATS-friendly formatting matters, and what you get
  (`.docx` + `.pdf`, BG/EN, versioned, private). Added a matching "make/fix my CV" row to the
  "What you can ask for" table. No behavior change — documentation only.

## [1.7.0] - 2026-10-02

### Added
- **`/build-cv` skill** (`.claude/skills/build-cv/`) — creates the canonical base CV from scratch or
  ATS-cleans an existing one, **with no job posting required**. Splits CV work cleanly: `build-cv`
  owns the base CV (output in the workspace root); `/tailor-cv` tailors a clean base to a specific
  posting (output in a dated position folder). It reuses `tailor-cv`'s `ats-rules.md` and
  `proofing.md` as the single source of truth — no duplicated ruleset. Initial data flows from the
  dossier (the existing `/comeback` intake), with a cold-start bootstrap for direct invocation.
- `tests/test_invariants.py::TestBuildCvSkillWired` — guards that the skill exists, reuses the shared
  ATS rules, and stays wired into both the orchestrator routing and the `cv-builder` subagent.

### Changed
- `cv-builder` now selects between `/build-cv` (no posting) and `/tailor-cv` (posting) by the task in
  its brief; the orchestrator's routing table and CV-brief logic distinguish the two cases.
- `tools/gen_agents.py` neutralizes `/build-cv` skill references for the generated non-Claude trees,
  symmetric with the existing `/tailor-cv` handling; trees regenerated.
- README and CLAUDE.md describe the two-skill CV engine.

## [1.6.1] - 2026-09-15

### Added
- `tests/test_generated_trees.py` — fails the test gate when the generated tool trees
  (`.opencode/`, `.codex/`, `.github/agents/`) drift from the `.claude/` source, pointing you to
  `python tools/gen_agents.py`. Closes the gap where editing `.claude/` without regenerating left
  the other tools silently running stale behavior — the single-source-of-truth guarantee is now
  enforced by the pre-push gate, not just documented.

## [1.6.0] - 2026-09-15

### Added
- **Experimental Codex and Copilot support (generated, not yet tested).** `tools/gen_agents.py` now
  emits three tool trees from the `.claude/agents/` source of truth:
  - OpenCode — `.opencode/agents/*.md` (validated end-to-end).
  - **Codex** — `.codex/agents/*.toml` (TOML; body → `developer_instructions`,
    `sandbox_mode = "workspace-write"`).
  - **Copilot** — `.github/agents/*.agent.md` (YAML frontmatter; `read`/`edit`/`execute` tool
    allowlist).
  - Codex and Copilot are **generated + structurally linted only** — those tools aren't installed
    here, so they are **not behaviorally tested**. Each generated file carries an in-file `UNTESTED`
    note; the per-tool entry point and web-search wiring still need a real run to confirm.
- `tools/lint_agents.py` — multi-tool structural lint (OpenCode YAML, Codex TOML via `tomllib`,
  Copilot frontmatter). Runs offline.
- `tiers.json` — `codex` and `copilot` sections (models left unset → inherit the tool default;
  Copilot CLI ignores the agent `model:` field).

### Changed
- README notes Codex/Copilot as experimental/untested alongside the validated OpenCode + Claude paths.

### Removed
- `tools/lint_opencode_spike.py` — superseded by the multi-tool `tools/lint_agents.py`.

## [1.5.0] - 2026-09-15

### Added
- **Runs on OpenCode (free), in addition to Claude Code.** The full assistant now runs in
  [OpenCode](https://opencode.ai) — a free tool with free built-in models (OpenCode Zen), so a
  person can run the whole benefits → CV → search → interview flow at no cost, no paid AI plan.
  - `.opencode/agents/` — all 6 subagents **generated** from `.claude/agents/`, plus a hand-authored
    `comeback` primary/entry that routes to them.
  - `tools/gen_agents.py` — the generator. **`.claude/` is the hand-authored source of truth; every
    other tool's tree is generated from it** (the primary contributor develops in Claude Code). It
    maps the Claude `tools:` list → OpenCode `permission:` map, neutralizes tool-name prose
    (`WebSearch`→"web search", `Bash`→"in a shell", the `/tailor-cv` skill call → "read & follow the
    skill file"), and emits `model:` from `tiers.json`. Idempotent; `--check` flags staleness.
  - `tiers.json` — per-tool tier→model map (single source). OpenCode is assigned its free OpenCode
    Zen models (`strong` = nemotron-3-ultra-free, `mid` = big-pickle, `cheap` =
    nemotron-3.5-lightning-free).
  - `tools/lint_opencode_spike.py` (offline structural lint) and `tools/check_benefits_slice.py`
    (scoped behavioral assertion for a run folder).
  - **Validated end-to-end:** the benefits safety slice ran in OpenCode Desktop against the Martin
    persona — real subagent spawning, `python -m lib.benefits` for deterministic dates/amounts, the
    web-verified producer≠checker freshness gate, and a correct dossier `Legal / benefits` section.
- **README:** a "pick how you'll run it" section covering OpenCode (free) and Claude Code.

### Changed
- The `.claude/` bodies and `README` note the harness-independent path (scripts / OpenCode) alongside
  the in-Claude equivalents. `.claude/` remains byte-identical in behavior — it is the authored source.

## [1.4.0] - 2026-09-15

### Added
- **Harness-independent output scripts (`scripts/`).** The CV/tracker file pipeline can now run
  without the Claude Code bundled `docx` / `pdf` / `xlsx` skills — the first step toward running
  the assistant on other agent tools:
  - `render_cv_docx.py` — CV JSON → ATS-clean `.docx` (`python-docx`), enforcing the
    `tailor-cv/ats-rules.md` structure deterministically. JSON contract in `scripts/README.md`.
  - `docx_to_pdf.py` — `.docx` → `.pdf` via LibreOffice headless (auto-locates `soffice`, verifies
    the PDF was written, degrades cleanly when LibreOffice is absent).
  - `tracker_to_xlsx.py` — `tracker.md` → `.xlsx` snapshot (`openpyxl`).
  - `requirements.txt` (python-docx, openpyxl) and `tests/test_scripts.py` (dependency-guarded with
    `skipUnless`, so the stdlib-only pre-push gate stays green on a clean clone).
- **Tool-porting groundwork.** `PORTING-PLAN.md` (generic, reusable method) + `PORTING-PLAN.layoff.md`
  (this project's companion: six-seam coupling inventory, tier→model map, Layer-4 fixture mapping,
  invariants, and a runnable Definition of Done).

### Changed
- CV/tracker pipeline bodies now point at `scripts/` as the portable primary path, with the bundled
  Claude Code skills noted as the in-harness equivalent: `.claude/agents/cv-builder.md`,
  `.claude/skills/tailor-cv/SKILL.md`, `agent/orchestrator.md`, `agent/templates/tracker.md`,
  `CONTRIBUTING.md`.

## [1.3.2] - 2026-09-10

### Added
- **`CONTRIBUTING.md` "Proposing a change" section.** Contributors should not commit
  straight to `main`: either branch off `main` and open a pull request (the GitHub
  equivalent of a merge request), or — if not ready to write the change — just open an
  issue.

## [1.3.1] - 2026-09-10

### Fixed
- **Verified two stale rows in `knowledge-base/bg-legal.md` via `freshness-checker`.**
  - **чл. 222, ал. 1 КТ (severance):** replaced the vague "ориентир 1 бруто (+ възможен
    период)" with the exact statutory wording (брутно трудово възнаграждение за времето
    без работа, но не повече от 1 месец; по-дълъг срок само ако е уговорен в КТД/ИТД),
    sourced against the consolidated Кодекс на труда on lex.bg. Row promoted from
    ⚠️ непроверено to ✅ потвърдено (2026-09-10). This статут-based fact sits outside the
    НАП/НОИ/АЗ mandate, so it is verified against the legal text itself.
  - **Преходен период (хартиена книжка):** the "до 1 юни 2026 г." transition had already
    elapsed, leaving the body speaking in future tense about past events. Rewrote the
    "Трудова книжка и електронен трудов запис" section into past/present tense (both stages
    now in force; paper books should already be returned — retrieve from employer if not;
    keep paper proof until retirement per НОИ). Row promoted to ✅ потвърдено (2026-09-10),
    sourced against НОИ + НАП Регистър на заетостта.

## [1.3.0] - 2026-09-08

### Changed
- **Rewrote the README for a first-time visitor.** It now leads with the full
  capability map — surfacing the BG benefits/legal clock and the fact-verification
  layer that were previously buried, so it no longer reads as a CV tool with extras —
  and adds a "How to use it" section: prerequisites, how to launch, a "what you can
  ask for" table of real phrases → outcomes, and what you get and where. The raw file
  tree is condensed to a short "How it works".

## [1.2.1] - 2026-09-08

### Fixed
- README's "uncoachable.work" link pointed at a relative repo path
  (`../uncoachable.work`), which GitHub resolved as a folder instead of the
  site. It now links to `https://uncoachable.work`.

## [1.2.0] - 2026-09-08

### Changed
- **Replaced the GitLab CI pipeline with a local pre-push test gate.** The
  server-side `.gitlab-ci.yml` job is gone; a version-controlled
  `.githooks/pre-push` hook now runs the full suite
  (`python -m unittest discover -s tests`) and aborts the push with a clear
  message if any test fails. Enable it once per clone with
  `git config core.hooksPath .githooks`. The hook is stdlib-only and probes for
  a working Python interpreter (so it survives Windows' non-functional
  `python3` Store stub). Documented in `CONTRIBUTING.md` under a new
  "Local test gate" section.
- **Doc recheck (Part A) fixes.** `README.md`: the "Status" section was stale
  ("Next: end-to-end testing") — refreshed to state the flow is shipped, stable,
  and enforced by the pre-push gate; the structure tree now lists the
  `freshness-checker` subagent that was missing from it. `tests/e2e/README.md`:
  reworded its "not part of CI" / "the 36 CI tests" references (there is no CI
  now, and the suite count had drifted) to point at the automated suite the
  pre-push gate runs.

### Removed
- **`.gitlab-ci.yml`** — superseded by the local pre-push gate above.

## [1.1.1] - 2026-09-08

### Changed
- **CLAUDE.md "Next steps" synced with reality.** Ticked and reworded the
  `company-intel` item (kept & fleshed out in v1.1.0 — given `Write`, writes its
  own dossier section) and removed the "publish the guide to the blog via the
  `uncoach-` pipeline" line as out of scope for this repo. The blog relationship
  stays documented in the Sibling-project note.

## [1.1.0] - 2026-09-07

### Changed
- **`company-intel` fleshed out and given `Write`.** The optional subagent now
  persists its own **Company intel** dossier section (fit read, "защо точно тук"
  angles, questions, flags) — one block per posting — which `interview-coach`
  picks up when the person moves to practice, instead of only "handing results
  via the dossier" it had no tool to write. Added a sourcing rule (cite company
  facts, flag recency) and a note that any market/benefit figure it surfaces is
  subject to the orchestrator's freshness gate, while qualitative company intel
  is its own to source. Kept lean and optional — it still overlaps
  `search-strategist`/`interview-coach` and must not grow into a second
  search-strategist.
- **Dossier template gains a "Company intel" section** (per-posting), the home
  for that written output, placed just before the Interviews section it feeds.

## [1.0.1] - 2026-09-07

### Changed
- **Documented the silent `.docx`/python-docx dependency.** The CV pipeline's
  `.docx` writer (the harness `docx` skill, with the `python-docx` package as
  fallback) is now stated as a dependency in `CONTRIBUTING.md`'s "Optional tooling"
  section — mirroring how LibreOffice is documented (what it's for, graceful
  behavior when absent) — and named inline in `cv-builder.md`'s render step so the
  dependency isn't implicit.
- **`bg-navigator` forbids guessed numeric ranges.** Sharpened its "never invent"
  rule to state explicitly that it must not emit approximate ranges or figures in
  prose (e.g. "8–9 мес."): deterministic values come only from `lib/benefits.py`,
  facts from `bg-legal.md`, and anything else is surfaced as
  "провери в НОИ/бюрото по труда" rather than estimated.

## [1.0.0] - 2026-09-07

### First stable release

The comeback assistant reaches 1.0.0: the full orchestrator → subagent flow works
end-to-end and is covered by an automated test suite.

- **Flow, end-to-end.** The orchestrator holds the relationship (triage + always-on
  support) and delegates bounded, produce-an-artifact work to subagents:
  `bg-navigator` (BG post-layoff logistics) gated by the independent
  `freshness-checker` (producer ≠ checker; stamps last-verified dates into
  `bg-legal.md`), a front-loaded `cv-builder` driving the `/tailor-cv` skill with
  LibreOffice PDF rendering, `search-strategist`, and `interview-coach`. The person
  only ever talks to the orchestrator.
- **Test coverage.** An automated suite backs the flow: a deterministic benefits
  calculator, static invariant checks, and an e2e smoke harness (checked-in
  "Мартин" fixture + stdlib artifact checker), validated on a real run — wired into
  GitLab CI.

Both 1.0.0 criteria in CLAUDE.md are met: the described flow (triage → subagents →
`freshness-checker` gate) works end-to-end **and** has tests covering it.

## [0.4.2] - 2026-09-07

### Changed
- **`knowledge-base/bg-legal.md` — чл. 222 КТ severance row stamped ⚠️.** The
  "Обезщетение по КТ при съкращение" row now records that severance under
  чл. 222, ал. 1 КТ falls **outside** НАП/НОИ/АЗ scope and is confirmed in writing
  by the employer, with a last-checked date. The status stays ⚠️ непроверено — no
  hard number is asserted as verified.

## [0.4.1] - 2026-09-07

### Fixed
- **E2E checker false-failed the Cyrillic check on an English tailored CV.**
  `check_artifacts.py` passed only the tailored `.docx` to the Cyrillic check, and
  the cross-docx fallback was guarded by `len(docx_paths) > 1`, so a legitimately
  all-English tailored CV (Latin name, English role) read as "NO Cyrillic —
  possible mojibake" and the run exited 1. The check now scans the **full** CV
  `.docx` set and asserts "at least one CV `.docx` has Cyrillic" — the
  always-Bulgarian base CV carries the signal, an English tailored CV correctly has
  none, and only a run where **no** `.docx` has Cyrillic (a real garbled render)
  fails. Added `tests/test_e2e_checker.py` (stdlib `unittest`, synthetic `zipfile`
  `.docx`) to regression-proof it: English-tailored + Bulgarian-base passes,
  none-Cyrillic fails.

## [0.4.0] - 2026-09-05

### Added
- **End-to-end smoke harness (`tests/e2e/`)** — a repeatable Layer-B smoke test for
  the full flow (triage → subagents → `freshness-checker` gate → artifacts). The
  LLM run stays manual/on-demand; what is automated is the deterministic check:
  - **`tests/e2e/fixture_martin.md`** — the canonical, checked-in scenario: the
    "Мартин" persona (consistent ~9 г. осиг. стаж; съкратен 2026-08-14; ~3200 лв ≈
    1636 EUR; ПИК; base CV; target JD) and six scripted persona turns.
  - **`tests/e2e/check_artifacts.py`** — a stdlib-only artifact checker
    (`python tests/e2e/check_artifacts.py Personal/<date>-<slug>/`) that asserts the
    *shape* of a real run: dossier sections (derived from `dossier-template.md`), a
    tailored CV `.docx` + matching non-trivial `.pdf` under the `cv/` subtree,
    Cyrillic integrity read straight from `word/document.xml` via `zipfile` (no
    external dep; catches mojibake), an optional `pdftotext` PDF text check that
    skips cleanly when the tool is absent, and tracker zones/columns (derived from
    `templates/tracker.md`). Exits non-zero with a per-check report on failure.
  - **`tests/e2e/README.md`** — the runbook. On-demand only, **not** in CI: it needs
    a produced run folder, which lives under git-ignored `Personal/`. The checker is
    deliberately kept out of `unittest discover` (not named `test*.py`, guarded under
    `__main__`), so the existing 36-test suite is unaffected.

## [0.3.0] - 2026-09-04

### Added
- **`tests/test_invariants.py` — a static repo-invariant test suite** (Layer A;
  stdlib `unittest`, no pytest) guarding the regressions this repo suffers
  *silently*:
  - **Tool/spec match** (the F1-class bug): for every `.claude/agents/*.md`,
    infer the tools its spec body requires (writes a file → `Write`; renders
    `.docx`/`.pdf` or calls python/soffice/a shell → `Bash`; runs a skill →
    `Skill`; web-searches/verifies or fetches a posting → `WebSearch`/`WebFetch`)
    and assert the frontmatter `tools:` covers them.
  - **Person data not tracked** — `git ls-files` is empty under `Personal/` and
    `work/`, and `.gitignore` ignores both.
  - **VERSION / tag / CHANGELOG agree** — VERSION is SemVer, matches the latest
    `vX.Y.Z` git tag (skips gracefully when tags aren't fetched), and has a
    CHANGELOG entry.
  - **Forbidden phrases** — the "не защото…, а защото" construction and
    "неудобен"/derivatives are absent from user-facing content
    (`knowledge-base/`, `agent/templates/`); the rule statements that *define*
    the bans are deliberately out of scope.
  - **Freshness gate wired** — `orchestrator.md` still routes through the
    `freshness-checker` gate.
  - **bg-legal ДНЕВНИК well-formed** — the "Дневник на проверките" table parses,
    every status is ✅/⚠️/❗, and every ✅ row cites a source and a date.
- **`.gitlab-ci.yml`** — a single `test` job on `python:3.12` running
  `python -m unittest discover -s tests -v` on pushes to `main` and on merge
  requests. Stdlib only; no install step.

## [0.2.0] - 2026-09-03

### Added
- **`lib/benefits.py` — a deterministic, stdlib-only benefits calculator** that moves the
  date/duration/money math out of LLM prose. Pure functions mirroring
  `knowledge-base/bg-legal.md` (cited inline, "keep in sync"):
  - `bureau_registration_deadline` — 7 **working** days after termination, excluding weekends
    and the official BG public holidays (incl. the movable Orthodox Easter and the чл. 154, ал. 2
    substitute Mondays). The 2026 holiday set is a clearly-marked per-year constant with an
    "update yearly" note, verified against official/reference sources (Easter 2026 = 12 Apr;
    МС one-off 2 Jan euro-adoption day).
  - `noi_declaration_deadline` — +3 calendar months, month-end clamped.
  - `benefit_duration_months` — чл. 54в КСО table with exact boundary handling.
  - `monthly_benefit_estimate` — 60% of the average осигурителен доход as a daily amount,
    clamped to [9.21, 54.78] EUR and capped at the 2300 EUR insurable income, × working days;
    `Decimal`, 2 dp.
  - A small CLI (`python -m lib.benefits …`) so `bg-navigator` can compute without prose math.
- **`tests/test_benefits.py`** — 25 stdlib `unittest` tests (run via `python -m unittest discover`):
  deadline cases spanning a weekend **and** a holiday, an already-missed case, every чл. 54в
  boundary (3y, 3y+1d, 7y, 7y+1d, 11y, 15y, 15y+1d), the estimate's normal/min/max-clamp cases,
  and a **drift test** that fails if `lib/benefits.py` and `bg-legal.md` disagree on the key
  constants (9.21, 54.78, 2300, the чл. 54в months).

### Changed
- **`bg-navigator` now computes via the helper** (added `Bash`) instead of doing date math in
  prose. Its spec makes the split explicit: `lib/benefits.py` is the calculator; `bg-legal.md`
  (verified by `freshness-checker`) is the source of truth for the constants; if they drift, the
  drift test fails. WebSearch still verifies the constants are current.
- `.gitignore`: ignore Python `__pycache__/` and bytecode.

## [0.1.9] - 2026-09-03

### Changed
- `knowledge-base/bg-legal.md`: the **чл. 54в КСО benefit-duration table** was independently
  verified against the official **НОИ** source (nssi.bg) and upgraded from ⚠️ непроверено to
  **✅ потвърдено**. All five осигурителен-стаж ranges confirmed unchanged:
  до 3 г. → 4 мес.; 3 г. 1 д – 7 г. → 6 мес.; 7 г. 1 д – 11 г. → 8 мес.;
  11 г. 1 д – 15 г. → 10 мес.; над 15 г. → 12 мес.
  - Дневник row generalized from the single 7–11 г. range to the whole table, re-dated
    2026-09-03, official URL = НОИ „при безработица" page; the "вербатим таблица не отворена"
    caveat removed.
  - Body duration line stamped as verified against НОИ; the live-check hedge softened to a
    general "провери при промени" note (no longer непроверено).
- **Electronic-record row** refresh confirmed consistent with the reform facts already in the
  file body: трудови правоотношения in force from 1 юни 2025 г., служебни from 1 юни 2026 г.
  (row re-dated 2026-09-01 by the freshness gate, still fresh; kept ✅).

## [0.1.8] - 2026-09-01

### Added
- **LibreOffice as the primary CV → PDF path.** The `/tailor-cv` render step and `cv-builder`
  step 3 now convert the rendered `.docx` to PDF via `soffice --headless --convert-to pdf`,
  chosen because it renders **Cyrillic (Bulgarian) reliably** — verified end-to-end
  (docx → PDF → extracted text round-trips Cyrillic, en-dashes, and `€`).
  - `.claude/skills/tailor-cv/SKILL.md`: Step 5 now spells out the LibreOffice export command
    (full `soffice.exe` path on Windows, which is not on `PATH`) and a clean no-LibreOffice
    fallback — deliver the `.docx` and let the person export the PDF themselves rather than
    shipping mojibake.
  - `.claude/agents/cv-builder.md`: step 3 points at the same primary path + fallback.
  - `CONTRIBUTING.md`: new "Optional tooling" section documenting the LibreOffice dependency,
    the Windows full-path quirk, the harmless startup warning, and the graceful degradation.

## [0.1.7] - 2026-08-29

### Changed
- CV gap-gathering is now **front-loaded to the orchestrator**. `cv-builder` runs headless and
  only the orchestrator talks to the person, so `/tailor-cv`'s one-question-at-a-time gap analysis
  can't reach them through the subagent. The orchestrator now collects the CV inputs up front (one
  question at a time, in its own voice), records them in the dossier's CV section, and hands
  `cv-builder` a complete brief.
  - `agent/orchestrator.md`: added a "CV brief (front-load before delegating to cv-builder)" step
    with a checklist derived from the skill's real inputs.
  - `.claude/agents/cv-builder.md`: now expects a complete brief and **does not interview** the
    person; residual gaps are returned to the orchestrator to ask one-at-a-time. The batched
    `CV_info_needed.md` is demoted to a last-resort fallback.
  - `.claude/skills/tailor-cv/SKILL.md`: one-line note that headless runs draw gap inputs from the
    orchestrator brief and surface residual gaps back instead of prompting.
  - `agent/dossier-template.md`: added a "CV бриф (front-load)" block to the CV section.

## [0.1.6] - 2026-08-29

### Fixed
- `bg-navigator` can now write the dossier (added `Write` tool) — its spec directs it to
  write the personalized checklist to the dossier's legal/benefits section.
- `cv-builder` can now render `.docx`/`.pdf` (added `Bash` tool) — the `/tailor-cv` render
  skills it wraps need a shell.
- Aligned both subagents' declared tools with their own specs (no spec rewrites).

## [0.1.5] - 2026-08-29

### Changed
- `knowledge-base/bg-legal.md` independently verified against NSSI (НОИ) for 2026, now in euro.
  - ✅ Confirmed against official sources: eurozone entry + EUR amounts and the fixed rate
    1 EUR = 1.95583 BGN (noi.bg); maximum insurable income **2300 EUR** from 01.08.2026
    (nssi.bg/dohod01082026); minimum/maximum daily unemployment benefit **9.21 / 54.78 EUR**
    for 2026 (official NSSI bulletin `unempl_02_2026.pdf`).
  - Fixed the source URL on the daily-benefit row (the figures live in the NSSI bulletin, not
    the dohod page) and re-stamped the two euro-figure rows to 2026-08-29.
  - ⚠️ Still unverified (kept непроверено): transitional paper-record period (до 1 юни 2026 г.)
    and the Labour Code severance orientation.

## [0.1.4] - 2026-08-28

### Added
- `CONTRIBUTING.md` (concise; points to `CLAUDE.md` for the full conventions).
- A "Contributing" pointer in `README.md`.

## [0.1.3] - 2026-08-28

### Added
- Dual licensing: MIT for the code, CC BY-NC 4.0 for the `knowledge-base/` content.
- Top-level `LICENSE` (MIT, with a dual-split header) and `knowledge-base/LICENSE` (full CC BY-NC 4.0 legal code).
- A "License" section in `README.md` explaining the split.

## [0.1.2] - 2026-08-28

### Added
- `CHANGELOG.md` in Keep a Changelog format, covering the 0.1.x history.

### Changed
- Versioning policy in `CLAUDE.md` now requires a changelog entry per release.

## [0.1.1] - 2026-08-28

### Changed
- Moved all per-person files under a git-ignored `Personal/<date>-<slug>/` root.
- Corrected the `CLAUDE.md` dev-commit convention and the person-data rule.

## [0.1.0] - 2026-08-27

### Added
- Full Bulgarian guide (`knowledge-base/guide.md`).
- Orchestrator + subagents architecture.
- Vendored `/tailor-cv` skill as the CV engine.
- `/comeback` entry-point skill (front door + per-person dossier bootstrap).
- `freshness-checker` verification gate for institutional facts.
- SemVer adoption and top-level `VERSION` file.
