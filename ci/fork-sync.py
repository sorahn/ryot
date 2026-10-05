#!/usr/bin/env python3
"""Check incoming history for licensing changes before an optional upstream merge."""

import argparse
from functools import cache
import json
from pathlib import Path
import subprocess
import sys
import tomllib


ROOT = Path(__file__).resolve().parent.parent


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT).decode()


@cache
def manifest_license(blob, name):
    content = git("cat-file", "blob", blob)
    if name == "package.json":
        value = json.loads(content)
        return {key: value[key] for key in ("license", "licenses") if key in value}
    value = tomllib.loads(content)
    return {
        section: {key: data[key] for key in ("license", "license-file") if key in data}
        for section, data in (
            ("package", value.get("package", {})),
            ("workspace.package", value.get("workspace", {}).get("package", {})),
        )
        if any(key in data for key in ("license", "license-file"))
    }


def licensing_snapshot(commit):
    snapshot = {}
    for entry in git("ls-tree", "-rz", "--full-tree", commit).split("\0"):
        if not entry:
            continue
        metadata, path = entry.split("\t", 1)
        mode, kind, blob = metadata.split()
        name = Path(path).name
        if name.upper().startswith(("LICENSE", "LICENCE", "COPYING", "NOTICE")):
            snapshot[path] = (mode, kind, blob)
        elif kind == "blob" and name in ("package.json", "Cargo.toml"):
            license_value = manifest_license(blob, name)
            if license_value:
                snapshot[path] = license_value
    return snapshot


def check_history(base, target):
    if subprocess.run(
        ["git", "merge-base", "--is-ancestor", base, target], cwd=ROOT
    ).returncode:
        raise ValueError("Target does not descend from the GPL baseline; refusing rewritten history.")
    baseline = licensing_snapshot(base)
    if "LICENSE" not in baseline:
        raise ValueError("GPL baseline is missing LICENSE.")
    for commit in git("rev-list", "--reverse", "--topo-order", f"{base}..{target}").splitlines():
        snapshot = licensing_snapshot(commit)
        changed = sorted(
            path for path in baseline.keys() | snapshot.keys()
            if baseline.get(path) != snapshot.get(path)
        )
        if changed:
            raise ValueError(
                f"Licensing changed at {commit}: {', '.join(changed)}. "
                "Stop upstream updates here; do not reset the GPL baseline, even if later reverted."
            )
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ref", nargs="?", default="upstream/main")
    parser.add_argument("--fetch", action="store_true", help="Fetch IgnisDa/ryot main over HTTPS.")
    parser.add_argument("--merge", action="store_true", help="Merge the checked commit into the current branch.")
    args = parser.parse_args()
    if args.merge and git("status", "--porcelain").strip():
        raise ValueError("Commit or stash local changes before merging upstream.")
    if args.fetch:
        subprocess.run(
            ["git", "fetch", "https://github.com/IgnisDa/ryot.git",
             "main:refs/remotes/upstream/main"], cwd=ROOT, check=True,
        )
    base = (ROOT / ".fork/upstream-base").read_text().strip()
    target = git("rev-parse", "--verify", f"{args.ref}^{{commit}}").strip()
    check_history(base, target)
    if args.merge:
        check_history(base, git("rev-parse", "HEAD").strip())
        subprocess.run(["git", "merge", "--no-edit", target], cwd=ROOT, check=True)
    print(f"Licensing unchanged through {target}.")
    print("Review incoming source headers and other terms before publishing; this is a conservative metadata guard.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, subprocess.CalledProcessError, OSError) as error:
        print(f"Upstream sync stopped: {error}", file=sys.stderr)
        sys.exit(1)
