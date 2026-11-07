# scripts/ — harness-independent output pipeline

These scripts let the assistant produce its file artifacts (CV `.docx`/`.pdf`,
tracker `.xlsx`) **without** the Claude Code harness's bundled `docx` / `pdf` /
`xlsx` skills — so the project can run on any tool that has a shell and Python.
Inside Claude Code the bundled skills still work; these are the portable path
(and the primary path everywhere else).

The core assistant does **not** depend on these — `lib/benefits.py` and the test
suite are stdlib-only. Install the deps only when you run the output pipeline
outside the harness:

```bash
pip install -r requirements.txt        # python-docx + openpyxl
# PDF export additionally needs LibreOffice installed (not a pip package).
```

## `render_cv_docx.py` — CV JSON → ATS-clean `.docx`

The agent composes the CV **content** (per `agent/templates/cv-structure.md`),
writes it as JSON, then runs:

```bash
python scripts/render_cv_docx.py <cv.json> --out "<Name> CV - <Company> - <Position>.docx"
```

Rendering is deterministic and enforces the ATS structure in code (single
column; no tables / text boxes / headers / footers / images; standard section
headings; contact block at the top; en-dash in date ranges — see
`.claude/skills/tailor-cv/ats-rules.md`). Writing action-verb, quantified
bullets is still the agent's job; the script guarantees the *structure*.

### JSON contract

Only `name` is required; omitted sections are skipped.

```json
{
  "name": "Име Фамилия",
  "language": "bg",
  "contact": { "location": "София", "phone": "+359...", "email": "...", "linkedin": "..." },
  "summary": "3–4 line targeted summary.",
  "experience": [
    { "title": "Финансов анализатор", "company": "Acme", "location": "София",
      "start": "Март 2019", "end": "Юни 2024",
      "bullets": ["Резултат с число ...", "..."] }
  ],
  "skills": ["Excel", "SQL"],
  "education": [ { "degree": "Магистър Финанси", "institution": "УНСС", "year": "2015" } ],
  "certifications": ["CFA Level I"]
}
```

`language` is `"bg"` (default) or `"en"` — it only selects the section-heading
language; the CV language should match the target job. `skills` may be a flat
list (comma-joined) or an object of `{ "Category": [...] }`.

## `docx_to_pdf.py` — `.docx` → `.pdf` via LibreOffice

```bash
python scripts/docx_to_pdf.py "<file>.docx" [--outdir <folder>]
```

LibreOffice headless, because it renders **Cyrillic reliably**. If LibreOffice
isn't installed the script exits non-zero with a clear message — deliver the
`.docx` and let the person export the PDF themselves (Word / Google Docs → Save
as PDF also preserves Cyrillic). Never ship a mojibake PDF. On Windows the
`soffice.exe` is auto-located under `C:\Program Files\LibreOffice\...` (it is
not on `PATH`).

## `tracker_to_xlsx.py` — `tracker.md` → `.xlsx` snapshot

```bash
python scripts/tracker_to_xlsx.py <tracker.md> --out <tracker.xlsx>
```

A point-in-time spreadsheet copy of the live tracker. The markdown stays
canonical; this does not round-trip back. Each `##` table section becomes a
worksheet; the "Инерция" momentum block becomes a summary sheet.
