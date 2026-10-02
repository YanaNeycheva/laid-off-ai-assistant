# CLAUDE.md — comeback (laid-off support agent)

Read this before any task in this project.

## What this is

An interactive Bulgarian-language assistant for laid-off professionals. It supports one person through the whole job-search arc: emotional footing, CV, search strategy, and interviews. See `README.md` for the full rationale.

Sibling project: the `uncoachable.work` blog (one directory up). The guide in `knowledge-base/guide.md` is the shared source of truth and is also published as a blog post. Keep the two copies in sync when the guide changes.

## Language rules

- **User-facing content** (the agent's replies, the guide, templates, mode playbooks' example wording) → **Bulgarian**.
- **Everything else** (code, config, README, this file, commit messages, structural docs) → **English**.

## Voice

Inherited from the blog: **professional, sharp, generous.** The person is often anxious or ashamed — never talk down, never spew motivational filler. Be concrete, warm, and honest. Steady the person; don't perform empathy.

Avoid: clichés, corporate jargon, the "не защото…, а защото" construction, the word "неудобен" and its derivatives.

## Architecture (orchestrator + subagents)

**Entry point:** the `/comeback` skill (`.claude/skills/comeback/`) is the front door. It fires on `/comeback` or natural phrases ("съкратиха ме", "laid off", …), makes the main assistant adopt the orchestrator persona, bootstraps a per-person `Personal/<date>-<slug>/dossier.md`, and opens with triage. The orchestrator must be the top-level assistant (not a subagent) because subagents can't spawn subagents.

One **orchestrator** (`agent/orchestrator.md`) holds the relationship — triage, the always-on support layer, routing, and the single consistent voice. It delegates bounded, produce-an-artifact work to **subagents** (`.claude/agents/*.md`). The person only ever talks to the orchestrator; subagents are tools it calls.

Load-bearing rule: **the orchestrator is the relationship; subagents are tools.** Subagents start cold, so triage + support are never delegated.

- Orchestrator-owned (never delegated): `agent/triage.md`, `agent/support.md`.
- Subagents (`.claude/agents/`): `cv-builder` (drives the `/build-cv` and `/tailor-cv` skills), `interview-coach`, `search-strategist`, `bg-navigator`, `company-intel` (optional).
- **Freshness gate:** `freshness-checker` is an independent verifier the orchestrator spawns **on** another subagent's output (chiefly `bg-navigator`) — producer ≠ checker. It confirms every НАП/НОИ/Бюро claim against the official source, returns a per-claim verdict, and stamps last-verified dates into the **Дневник на проверките** table in `bg-legal.md`. It never talks to the person.

**Shared state:** a per-person `dossier.md` (schema in `agent/dossier-template.md`). Orchestrator and every subagent read/write it — this is how cold subagents get the person's full context. It lives at `Personal/<date>-<slug>/dossier.md`, **not** in this repo.

**Person data is never committed:** all files generated for the person — dossier, CVs, tracker, `.docx`/`.pdf` output — live only under `Personal/` (git-ignored) in a dated per-person subfolder `Personal/<date>-<slug>/`. These are NEVER committed.

**CV engine:** the `cv-builder` subagent runs two vendored skills — `/build-cv` (`.claude/skills/build-cv/`) creates the canonical base CV from scratch or ATS-cleans an existing one (no posting, output in the workspace root); `/tailor-cv` (`.claude/skills/tailor-cv/`) tailors a clean base to a specific posting (JD capture, one-question-at-a-time gap analysis, output in a dated position folder). Both produce `.docx`/`.pdf` and share a single source of truth for rules/versioning (`tailor-cv/ats-rules.md`) and proofing (`tailor-cv/proofing.md`).

## Knowledge base

- `knowledge-base/guide.md` — the guide; the agent's primary grounding.
- `knowledge-base/bg-legal.md` — BG legal/benefits facts. **Time-sensitive.** Deadlines and percentages change; re-verify against НОИ / Агенция по заетостта before relying on them, and never give legal advice as certainty — point the person to the official source.
- `knowledge-base/sources.md` — where the guide's claims come from.

## Conventions

- This is a standalone git repo. During development, each completed task is committed and pushed to `main` with a `VERSION` bump + annotated tag (see the Versioning section). This dev workflow does **not** change the running assistant, which never commits person data (`Personal/` is git-ignored).
- Don't invent BG legal specifics — cite `bg-legal.md` and flag anything unverified.
- When the guide changes here, mirror it to the blog post (and vice versa).

## Versioning

This project follows [SemVer](https://semver.org/) — `MAJOR.MINOR.PATCH`. The current version lives in the top-level `VERSION` file; the project starts at **0.1.0**.

- Every commit bumps `VERSION` and gets an annotated git tag `vX.Y.Z` (`git tag -a vX.Y.Z -m "…"`).
- Every release adds a `CHANGELOG.md` entry (Keep a Changelog format).
- **0.x = active development** — the flow is still being wired up and interfaces may change.
- **1.0.0 is cut only when** the described flow (triage → subagents → `freshness-checker` gate) works **end-to-end** *and* has tests covering it. Until both hold, stay on 0.x.
- MAJOR = breaking change to the flow/architecture; MINOR = new capability, backward-compatible; PATCH = fixes and content corrections.

## Next steps (living list)

- [x] Full Bulgarian guide (`knowledge-base/guide.md`).
- [x] Restructure into orchestrator + subagents; vendor the `/tailor-cv` skill as the CV engine.
- [x] Entry-point `/comeback` skill (front door + per-person dossier bootstrap).
- [x] **Test the flow end-to-end** (a real/sample persona through triage → subagents).
- [x] Confirm `.docx`/`.pdf` rendering works (docx + pdf skills available in the harness).
- [x] Keep & flesh out `company-intel` — done in v1.1.0 (given `Write`; writes its own dossier section).

Shipped at 1.0.0; remaining items are optional (auto-resume guard, `.gitattributes`).
