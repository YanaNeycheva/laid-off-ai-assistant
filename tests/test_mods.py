"""Static invariants for the comeback Claude Code plugin in .claude/skills/comeback-mods.

The plugin's behaviour is tested by `claude plugin test .claude/skills/comeback-mods`; this
file guards what that runner cannot see: the plugin matches the repo (version,
dossier template, bg-legal verification log) and keeps its read-only,
no-reduced-motion contract. Stdlib `unittest` only.
"""

import json
import os
import re
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLUGIN = os.path.join(REPO_ROOT, ".claude", "skills", "comeback-mods")


def _read(*parts):
    with open(os.path.join(REPO_ROOT, *parts), encoding="utf-8") as fh:
        return fh.read()


def _plugin_sources():
    out = {}
    for base in ("hooks",):
        for root, _dirs, files in os.walk(os.path.join(PLUGIN, base)):
            for name in files:
                if name.endswith((".ts", ".tsx")):
                    path = os.path.join(root, name)
                    with open(path, encoding="utf-8") as fh:
                        out[os.path.relpath(path, REPO_ROOT)] = fh.read()
    return out


class TestPluginLayout(unittest.TestCase):
    def test_required_files_exist(self):
        for rel in (
            ".claude-plugin/plugin.json",
            "hooks/hooks.json",
            "hooks/register.tsx",
            "hooks/features/deadlines.tsx",
            "hooks/features/documents.tsx",
            "hooks/shared/documents.ts",
            "hooks/shared/dossier.ts",
            "hooks/shared/ui.tsx",
        ):
            self.assertTrue(os.path.isfile(os.path.join(PLUGIN, rel)), f"missing .claude/skills/comeback-mods/{rel}")
        self.assertTrue(os.path.isfile(os.path.join(PLUGIN, "README.md")))

    def test_hooks_json_names_register(self):
        data = json.loads(_read(".claude", "skills", "comeback-mods", "hooks", "hooks.json"))
        self.assertEqual(data, {"modules": ["./register.tsx"]})

    def test_plugin_version_matches_VERSION(self):
        manifest = json.loads(_read(".claude", "skills", "comeback-mods", ".claude-plugin", "plugin.json"))
        self.assertEqual(manifest["name"], "comeback")
        self.assertEqual(
            manifest["version"],
            _read("VERSION").strip(),
            ".claude/skills/comeback-mods plugin.json version must equal VERSION",
        )


class TestPluginContract(unittest.TestCase):
    def test_read_only(self):
        """The mod never writes or transmits person data."""
        for rel, src in _plugin_sources().items():
            for banned in (r"\$\.fs\.write", r"\bfetch\(", r"\$\.network", r"\$\.process"):
                self.assertIsNone(re.search(banned, src), f"{rel} uses {banned}: the mod must stay read-only")

    def test_no_reduced_motion_branching(self):
        for rel, src in _plugin_sources().items():
            self.assertNotRegex(src.lower(), r"reduced[-_ ]?motion", f"{rel}: no reduced-motion branching (project rule)")


class TestDocumentsWiring(unittest.TestCase):
    def test_registered_once(self):
        reg = _read(".claude", "skills", "comeback-mods", "hooks", "register.tsx")
        self.assertEqual(reg.count("registerDocuments(on)"), 1)

    def test_feature_keeps_discovery_in_shared_module(self):
        feature = _read(".claude", "skills", "comeback-mods", "hooks", "features", "documents.tsx")
        self.assertIn("../shared/documents", feature)
        self.assertNotIn("fs.list", feature)
        self.assertNotIn("on('prompt.submit'", feature)

    def test_status_key_reserved(self):
        self.assertIn("'documents'", _read(".claude", "skills", "comeback-mods", "hooks", "shared", "status.ts"))


class TestRunwayWiring(unittest.TestCase):
    def test_registered_once(self):
        reg = _read(".claude", "skills", "comeback-mods", "hooks", "register.tsx")
        self.assertEqual(reg.count("registerRunway(on)"), 1)

    def test_feature_uses_shared_dossier_reader(self):
        feature = _read(".claude", "skills", "comeback-mods", "hooks", "features", "runway.tsx")
        self.assertIn("../shared/dossier", feature)
        self.assertNotIn("fs.list", feature)
        self.assertNotIn("on('prompt.submit'", feature)

    def test_status_key_reserved(self):
        self.assertIn("'runway'", _read(".claude", "skills", "comeback-mods", "hooks", "shared", "status.ts"))


class TestDeadlinesWiring(unittest.TestCase):
    """The deadlines feature, the dossier template and bg-legal.md agree."""

    def setUp(self):
        self.src = _read(".claude", "skills", "comeback-mods", "hooks", "features", "deadlines.tsx")
        self.facts = dict(
            re.findall(r"'([a-z-]+)':\s*\{\s*label:\s*'([^']+)'", self.src)
        )

    def test_fact_keys_found(self):
        self.assertTrue(self.facts, "could not parse FACTS from deadlines.tsx")

    def test_template_lists_exactly_the_fact_keys(self):
        template = _read("agent", "dossier-template.md")
        m = re.search(r"fact:\s*\{([^}]*)\}", template)
        self.assertIsNotNone(m, "dossier-template.md lacks the Deadlines `fact:` placeholder")
        listed = {k.strip() for k in m.group(1).split("|")}
        self.assertEqual(listed, set(self.facts), "template fact keys must equal FACTS keys")

    def test_template_has_deadlines_section(self):
        self.assertRegex(_read("agent", "dossier-template.md"), r"(?m)^## Deadlines \(")

    def test_every_label_with_a_row_is_a_real_log_fact(self):
        """Every mapped label must match a Дневник row exactly, so the gate
        reads the real verification status."""
        log = _read("knowledge-base", "bg-legal.md")
        rows = {
            line.split("|")[1].strip()
            for line in log.splitlines()
            if line.startswith("|") and line.count("|") >= 6
        }
        matched = {k for k, label in self.facts.items() if label in rows}
        self.assertIn("bureau-registration", matched)
        self.assertIn("noi-application", matched)
        self.assertIn("health-insurance", matched)
        self.assertEqual(matched, set(self.facts))


if __name__ == "__main__":
    unittest.main()
