"""Guard: the generated tool trees must stay in sync with the .claude/ source.

Single-source-of-truth invariant (Layer 1/3 of the porting test plan). If someone
edits `.claude/agents/` or the adapter in `tools/gen_agents.py` but forgets to
regenerate, this fails and tells them exactly what to run — so OpenCode/Codex/
Copilot can never silently drift from Claude Code. Stdlib only; runs on a clean
clone (no pip installs) as part of the pre-push gate.
"""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import gen_agents  # noqa: E402  (path inserted above)


class GeneratedTreesUpToDate(unittest.TestCase):
    def test_generated_trees_match_claude_source(self):
        stale = []
        for path, expected in gen_agents.generate().items():
            rel = path.relative_to(ROOT)
            if not path.is_file():
                stale.append(f"{rel} (missing)")
            elif path.read_text(encoding="utf-8") != expected:
                stale.append(f"{rel} (out of date)")
        self.assertEqual(
            stale, [],
            "Generated tool trees are out of sync with .claude/.\n"
            "Run `python tools/gen_agents.py` and commit the result.\n  "
            + "\n  ".join(stale),
        )


if __name__ == "__main__":
    unittest.main()
