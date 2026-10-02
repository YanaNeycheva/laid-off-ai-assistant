---
name: build-cv
description: Create a base CV from scratch, or fix/ATS-clean an existing base CV — no job posting required. Produces the canonical base CV in the person's workspace root (versioned .docx + .pdf), ATS-optimized, with gap intake for anything missing. Trigger when the person needs a CV but has no posting to tailor to yet — "направи ми CV", "нямам CV", "оправи ми автобиографията", "create/build/fix my CV", "make my resume ATS-friendly". For tailoring an already-clean base CV to a specific posting, use /tailor-cv instead. Works in Bulgarian or English.
---

# /build-cv — Create or fix the base CV (no posting)

> Companion to [/tailor-cv](../tailor-cv/SKILL.md). **Split of responsibility:** `build-cv` produces the **canonical base CV** in the workspace root (from scratch or by ATS-cleaning an existing one) — **no JD needed**. `tailor-cv` takes a clean base and tailors it to a specific posting in a dated position folder. Same rules, same engine, different input and output location.
>
> Rules and versioning live in [../tailor-cv/ats-rules.md](../tailor-cv/ats-rules.md) (the single source of truth — includes the **Base-CV workflow** this skill runs). Proofing lives in [../tailor-cv/proofing.md](../tailor-cv/proofing.md). `{UserNames}` = the person's full name. CV language = the person's working language (BG or EN), from the dossier.

## Data source & bootstrap (the "existing flow")

Initial data comes from the **dossier**, exactly like `tailor-cv` — this is how the skill reuses `/comeback`'s intake instead of re-asking.

- **Normal path (orchestrator-routed, via `cv-builder`):** read `dossier.md` (path given in the brief). Take the person's name (Profile → **Име**), working/CV language (Profile → **Език за работа/CV**), the **CV workspace path** and base version (CV section), and any base-CV content the orchestrator front-loaded. You run **headless — never interview the person**; surface residual gaps back to the orchestrator.
- **Cold path (invoked directly, no dossier yet):** bootstrap the same way `/comeback` does — ensure a `Personal/<YYYY-MM-DD>-<slug>/` workspace exists (create it if not), and if no dossier is present, ask only for the person's **full name** and **working language**, then proceed. Do not rebuild the whole `/comeback` triage; just get enough to work.

**Never write CV files to the project repo root** — only the person's CV workspace. `Personal/` is git-ignored; nothing here is ever committed.

## Step 0 — Determine the mode

1. Ensure the **workspace path** exists (from the dossier CV section; create `<workspace>/` and record it back if missing).
2. Look for an existing base CV in the workspace root (`{UserNames} CV_latest.docx` or the latest versioned file per `CHANGELOG.md`).
   - **File found → FIX mode** (ATS audit + clean-up of the existing base).
   - **No file → FROM-SCRATCH mode** (intake → compose).
   - If the person explicitly wants a rebuild, use FROM-SCRATCH even when a file exists (keep the old version — never overwrite).

## Step 1 (FIX mode) — ATS audit & clean-up

