#!/usr/bin/env python3
"""Exercise a portable build without mutating the working game."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "export-standalone.py"


def run(site, *args, success=True):
    result = subprocess.run(["python3", str(TOOL), "--site-dir", str(site), *args], text=True, capture_output=True)
    assert (result.returncode == 0) == success, result.stdout + result.stderr
    return result


with tempfile.TemporaryDirectory(prefix="blooming-export-") as folder:
    temporary = Path(folder)
    site = temporary / "site"
    shutil.copytree(ROOT / "dist", site)
    run(site, "--prepare-only")
    run(site, "--check")
    first = (site / "offline-files.js").read_text()
    (site / "index.html").write_text((site / "index.html").read_text() + "\n<!-- different tested release -->\n")
    run(site, "--check", success=False)
    run(site, "--prepare-only")
    assert (site / "offline-files.js").read_text() != first, "source changes must produce a different offline release"
    destination = temporary / "browser.zip"
    run(site, "--output", str(destination))
    with zipfile.ZipFile(destination) as archive:
        names = archive.namelist()
        assert "index.html" in names and "assets/world-v05.png" in names
        assert "offline-files.js" in names and "README-FIRST.txt" in names
        assert not any(name.startswith(("dist/", ".openai/", ".git/")) or "node_modules" in name for name in names)
        assert b"file://" in archive.read("README-FIRST.txt")
        for name in names:
            if name.endswith((".html", ".js", ".json", ".webmanifest")):
                assert b"appgprj_" not in archive.read(name), "no hosting project identity belongs in portable output"
    private = site / ".openai"
    private.mkdir()
    (private / "hosting.json").write_text('{"project_id":"must-not-export"}')
    run(site, "--output", str(temporary / "refused.zip"), success=False)
print("PASS: content-derived release identity/stale detection, index-at-root browser ZIP, local assets and README, and private-host/config exclusion.")
