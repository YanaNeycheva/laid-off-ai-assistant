"""Scoped behavioral assertion for the Phase-2 benefits slice (stdlib only).

Complements tests/e2e/check_artifacts.py: that checks the FULL flow (CV + tracker);
this checks only the benefits safety slice a Phase-2 run exercises —
orchestrator -> bg-navigator -> freshness-checker -> dossier Legal/benefits section.
Runs against a produced run folder (under Personal/, git-ignored).

Usage:  python tools/check_benefits_slice.py Personal/<date>-<slug>/
Exit 0 = every required check passes, 1 otherwise.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


def check(run_dir: Path) -> bool:
    dossier = run_dir / "dossier.md"
    checks: list[tuple[str, bool, str]] = []

    if not dossier.is_file():
        print(f"FAIL: no dossier.md in {run_dir}")
        return False
    text = dossier.read_text(encoding="utf-8")

    # Isolate the Legal / benefits section.
    m = re.search(r"##\s*Legal\s*/\s*benefits(.*?)(?:\n##\s|\Z)", text, re.S)
    section = m.group(1) if m else ""

    checks.append(("Legal / benefits section present + non-trivial", len(section) > 300,
                   f"{len(section)} chars"))
    checks.append(("mentions Бюро по труда (bureau registration)", "Бюро" in section, ""))
    checks.append(("mentions НОИ", "НОИ" in section, ""))
    checks.append(("has a benefit estimate in EUR", bool(re.search(r"\bEUR\b", section)), ""))
    checks.append(("has a concrete deadline date (year 2026)", "2026" in section, ""))
    checks.append(("freshness handoff present (За потвърждаване)",
                   "потвърждаване" in section.lower() or "freshness" in section.lower(), ""))
    # Deterministic-boundary signal: the конверсия / формула should reference the calculator's
    # world (60% rate, daily bounds) rather than a hand-waved number.
    checks.append(("references the 60% benefit formula", "60%" in section, ""))

    ok = all(c[1] for c in checks)
    print(f"Benefits-slice check — {run_dir}")
    for name, passed, detail in checks:
        mark = "PASS" if passed else "FAIL"
        print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""))
    print("\nRESULT:", "PASS" if ok else "FAIL")
    return ok


def main(argv=None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) != 1:
        print("usage: python tools/check_benefits_slice.py Personal/<date>-<slug>/", file=sys.stderr)
        return 2
    run_dir = Path(argv[0])
    if not run_dir.is_dir():
        print(f"error: run folder not found: {run_dir}", file=sys.stderr)
        return 2
    return 0 if check(run_dir) else 1


if __name__ == "__main__":
    raise SystemExit(main())
