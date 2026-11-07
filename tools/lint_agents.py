"""Structural lint for every generated agent tree (stdlib only; Python 3.11+ for tomllib).

Layer-2 check (PORTING-PLAN.layoff.md §4): asserts each emitted tree is well-formed in ITS tool's
schema, without running the tool. Covers OpenCode (YAML fm + permission), Codex (TOML), and Copilot
(YAML fm). Offline, no tokens.

Usage:  python tools/lint_agents.py
Exit 0 = all trees valid, 1 = at least one problem.
"""

from __future__ import annotations

import sys
import tomllib
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SPAWN_RE = re.compile(r"@([a-z][a-z0-9-]+)")


def frontmatter(text: str):
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, text
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return "\n".join(lines[1:i]), "\n".join(lines[i + 1:])
    return None, text


def top_keys(fm: str) -> set[str]:
    keys = set()
    for ln in fm.splitlines():
        if ln and not ln[0].isspace():
            m = re.match(r"([A-Za-z_][\w-]*)\s*:", ln)
            if m:
                keys.add(m.group(1))
    return keys


def check_opencode(fail):
    d = ROOT / ".opencode" / "agents"
    files = sorted(d.glob("*.md"))
    names = {f.stem for f in files}
    if not files:
        fail("opencode", f"no agent files in {d}")
        return
    for f in files:
        fm, body = frontmatter(f.read_text(encoding="utf-8"))
        if fm is None:
            fail("opencode", f"{f.name}: missing frontmatter")
            continue
        keys = top_keys(fm)
        for req in ("description", "mode"):
            if req not in keys:
                fail("opencode", f"{f.name}: missing '{req}'")
        if "permission" not in keys:
            fail("opencode", f"{f.name}: missing 'permission'")
        for ref in SPAWN_RE.findall(body):
            if ref not in names:
                fail("opencode", f"{f.name}: @{ref} references a missing agent")
    return len(files)


def check_codex(fail):
    d = ROOT / ".codex" / "agents"
    files = sorted(d.glob("*.toml"))
    if not files:
        fail("codex", f"no agent files in {d}")
        return
    for f in files:
        try:
            data = tomllib.loads(f.read_text(encoding="utf-8"))
        except tomllib.TOMLDecodeError as exc:
            fail("codex", f"{f.name}: TOML parse error — {exc}")
            continue
        for req in ("name", "description", "developer_instructions"):
            if not data.get(req):
                fail("codex", f"{f.name}: missing '{req}'")
        sm = data.get("sandbox_mode")
        if sm and sm not in ("read-only", "workspace-write", "danger-full-access"):
            fail("codex", f"{f.name}: bad sandbox_mode '{sm}'")
    return len(files)


def check_copilot(fail):
    d = ROOT / ".github" / "agents"
    files = sorted(d.glob("*.agent.md"))
    if not files:
        fail("copilot", f"no agent files in {d}")
        return
    for f in files:
        fm, _ = frontmatter(f.read_text(encoding="utf-8"))
        if fm is None:
            fail("copilot", f"{f.name}: missing frontmatter")
            continue
        if "description" not in top_keys(fm):
            fail("copilot", f"{f.name}: missing required 'description'")
    return len(files)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    failures: list[tuple[str, str]] = []
    fail = lambda tool, msg: failures.append((tool, msg))
    counts = {
        "opencode": check_opencode(fail),
        "codex": check_codex(fail),
        "copilot": check_copilot(fail),
    }
    print("Agent-tree lint")
    for tool, n in counts.items():
        marks = [m for t, m in failures if t == tool]
        status = "FAIL" if marks else "PASS"
        print(f"  [{status}] {tool}: {n or 0} files" + (f" — {len(marks)} problem(s)" if marks else ""))
        for m in marks:
            print(f"      - {m}")
    ok = not failures
    print("\nRESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
