"""Generate other tools' agent trees from the .claude/ source of truth (stdlib only).

Decision (PORTING-PLAN.layoff.md §6.3): `.claude/` is the hand-authored source; every other
tool's tree is GENERATED from it. This emits the subagents for **OpenCode**, **Codex**, and
**Copilot** from `.claude/agents/*.md` + a per-tool adapter.

Tested tools: OpenCode is validated live. **Codex and Copilot are NOT installed on this machine,
so their trees are generated + structurally linted only — NOT behaviorally tested** (see the README
caveat and PORTING-PLAN.layoff.md Phase 6).

The `comeback` primary/entry is a per-tool recipe (Seam 4): hand-authored for OpenCode
(`.opencode/agents/comeback.md`); for Codex/Copilot it still needs a per-tool entry recipe before
those trees can actually drive the flow.

Usage:  python tools/gen_agents.py            # write all tool trees
        python tools/gen_agents.py --check    # exit 1 if any generated file is stale/missing

Run tools/lint_agents.py afterwards to validate the emitted trees.
"""

from __future__ import annotations

import json
import re
import sys
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLAUDE_AGENTS = ROOT / ".claude" / "agents"

# Tier -> model map (Seam 5), single source of truth. Model IDs live here, never in agent files.
TIER_MAP = json.loads((ROOT / "tiers.json").read_text(encoding="utf-8"))

# All subagents (.claude/agents/*.md). The `comeback` primary/entry is a per-tool recipe (Seam 4).
AGENTS = [
    "bg-navigator",
    "freshness-checker",
    "cv-builder",
    "interview-coach",
    "search-strategist",
    "company-intel",
]

# Per-agent model tier (Seam 5).
TIERS = {"freshness-checker": "strong"}
DEFAULT_TIER = "mid"

# Seam 3: tool-name references in prose -> tool-neutral wording (shared across non-Claude tools).
# The Claude `Skill` tool has no equivalent: /tailor-cv becomes a read-and-follow of the skill file.
PROSE_SUBS = [
    (r"\bWebSearch\b", "web search"),
    (r"\bWebFetch\b", "web fetch"),
    (r"via Bash", "in a shell"),
    (r"`?/tailor-cv`? skill", "tailor-cv flow (read & follow `.claude/skills/tailor-cv/SKILL.md`)"),
    (r"`?/build-cv`? skill", "build-cv flow (read & follow `.claude/skills/build-cv/SKILL.md`)"),
]


def neutralize(text: str) -> str:
    for pattern, repl in PROSE_SUBS:
        text = re.sub(pattern, repl, text)
    return text


def parse_claude_agent(md: str) -> tuple[dict, str]:
    """Split a .claude agent markdown into (frontmatter dict, body)."""
    lines = md.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("no frontmatter")
    i = 1
    fm: dict[str, str] = {}
    while i < len(lines) and lines[i].strip() != "---":
        if ":" in lines[i]:
            key, val = lines[i].split(":", 1)
            fm[key.strip()] = val.strip()
        i += 1
    body = "\n".join(lines[i + 1:]).lstrip("\n")
    return fm, body


def tools_list(fm: dict) -> list[str]:
    return [t.strip() for t in fm.get("tools", "").split(",") if t.strip()]


def fold_description(desc: str) -> str:
    wrapped = textwrap.wrap(desc, width=94) or [desc]
    return "description: >-\n" + "\n".join("  " + line for line in wrapped)


# --- OpenCode (.opencode/agents/*.md — YAML frontmatter + permission map) --------------------
OPENCODE_PERM = {"Read": "read", "Write": "edit", "Bash": "bash",
                 "WebSearch": "websearch", "WebFetch": "webfetch"}
OPENCODE_PERM_ORDER = ["read", "edit", "bash", "websearch", "webfetch"]


def render_opencode(name: str, fm: dict, body: str) -> str:
    allowed = {OPENCODE_PERM[t] for t in tools_list(fm) if t in OPENCODE_PERM}
    tier = TIERS.get(name, DEFAULT_TIER)
    model = TIER_MAP.get("opencode", {}).get(tier)

    out = ["---", fold_description(neutralize(fm.get("description", name))), "mode: subagent"]
    if model:
        out.append(f"model: {model}")
        out.append(f"# tier: {tier} -> model from tiers.json (Seam 5).")
    else:
        out.append(f"# tier: {tier}. no model in tiers.json -> inherits the tool default.")
    out.append("permission:")
    out += [f"  {k}: allow" for k in OPENCODE_PERM_ORDER if k in allowed]
    out.append("  task: deny")
    out.append("---")
    out.append("")
    out.append("<!-- GENERATED from .claude/agents/%s.md by tools/gen_agents.py (adapter: opencode)."
               % name)
    out.append("     Do not edit here — edit the .claude source and regenerate. -->")
    out.append("")
    out.append(neutralize(body).rstrip() + "\n")
    return "\n".join(out)


