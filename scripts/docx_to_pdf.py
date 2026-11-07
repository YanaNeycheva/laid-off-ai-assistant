"""Convert a .docx to .pdf with LibreOffice headless — harness-independent.

Replacement for the bundled ``pdf`` skill. LibreOffice is used because it
renders **Cyrillic (Bulgarian) reliably** — verified end-to-end (docx -> PDF ->
extracted text round-trips Cyrillic, en-dashes and €). See CONTRIBUTING.md
"Optional tooling".

Clean degradation: if LibreOffice is not installed this exits non-zero with a
clear message so the caller keeps the .docx as the primary artifact and lets
the person export the PDF themselves (Word / Google Docs -> Save as PDF also
preserves Cyrillic). Never ship a PDF with mojibake instead of Cyrillic.

Usage:
    python scripts/docx_to_pdf.py "<file>.docx" [--outdir <folder>]

Requires: LibreOffice (the `soffice` binary). Not a pip package.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

# Well-known Windows install locations (soffice is NOT on PATH there).
WINDOWS_CANDIDATES = [
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
]


def find_soffice() -> str | None:
    """Locate the LibreOffice binary, or None if it isn't installed."""
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found
    for candidate in WINDOWS_CANDIDATES:
        if Path(candidate).is_file():
            return candidate
    return None


def convert(docx_path: Path, outdir: Path) -> Path:
    """Convert docx_path -> PDF in outdir. Returns the .pdf path.

    Raises RuntimeError if LibreOffice is missing or the PDF wasn't produced.
    """
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError(
            "LibreOffice not found. Install it, or export the PDF manually "
            "(Word / Google Docs -> Save as PDF preserves Cyrillic)."
        )
    outdir.mkdir(parents=True, exist_ok=True)
    # LibreOffice prints a harmless "Could not find platform independent
    # libraries" warning and still exits 0 — so we verify the .pdf exists
    # rather than trusting the exit code or the log.
    subprocess.run(
        [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(outdir), str(docx_path)],
        check=False,
        capture_output=True,
    )
    pdf_path = outdir / (docx_path.stem + ".pdf")
    if not pdf_path.is_file():
        raise RuntimeError(f"LibreOffice ran but no PDF was produced at {pdf_path}")
    return pdf_path


def main(argv=None) -> int:
    try:  # keep Cyrillic status prints from crashing on a cp1252 console (Windows)
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    parser = argparse.ArgumentParser(description="Convert a .docx to .pdf via LibreOffice headless")
    parser.add_argument("docx", help="Path to the .docx file")
    parser.add_argument("--outdir", help="Output folder (default: the .docx's folder)")
    args = parser.parse_args(argv)

    docx_path = Path(args.docx)
    if not docx_path.is_file():
        sys.stderr.write(f"No such file: {docx_path}\n")
        return 2
    outdir = Path(args.outdir) if args.outdir else docx_path.parent
    try:
        pdf_path = convert(docx_path, outdir)
    except RuntimeError as exc:
        sys.stderr.write(f"{exc}\n")
        return 1
    print(f"Wrote {pdf_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