1. Read [../tailor-cv/ats-rules.md](../tailor-cv/ats-rules.md) and the workspace `CHANGELOG.md`.
2. Read the latest base CV.
3. Audit it against the **ATS Optimization Rules** (non-standard headings, tables/columns/text boxes, images, missing contact info, inconsistent dates, hyphens where en-dashes belong, un-quantified achievements, weak/absent action verbs, etc.).
4. Fix every issue found **without changing facts** (names, employers, titles, dates, numbers stay as-is — if a fact looks wrong, flag it, don't invent). Where an achievement lacks a metric, record it as a **gap** rather than fabricating a number.
5. Go to **Step 3 (compose/finalize)**.

## Step 1 (FROM-SCRATCH mode) — Base-CV intake

Gather the base CV content. **Headless (via `cv-builder`):** take it from the dossier / front-loaded brief; don't prompt — surface what's missing back to the orchestrator. **Direct (person is driving):** ask **ONE question at a time** (never a batched form), logging answers in `CV_info_needed.md` in the workspace root.

Base-CV intake checklist (JD-independent):

1. **Контакти / хедър** — име, имейл, телефон, LinkedIn, локация (ATS изисква ги най-отгоре).
2. **Професионален опит** — за всяка роля: компания, длъжност, локация, период (`Month YYYY – Month YYYY`, en-dash), и 3–5 постижения, всяко започващо със силен глагол и **с число където е възможно**.
3. **Образование** — институция, степен/специалност, период.
4. **Умения** — групирани (езици/технологии · инструменти · soft skills), като ключови думи.
5. **Сертификати** *(ако има)* — име, издател, година.
6. **Езици** *(ако е релевантно)* — език + ниво.
7. **Резюме** *(по желание)* — 2–3 изречения; може да се сглоби от опита по-горе, ако човекът няма готово.

**Never fabricate experience.** Anything the person doesn't have → record as `неизвестно` / a gap; don't invent it.

## Step 2 — (reserved)

*(No JD capture — that's `tailor-cv`'s job. Base CV is posting-independent.)*

## Step 3 — Compose the base CV

Compose the base CV **content** (rendering is Step 4, after proofing), following every rule in [../tailor-cv/ats-rules.md](../tailor-cv/ats-rules.md):

- Standard headings (`Summary / Work Experience / Education / Skills / Certifications` — BG: `Резюме / Опит / Образование / Умения / Сертификати`).
- Single column; no tables, columns, text boxes, headers/footers, images.
- Contact info at the very top.
- Dates `Month YYYY – Month YYYY` (en-dash), always with start and end.
- Experience as bullets starting with strong action verbs; quantify where truthful.
- Skills grouped, comma-separated / simple bullets.

Keep it **general** — do not slant toward any single posting (that's tailoring). A strong, honest, broadly-applicable base.

## Step 4 — Proofread, then render & version

1. **Proofing pass** ([../tailor-cv/proofing.md](../tailor-cv/proofing.md)) on the composed text — dashes → en-dashes (without breaking legitimate hyphens) + grammar/spelling in the CV's language. Apply confident fixes; note anything ambiguous left.
2. **Render** the `.docx` in the **workspace root** (not a position folder), versioned per the Base-CV workflow in `ats-rules.md`:
   - New CV → `{UserNames} CV_v1.0.docx`; subsequent edits bump the version (never overwrite).
   - Update `{UserNames} CV_latest.docx` to the newest content.
   - **Portable path (any tool):** write the content as `cv.json` (contract in [../../../scripts/README.md](../../../scripts/README.md)) and render deterministically:
     ```bash
     python scripts/render_cv_docx.py "<workspace>/cv.json" --out "<workspace>/{UserNames} CV_v<X.Y>.docx"
     ```
     Inside Claude Code the bundled `docx` skill renders the same content equally well — either is fine.
3. **Export the PDF** from the rendered `.docx`. Primary path is **LibreOffice headless** (renders Cyrillic reliably):
   ```bash
   python scripts/docx_to_pdf.py "<workspace>/{UserNames} CV_v<X.Y>.docx"
   ```
   The script auto-locates `soffice` (incl. the Windows full path) and verifies the `.pdf` was written. **Fallback when LibreOffice isn't installed:** deliver the `.docx` as the primary artifact and note the `.pdf` couldn't be rendered locally — never ship a PDF with mojibake instead of Cyrillic.

## Step 5 — Log it

Add a one-line entry to the workspace `CHANGELOG.md`:
```
## vX.Y — YYYY-MM-DD — base CV {created | ATS clean-up}
{one line: what changed}
```

## Step 6 — Write back & summarize

1. Update the dossier **CV** section: **Базова версия**, **Workspace път**, and any **Отворени gap въпроси** still unfilled.
2. **Report** (concise, to the orchestrator if headless): artifact paths · what the base CV now contains / what the ATS clean-up fixed (3–5 bullets) · the proofing changes · any open gaps to fill before it's submission-ready.

> Once the base CV is clean, tailoring to a specific posting is a separate step — hand off to [/tailor-cv](../tailor-cv/SKILL.md).
