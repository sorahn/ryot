#!/usr/bin/env python3
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path("/app")
RUNTIME = Path("/runtime")


def fingerprint():
    files = [ROOT / "Cargo.toml", ROOT / "Cargo.lock", ROOT / "rust-toolchain.toml"]
    for directory in (ROOT / "crates", ROOT / "apps/backend"):
        files.extend(path for path in directory.rglob("*")
                     if path.is_file() and path.suffix in (".rs", ".toml", ".html", ".txt"))
    states = {}
    for path in files:
        try:
            stat = path.stat()
            states[str(path)] = (stat.st_mtime_ns, stat.st_size)
        except FileNotFoundError:
            pass
    return states


def stop(process):
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def main():
    RUNTIME.mkdir(exist_ok=True)
    process = None
    previous = None

    def interrupted(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        while True:
            current = fingerprint()
            if current != previous:
                previous = current
                print("Building debug backend (incremental cache retained)...", flush=True)
                result = subprocess.run(["cargo", "build", "--locked"], cwd=ROOT)
                if result.returncode == 0:
                    stop(process)
                    process = subprocess.Popen(
                        [str(Path(os.environ["CARGO_TARGET_DIR"]) / "debug/backend")],
                        cwd=RUNTIME,
                    )
                else:
                    print("Build failed; fix the source to retry. Last working backend retained.", flush=True)
            if process and process.poll() is not None:
                raise RuntimeError("Backend exited; inspect its logs and restart the service")
            time.sleep(1)
    finally:
        stop(process)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
