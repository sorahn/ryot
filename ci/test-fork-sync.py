import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("fork_sync", Path(__file__).with_name("fork-sync.py"))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class LicensingHistoryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        sync.ROOT = self.root
        sync.manifest_license.cache_clear()
        self.git("init", "-q")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "user.name", "License guard test")
        (self.root / "LICENSE").write_text("GPL-3.0 baseline\n")
        (self.root / "package.json").write_text('{"license":"GPL-3.0"}')
        self.base = self.commit()

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root).decode().strip()

    def commit(self):
        self.git("add", ".")
        self.git("commit", "-qm", "fixture")
        return self.git("rev-parse", "HEAD")

    def test_code_and_dependency_updates_pass(self):
        (self.root / "source.rs").write_text("fn main() {}\n")
        (self.root / "package.json").write_text('{"license":"GPL-3.0","version":"2"}')
        target = self.commit()
        self.assertEqual(sync.check_history(self.base, target), target)

    def test_license_change_and_later_revert_still_stop(self):
        (self.root / "LICENSE").write_text("Elastic-2.0\n")
        changed = self.commit()
        (self.root / "LICENSE").write_text("GPL-3.0 baseline\n")
        reverted = self.commit()
        with self.assertRaisesRegex(ValueError, changed):
            sync.check_history(self.base, reverted)

    def test_new_nested_license_stops(self):
        (self.root / "new-module").mkdir()
        (self.root / "new-module" / "LICENSE.txt").write_text("Different terms\n")
        with self.assertRaisesRegex(ValueError, "new-module/LICENSE.txt"):
            sync.check_history(self.base, self.commit())

    def test_package_license_change_stops(self):
        (self.root / "package.json").write_text('{"license":"Elastic-2.0"}')
        with self.assertRaisesRegex(ValueError, "package.json"):
            sync.check_history(self.base, self.commit())

    def test_rust_package_license_stops(self):
        (self.root / "Cargo.toml").write_text('[package]\nname="fixture"\nlicense="Elastic-2.0"\n')
        with self.assertRaisesRegex(ValueError, "Cargo.toml"):
            sync.check_history(self.base, self.commit())

    def test_deleted_license_stops(self):
        (self.root / "LICENSE").unlink()
        with self.assertRaisesRegex(ValueError, "LICENSE"):
            sync.check_history(self.base, self.commit())

    def test_side_branch_license_change_cannot_be_hidden_by_merge(self):
        self.git("checkout", "-qb", "side")
        (self.root / "LICENSE").write_text("Elastic-2.0\n")
        changed = self.commit()
        self.git("checkout", "-q", "-")
        self.git("merge", "--no-ff", "-s", "ours", "-qm", "merge fixture", "side")
        with self.assertRaisesRegex(ValueError, changed):
            sync.check_history(self.base, self.git("rev-parse", "HEAD"))

    def test_unrelated_history_stops(self):
        self.git("checkout", "--orphan", "unrelated")
        self.git("rm", "-rf", ".")
        (self.root / "LICENSE").write_text("GPL-3.0 baseline\n")
        with self.assertRaisesRegex(ValueError, "does not descend"):
            sync.check_history(self.base, self.commit())


if __name__ == "__main__":
    unittest.main()