# --- Codex (.codex/agents/*.toml — TOML, developer_instructions body) -----------------------
def toml_basic(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def render_codex(name: str, fm: dict, body: str) -> str:
    tier = TIERS.get(name, DEFAULT_TIER)
    model = TIER_MAP.get("codex", {}).get(tier)
    instr = neutralize(body)
    if "'''" in instr:  # literal-string delimiter must not appear in the body
        raise ValueError(f"{name}: body contains ''' — cannot embed in a TOML literal string")

    out = [f'name = "{name}"',
           f"description = {toml_basic(neutralize(fm.get('description', name)))}"]
    if model:
        out.append(f'model = "{model}"')
    # All subagents write the dossier, so they need workspace-write (not read-only).
    out.append('sandbox_mode = "workspace-write"')
    out.append(f"# tier: {tier}. "
               + ("model from tiers.json." if model else "no model set -> inherits the parent."))
    out.append("")
    out.append(f"# GENERATED from .claude/agents/{name}.md by tools/gen_agents.py (adapter: codex).")
    out.append("# Do not edit here — edit the .claude source and regenerate.")
    out.append("# NOTE: agents that need the web (bg-navigator, freshness-checker, company-intel)")
    out.append("#   require Codex web access enabled — not expressible in this TOML. UNTESTED.")
    out.append("developer_instructions = '''")
    out.append(instr.rstrip())
    out.append("'''")
    return "\n".join(out) + "\n"


# --- Copilot (.github/agents/*.agent.md — YAML frontmatter + tool allowlist) ------------------
COPILOT_TOOLS = {"Read": "read", "Write": "edit", "Bash": "execute"}
COPILOT_TOOL_ORDER = ["read", "search", "edit", "execute", "agent"]


def render_copilot(name: str, fm: dict, body: str) -> str:
    mapped = {COPILOT_TOOLS[t] for t in tools_list(fm) if t in COPILOT_TOOLS}
    tools = [t for t in COPILOT_TOOL_ORDER if t in mapped]

    out = ["---", fold_description(neutralize(fm.get("description", name))), f"name: {name}"]
    if tools:
        out.append("tools: [" + ", ".join(f'"{t}"' for t in tools) + "]")
    out.append("---")
    out.append("")
    out.append(f"<!-- GENERATED from .claude/agents/{name}.md by tools/gen_agents.py "
               "(adapter: copilot). Do not edit here — edit the .claude source and regenerate.")
    out.append("     NOTE: Copilot CLI ignores `model:` (set it in ~/.copilot/settings.json). Web")
    out.append("     search is not in the tool allowlist here — web-verifying agents need an MCP "
               "web tool. UNTESTED. -->")
    out.append("")
    out.append(neutralize(body).rstrip() + "\n")
    return "\n".join(out)


# --- Registry ---------------------------------------------------------------------------------
TOOLS = {
    "opencode": (render_opencode, ROOT / ".opencode" / "agents", "{name}.md"),
    "codex": (render_codex, ROOT / ".codex" / "agents", "{name}.toml"),
    "copilot": (render_copilot, ROOT / ".github" / "agents", "{name}.agent.md"),
}


def generate() -> dict[Path, str]:
    outputs: dict[Path, str] = {}
    for name in AGENTS:
        fm, body = parse_claude_agent((CLAUDE_AGENTS / f"{name}.md").read_text(encoding="utf-8"))
        for tool, (render, out_dir, pattern) in TOOLS.items():
            outputs[out_dir / pattern.format(name=name)] = render(name, fm, body)
    return outputs


def main(argv=None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    argv = argv if argv is not None else sys.argv[1:]
    check = "--check" in argv
    outputs = generate()

    stale = []
    for path, content in outputs.items():
        current = path.read_text(encoding="utf-8") if path.is_file() else None
        if current != content:
            stale.append(path)
        if not check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")

    rel = sorted(str(p.relative_to(ROOT)) for p in outputs)
    if check:
        if stale:
            print("STALE (regenerate with `python tools/gen_agents.py`):")
            for p in stale:
                print(f"  {p.relative_to(ROOT)}")
            return 1
        print(f"up to date: {len(rel)} files across {len(TOOLS)} tools")
        return 0
    print("generated:\n  " + "\n  ".join(rel))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
