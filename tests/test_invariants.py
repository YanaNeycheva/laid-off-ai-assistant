"""Static repo-invariant tests — run with `python -m unittest discover -s tests`.

Layer A of the test strategy: cheap, stdlib-only structural checks that catch
the classes of regression this repo can suffer *silently* — an agent whose
frontmatter `tools:` no longer covers what its own spec body does (the F1-class
bug), person data accidentally tracked in git, a VERSION/tag/CHANGELOG that drift
apart, banned wording leaking into user-facing content, the freshness gate
falling out of the orchestrator, or the bg-legal ДНЕВНИК table going malformed.

Stdlib `unittest` only (no pytest). Every check is its own test method with a
message that says exactly what broke.
"""

import os
import re
import subprocess
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENTS_DIR = os.path.join(REPO_ROOT, ".claude", "agents")


def _read(*parts):
    with open(os.path.join(REPO_ROOT, *parts), encoding="utf-8") as fh:
        return fh.read()


def _git(*args):
    """Run a git command at the repo root. Returns (ok, stdout).

    ok is False when git is missing or the command fails, so git-dependent
    checks can skip gracefully in environments without git or without tags
    (e.g. a shallow CI clone) instead of failing spuriously.
    """
    try:
        out = subprocess.run(
            ["git", *args],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
    except (OSError, FileNotFoundError):
        return False, ""
    if out.returncode != 0:
        return False, out.stdout.strip()
    return True, out.stdout.strip()


def _split_frontmatter(text):
    """Return the YAML frontmatter block of a Markdown file, or ''."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    return m.group(1) if m else ""


def _frontmatter_tools(text):
    """Parse the `tools:` line of an agent's frontmatter into a set of names."""
    fm = _split_frontmatter(text)
    m = re.search(r"^tools:\s*(.+)$", fm, re.MULTILINE)
    if not m:
        return set()
    return {t.strip() for t in m.group(1).split(",") if t.strip()}


def _agent_files():
    return sorted(
        os.path.join(AGENTS_DIR, f)
        for f in os.listdir(AGENTS_DIR)
        if f.endswith(".md")
    )


class TestAgentToolSpecMatch(unittest.TestCase):
    """The F1-class bug: an agent's frontmatter `tools:` must cover what its own
    spec body says it does. Heuristics infer the required tool from the prose;
    each missing tool fails with the agent name + the tool + why.
    """

    # (tool, human reason, compiled signal that means the body needs the tool)
    REQUIREMENTS = [
        (
            "Write",
            "the body writes/updates the dossier or a file",
            re.compile(
                r"\bwrite(s)?\b|\bstamp(s)?\b|copy\b[^.\n]{0,40}\binto\b"
                r"|\bseed(s|ed)?\b|updates?\b[^.\n]{0,30}dossier",
                re.IGNORECASE,
            ),
        ),
        (
            "Bash",
            "the body renders .docx/.pdf or calls python/soffice/a shell",
            re.compile(
                r"\.docx|\.pdf|soffice|python\s|python -m|```bash|\bbash\b",
                re.IGNORECASE,
            ),
        ),
        (
            "Skill",
            "the body runs a skill",
            re.compile(
                r"tailor-cv|run(s|ning)?\b[^.\n]{0,40}\bskill\b",
                re.IGNORECASE,
            ),
        ),
        (
            "WebSearch",
            "the body web-searches / re-verifies against an official source",
            re.compile(r"websearch|web search|re-?verify|verify live", re.IGNORECASE),
        ),
        (
            "WebFetch",
            "the body fetches a posting/URL/page",
            re.compile(
                r"webfetch|fetch\b[^.\n]{0,30}(posting|url|page|jd)",
                re.IGNORECASE,
            ),
        ),
    ]

    def test_every_agent_has_the_tools_its_spec_requires(self):
        missing = []
        for path in _agent_files():
            text = _read(path)
            tools = _frontmatter_tools(text)
            # Only scan the body (drop the frontmatter, which names tools).
            body = text[len(_split_frontmatter(text)):]
            for tool, reason, signal in self.REQUIREMENTS:
                if signal.search(body) and tool not in tools:
                    missing.append(
                        f"{os.path.basename(path)}: needs '{tool}' "
                        f"({reason}) but tools: {sorted(tools)}"
                    )
        self.assertEqual(
            missing, [],
            "Agent frontmatter `tools:` out of sync with spec body:\n  "
            + "\n  ".join(missing),
        )


class TestPersonDataNotTracked(unittest.TestCase):
    """Person data (dossiers, CVs, tracker, output) must never be committed."""

    def test_nothing_tracked_under_personal_or_work(self):
        ok, out = _git("ls-files", "Personal/", "work/")
        if not ok:
            self.skipTest("git not available")
        tracked = [ln for ln in out.splitlines() if ln.strip()]
        self.assertEqual(
            tracked, [],
            "Person data is tracked in git (must stay under git-ignored "
            f"Personal/ or work/): {tracked}",
        )

    def test_gitignore_ignores_personal_and_work(self):
        gi = _read(".gitignore")
        for pat in ("/Personal/", "/work/"):
            self.assertIn(
                pat, gi, f".gitignore is missing an ignore rule for {pat}"
            )


class TestVersionTagChangelog(unittest.TestCase):
    """VERSION, the latest git tag, and the CHANGELOG must agree."""

    def setUp(self):
        self.version = _read("VERSION").strip()

    def test_version_is_semver(self):
        self.assertRegex(
            self.version, r"^\d+\.\d+\.\d+$",
            f"VERSION is not MAJOR.MINOR.PATCH: {self.version!r}",
        )

    def test_version_matches_latest_tag(self):
        ok, out = _git("tag", "--list", "v*")
        if not ok or not out.strip():
            self.skipTest("git tags not available (e.g. shallow CI clone)")
        tags = [t.strip() for t in out.splitlines() if re.match(r"^v\d+\.\d+\.\d+$", t.strip())]
        if not tags:
            self.skipTest("no vX.Y.Z tags present")
        latest = max(tags, key=lambda t: tuple(int(n) for n in t[1:].split(".")))
        self.assertEqual(
            f"v{self.version}", latest,
            f"VERSION ({self.version}) does not match the latest git tag "
            f"({latest}). Bump one to match the other.",
        )

    def test_changelog_has_entry_for_current_version(self):
        changelog = _read("CHANGELOG.md")
        self.assertIn(
            f"[{self.version}]", changelog,
            f"CHANGELOG.md has no entry for the current VERSION {self.version}",
        )


class TestForbiddenPhrases(unittest.TestCase):
    """Banned wording must not appear in Bulgarian user-facing content.

    Scoped to pure-content trees — knowledge-base/ and agent/templates/ — so
    that the *rule statements* in CLAUDE.md / orchestrator.md (which necessarily
    quote the bans, e.g. no "неудобен") are not themselves flagged.
    """

    CONTENT_ROOTS = [
        os.path.join(REPO_ROOT, "knowledge-base"),
        os.path.join(REPO_ROOT, "agent", "templates"),
    ]

    # "не защото …, а защото" construction (allow words/punct between the two
    # halves) and "неудобен" + derivatives.
    BANNED = [
        ("не защото…, а защото construction",
         re.compile(r"не\s+защото\b[^\n]{0,80}?\bа\s+защото\b", re.IGNORECASE)),
        ("неудобен / derivatives",
         re.compile(r"неудоб\w*", re.IGNORECASE)),
    ]

    def _content_files(self):
        for root in self.CONTENT_ROOTS:
            if not os.path.isdir(root):
                continue
            for dirpath, _dirs, files in os.walk(root):
                for name in files:
                    if name.endswith(".md"):
                        yield os.path.join(dirpath, name)

    def test_no_banned_phrases_in_user_facing_content(self):
        hits = []
        for path in self._content_files():
            with open(path, encoding="utf-8") as fh:
                for lineno, line in enumerate(fh, 1):
                    for label, pat in self.BANNED:
                        if pat.search(line):
                            rel = os.path.relpath(path, REPO_ROOT)
                            hits.append(f"{rel}:{lineno} [{label}] {line.strip()}")
        self.assertEqual(
            hits, [],
            "Banned wording in user-facing content:\n  " + "\n  ".join(hits),
        )


class TestFreshnessGateWired(unittest.TestCase):
    """The orchestrator must still route bg-navigator output through the
    freshness-checker gate."""

    def test_orchestrator_references_freshness_gate(self):
        orch = _read("agent", "orchestrator.md")
        self.assertIn(
            "freshness-checker", orch,
            "orchestrator.md no longer references the freshness-checker",
        )
        self.assertRegex(
            orch, r"(?i)freshness gate",
            "orchestrator.md no longer has a 'Freshness gate' section",
        )


class TestBgLegalDnevnik(unittest.TestCase):
    """The bg-legal 'Дневник на проверките' table must stay well-formed:
    every row's status is one of ✅/⚠️/❗, and every ✅ row cites a source and a
    date."""

    VALID_STATUS = ("✅", "⚠️", "❗")

    @classmethod
    def setUpClass(cls):
        cls.kb = _read("knowledge-base", "bg-legal.md")

    def _dnevnik_rows(self):
        """Yield the data rows (list of cell strings) of the Дневник table."""
        lines = self.kb.splitlines()
        # Find the section header, then the first table header after it.
        start = next(
            (i for i, ln in enumerate(lines) if "Дневник на проверките" in ln),
            None,
        )
        self.assertIsNotNone(start, "'Дневник на проверките' section not found")
        rows = []
        seen_header = False
        for ln in lines[start:]:
            s = ln.strip()
            if not s.startswith("|"):
                if seen_header and not s:
                    continue
                if seen_header and rows:
                    break  # table ended
                continue
            cells = [c.strip() for c in s.strip("|").split("|")]
            if not seen_header:
                # header row (| Факт | ... |)
                if "Факт" in cells[0]:
                    seen_header = True
                continue
            if set("".join(cells)) <= set("-: "):
                continue  # separator row |---|---|
            rows.append(cells)
        return rows

    def test_table_parses_and_has_rows(self):
        rows = self._dnevnik_rows()
        self.assertTrue(rows, "Дневник table parsed to zero data rows")
        for cells in rows:
            self.assertEqual(
                len(cells), 5,
                f"Дневник row does not have 5 columns: {cells}",
            )

    def test_status_values_are_valid(self):
        bad = []
        for cells in self._dnevnik_rows():
            status = cells[4]
            if not any(sym in status for sym in self.VALID_STATUS):
                bad.append(cells)
        self.assertEqual(
            bad, [],
            "Дневник rows with an invalid status (must be ✅/⚠️/❗): "
            + "; ".join(c[0] for c in bad),
        )

    def test_confirmed_rows_have_source_and_date(self):
        bad = []
        for cells in self._dnevnik_rows():
            fact, source, checked, status = cells[0], cells[2], cells[3], cells[4]
            if "✅" in status:
                has_source = bool(source) and source != "—"
                has_date = bool(re.search(r"\d{4}-\d{2}-\d{2}", checked))
                if not (has_source and has_date):
                    bad.append(f"{fact} (source={source!r}, date={checked!r})")
        self.assertEqual(
            bad, [],
            "✅ Дневник rows missing a source or a date:\n  " + "\n  ".join(bad),
        )


class TestBuildCvSkillWired(unittest.TestCase):
    """The /build-cv skill (base CV from scratch or ATS clean-up, no posting)
    must exist, declare its name, reuse tailor-cv's shared rules rather than
    duplicating them, and stay wired into both the orchestrator's routing and
    the cv-builder subagent."""

    def test_build_cv_skill_exists_and_is_named(self):
        fm = _split_frontmatter(_read(".claude", "skills", "build-cv", "SKILL.md"))
        self.assertRegex(
            fm, r"(?m)^name:\s*build-cv\s*$",
            "build-cv/SKILL.md frontmatter must declare `name: build-cv`",
        )

    def test_build_cv_reuses_shared_ats_rules(self):
        # Single source of truth: build-cv must point at tailor-cv's ats-rules,
        # not carry its own copy of the ATS ruleset.
        text = _read(".claude", "skills", "build-cv", "SKILL.md")
        self.assertIn(
            "tailor-cv/ats-rules.md", text,
            "build-cv must reference tailor-cv/ats-rules.md (shared rules), "
            "not duplicate the ATS ruleset",
        )

    def test_cv_builder_routes_to_build_cv(self):
        self.assertIn(
            "build-cv", _read(".claude", "agents", "cv-builder.md"),
            "cv-builder.md no longer routes base-CV work to /build-cv",
        )

    def test_orchestrator_routes_to_build_cv(self):
        self.assertIn(
            "build-cv", _read("agent", "orchestrator.md"),
            "orchestrator.md no longer routes base-CV work to /build-cv",
        )


if __name__ == "__main__":
    unittest.main()
