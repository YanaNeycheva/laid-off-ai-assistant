# Contributing

**Read [CLAUDE.md](CLAUDE.md) first.** It is the source of truth for architecture and conventions; this file only points at the essentials.

## Language

Bulgarian for user-facing content (the agent's replies, the guide, templates, mode playbooks). English for everything else — code, config, docs, and commit messages.

## Architecture

One **orchestrator** ([agent/orchestrator.md](agent/orchestrator.md)) holds the relationship and routes work to **subagents** ([.claude/agents/](.claude/agents/)), which are bounded tools it calls. The `freshness-checker` subagent independently verifies institutional facts (НАП / НОИ / Бюро по труда) in another subagent's output — producer ≠ checker.

## Proposing a change

Don't commit straight to `main`. Contribute one of two ways:

- **A change:** create a branch off `main`, commit your work there, push the branch, and open a **pull request** (the GitHub equivalent of a merge request) for review. Keep the branch focused on one change, and follow the versioning + test-gate rules below.
- **An idea or a problem:** if you're not ready to write the change yourself, just **open an issue** describing it. That's a perfectly good contribution on its own.

## Versioning & workflow

This project follows [SemVer](https://semver.org/). Every change bumps the top-level `VERSION` file, gets an annotated tag (`git tag -a vX.Y.Z -m "…"`), and adds a [CHANGELOG.md](CHANGELOG.md) entry ([Keep a Changelog](https://keepachangelog.com/) format).

## Local test gate

The full test suite must pass before every push. This is enforced locally by a version-controlled `pre-push` hook (`.githooks/pre-push`) — there is no server-side CI. Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

From then on, `git push` first runs `python -m unittest discover -s tests` and **aborts the push (non-zero exit) if any test fails**. To run the suite by hand at any time:

```bash
python -m unittest discover -s tests
```

The hook is stdlib-only and picks a working Python interpreter automatically. (The e2e smoke harness in `tests/e2e/` is deliberately *not* part of this suite — see its runbook.)

## Licensing

By contributing you agree that code contributions are licensed under [MIT](LICENSE), and contributions to `knowledge-base/` content under [CC BY-NC 4.0](knowledge-base/LICENSE).

## Optional tooling

The file-output pipeline (CV `.docx`/`.pdf`, tracker `.xlsx`) runs **without** the Claude Code harness via the harness-independent scripts in [`scripts/`](scripts/) — that is what lets the project run on other tools. Install their Python deps once with `pip install -r requirements.txt` (`python-docx` + `openpyxl`); see [scripts/README.md](scripts/README.md) for the CV JSON contract. The core assistant (`lib/benefits.py`, the tests) needs none of these — it is stdlib-only.

**LibreOffice** (optional, but recommended) is the primary path for exporting tailored CVs to PDF. `scripts/docx_to_pdf.py` renders the PDF from the `.docx` with LibreOffice in headless mode (equivalent to running it by hand):

```bash
python scripts/docx_to_pdf.py <folder>/<file>.docx
# under the hood: soffice --headless --convert-to pdf --outdir <folder> <folder>/<file>.docx
```

We use LibreOffice because it renders **Cyrillic (Bulgarian) reliably** — verified end-to-end (docx → PDF → extracted text round-trips Cyrillic, en-dashes, and `€`).

- **Windows:** installed at `C:\Program Files\LibreOffice\program\soffice.exe`; it is **not on `PATH`**, so call it by full path (`"/c/Program Files/LibreOffice/program/soffice.exe"` from the Bash tool). It prints a harmless `Could not find platform independent libraries` warning and still exits 0 — verify the `.pdf` was written rather than trusting the log.
- **macOS/Linux:** install LibreOffice; `soffice` (or `libreoffice`) is on `PATH`.

If LibreOffice isn't installed, the flow degrades cleanly: the `.docx` is delivered as the primary artifact and the PDF is left for the person to export themselves (Word / Google Docs → Save as PDF also preserves Cyrillic). Never ship a PDF with broken Cyrillic instead.

**python-docx** is the CV pipeline's `.docx` writer — `scripts/render_cv_docx.py` builds the `.docx` from a `cv.json` before the LibreOffice PDF step above. Inside Claude Code the bundled `docx` skill renders the same content just as well. Install `python-docx` (via `requirements.txt`, or `pip install python-docx`) when running the CV pipeline outside the harness. **openpyxl** backs `scripts/tracker_to_xlsx.py` (the tracker `.xlsx` snapshot); inside Claude Code the bundled `xlsx` skill is the equivalent.

## Never commit person data

All files generated for a person live under `Personal/` (git-ignored). Never commit them.
