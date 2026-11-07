"""Tests for the harness-independent output scripts (scripts/).

These guard the optional output pipeline. The dependency-backed tests are
skipped when the dep isn't installed, so the stdlib-only pre-push gate stays
green on a clean clone (see CONTRIBUTING.md "Local test gate").
"""

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

HAS_DOCX = importlib.util.find_spec("docx") is not None
HAS_OPENPYXL = importlib.util.find_spec("openpyxl") is not None

EN_DASH = "–"

SAMPLE_CV = {
    "name": "Име Фамилия",
    "language": "bg",
    "contact": {"location": "София", "phone": "+359 88 000 0000", "email": "ime@x.bg"},
    "summary": "Финансов анализатор с 8 г. опит.",
    "experience": [
        {
            "title": "Финансов анализатор",
            "company": "Acme",
            "location": "София",
            "start": "Март 2019",
            "end": "Юни 2024",
            "bullets": ["Скъсих месечното затваряне от 10 на 4 дни."],
        }
    ],
    "skills": ["Excel", "SQL", "Power BI"],
    "education": [{"degree": "Магистър Финанси", "institution": "УНСС", "year": "2015"}],
    "certifications": ["CFA Level I"],
}

SAMPLE_TRACKER = """# Търсене на работа — Мартин

## 📊 Инерция — седмица 01.09

- **Смислени контакти:** 3 / цел 4
- **Активни разговори точно сега:** 1

## 🟢 В движение — активни разговори

| Компания | Роля | Статус |
|---|---|---|
| Acme | PM | Разговор насрочен |

## ⚪ Цели — още недокоснати

| Компания | Роля | Приоритет |
|---|---|---|
| Gamma | PM | висок |
"""


@unittest.skipUnless(HAS_DOCX, "python-docx not installed")
class RenderCvDocxTests(unittest.TestCase):
    def setUp(self):
        import render_cv_docx

        self.mod = render_cv_docx

    def _text(self, doc):
        return "\n".join(p.text for p in doc.paragraphs)

    def test_renders_expected_structure(self):
        doc = self.mod.build_document(SAMPLE_CV)
        text = self._text(doc)
        self.assertIn("Име Фамилия", text)
        for heading in ("Резюме", "Опит", "Умения", "Образование", "Сертификати"):
            self.assertIn(heading, text)
        self.assertIn("Acme", text)

    def test_date_range_uses_en_dash(self):
        doc = self.mod.build_document(SAMPLE_CV)
        self.assertIn(EN_DASH, self._text(doc))

    def test_ats_clean_no_tables(self):
        doc = self.mod.build_document(SAMPLE_CV)
        self.assertEqual(len(doc.tables), 0)

    def test_english_headings(self):
        doc = self.mod.build_document(
            {"name": "John Doe", "language": "en", "summary": "x", "skills": ["SQL"]}
        )
        text = self._text(doc)
        self.assertIn("Summary", text)
        self.assertIn("Skills", text)

    def test_minimal_cv_name_only(self):
        doc = self.mod.build_document({"name": "Solo"})
        self.assertIn("Solo", self._text(doc))
        self.assertEqual(len(doc.tables), 0)


@unittest.skipUnless(HAS_OPENPYXL, "openpyxl not installed")
class TrackerXlsxTests(unittest.TestCase):
    def setUp(self):
        import tracker_to_xlsx

        self.mod = tracker_to_xlsx

    def test_parses_momentum(self):
        parsed = self.mod.parse_tracker(SAMPLE_TRACKER)
        self.assertEqual(parsed["momentum"].get("Смислени контакти"), "3 / цел 4")

    def test_parses_table_sections(self):
        parsed = self.mod.parse_tracker(SAMPLE_TRACKER)
        headings = [h for h, _ in parsed["sections"]]
        self.assertTrue(any("движение" in h.lower() for h in headings))
        # separator row (|---|) must not leak into the data
        for _, rows in parsed["sections"]:
            for row in rows:
                self.assertFalse(all(set(c) <= {"-", ":"} for c in row if c))

    def test_build_workbook_has_sheets(self):
        parsed = self.mod.parse_tracker(SAMPLE_TRACKER)
        wb = self.mod.build_workbook(parsed)
        # momentum + 2 table sections
        self.assertGreaterEqual(len(wb.sheetnames), 3)

    def test_sheet_names_sanitized(self):
        used = set()
        name = self.mod._clean_sheet_name("🟢 В движение — активни разговори", used)
        self.assertLessEqual(len(name), 31)
        self.assertFalse(any(c in name for c in "\\/?*[]:"))


class DocxToPdfTests(unittest.TestCase):
    """Stdlib-only — no dependency guard needed."""

    def setUp(self):
        import docx_to_pdf

        self.mod = docx_to_pdf

    def test_find_soffice_returns_str_or_none(self):
        result = self.mod.find_soffice()
        self.assertTrue(result is None or isinstance(result, str))

    def test_main_missing_file_returns_2(self):
        self.assertEqual(self.mod.main(["/no/such/file.docx"]), 2)


if __name__ == "__main__":
    unittest.main()
