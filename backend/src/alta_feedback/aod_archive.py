"""Our own copy of the PDFs from the AOD site (www.aod.rs) that the reference links to.

The reference shows them from our address so the documents do not vanish with the AOD site.
Once a day `python -m alta_feedback.aod_archive` compares the copy with the original: it downloads
what is missing, stores a changed original beside it as a new dated version, and still serves
the first copy, the one described in the manifest.

On disk (`$DATA_DIR/aod/`):
  public/<name>    - served at /docs/aod/<name>
  private/<name>   - documents with lists of private-person creditors, never served
  versions/<stem>-<YYYY-MM-DD>.pdf - an original that changed after the first copy
  check.log        - one JSON line per run
"""

import hashlib
import json
import os
import re
import sys
import tarfile
import time
import urllib.request
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

MANIFEST_FILE = Path(__file__).parent / "data" / "aod_archive.json"
FETCH_TIMEOUT = 300
CHUNK = 1 << 20
USER_AGENT = "alta.smolevich.com archive check (+https://alta.smolevich.com)"


@dataclass(frozen=True)
class ArchivedPdf:
    name: str
    url: str
    public: bool
    sha256: str
    bytes: int
    fetched: str


@dataclass(frozen=True)
class CheckResult:
    name: str
    status: str  # ok | seeded | changed | unavailable
    sha256: str | None = None
    detail: str = ""


def load_manifest(path: Path = MANIFEST_FILE) -> dict[str, ArchivedPdf]:
    items = [ArchivedPdf(**raw) for raw in json.loads(path.read_text(encoding="utf-8"))]
    return {item.name: item for item in items}


def archive_root(data_dir: Path) -> Path:
    return data_dir / "aod"


def copy_path(root: Path, item: ArchivedPdf) -> Path:
    return root / ("public" if item.public else "private") / item.name


def version_path(root: Path, item: ArchivedPdf, day: str) -> Path:
    return root / "versions" / f"{Path(item.name).stem}-{day}.pdf"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def known_hashes(root: Path, item: ArchivedPdf) -> set[str]:
    """Hashes of everything we already hold for a document: the copy and saved versions."""
    stem = Path(item.name).stem
    paths = [copy_path(root, item), *(root / "versions").glob(f"{stem}-*.pdf")]
    return {file_sha256(p) for p in paths if p.is_file()}


def classify(has_copy: bool, fetched_sha: str, known: set[str]) -> str:
    if not has_copy:
        return "seeded"
    return "ok" if fetched_sha in known else "changed"


def fetch_url(url: str) -> str:
    """The web archive without `id_` gives programs an HTML wrapper, not the file itself."""
    return re.sub(r"(web\.archive\.org/web/\d+)/", r"\1id_/", url)


class NotPdf(OSError):
    pass


def download(url: str, dest: Path) -> str:
    """Downloads to dest and returns sha256; does not read it all into memory - a 100 MB monograph.

    A response that does not start with %PDF (an error page with code 200) is NotPdf.
    """
    request = urllib.request.Request(fetch_url(url), headers={"User-Agent": USER_AGENT})
    digest = hashlib.sha256()
    with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT) as response, dest.open("wb") as out:
        first = True
        while chunk := response.read(CHUNK):
            if first and not chunk.startswith(b"%PDF"):
                raise NotPdf(f"not a PDF: {chunk[:40]!r}")
            first = False
            digest.update(chunk)
            out.write(chunk)
    return digest.hexdigest()


def check_one(root: Path, item: ArchivedPdf, day: str) -> CheckResult:
    copy = copy_path(root, item)
    copy.parent.mkdir(parents=True, exist_ok=True)
    tmp = root / f".{item.name}.part"
    try:
        sha = download(item.url, tmp)
    except OSError as e:
        tmp.unlink(missing_ok=True)
        return CheckResult(item.name, "unavailable", detail=str(e)[:200])
    status = classify(copy.is_file(), sha, known_hashes(root, item))
    if status == "seeded":
        tmp.replace(copy)
    elif status == "changed":
        target = version_path(root, item, day)
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp.replace(target)
    else:
        tmp.unlink()
    detail = "differs from manifest" if status == "seeded" and sha != item.sha256 else ""
    return CheckResult(item.name, status, sha, detail)


def archive_files(root: Path) -> Iterator[Path]:
    for sub in ("public", "private", "versions"):
        yield from (p for p in sorted((root / sub).glob("*.pdf")) if p.is_file())


def backup(root: Path, backup_dir: Path, day: str, files: list[Path] | None = None) -> Path:
    """The whole archive (or files inside root) into <backup_dir>/<day>.tar.gz for the nightly copy to R2.

    A new tar only if something newer than last time appeared in the archive; otherwise the previous one
    is just "refreshed", so the weekly backup check sees the job is alive.
    """
    backup_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    previous = max(backup_dir.glob("*.tar.gz"), key=lambda p: p.stat().st_mtime, default=None)
    files = list(archive_files(root)) if files is None else files
    if previous and all(p.stat().st_mtime <= previous.stat().st_mtime for p in files):
        previous.touch()
        return previous
    out = backup_dir / f"{day}.tar.gz"
    tmp = out.with_suffix(".tmp")
    with tarfile.open(tmp, "w:gz", compresslevel=1) as tar:
        for path in files:
            tar.add(path, arcname=str(path.relative_to(root.parent)))
    tmp.replace(out)
    return out


def summary(results: list[CheckResult]) -> str:
    counts: dict[str, int] = {}
    for r in results:
        counts[r.status] = counts.get(r.status, 0) + 1
    head = ", ".join(f"{status} {n}" for status, n in sorted(counts.items()))
    notable = [f"{r.name}: {r.status} {r.detail}".strip() for r in results if r.status != "ok"]
    return "; ".join([f"aod-archive: {head}", *notable])


def run(data_dir: Path, backup_dir: Path | None, manifest: dict[str, ArchivedPdf]) -> list[CheckResult]:
    root = archive_root(data_dir)
    root.mkdir(parents=True, exist_ok=True)
    day = datetime.now(UTC).strftime("%Y-%m-%d")
    results = [check_one(root, item, day) for item in manifest.values()]
    line = {"at": datetime.now(UTC).isoformat(timespec="seconds"), "results": [r.__dict__ for r in results]}
    with (root / "check.log").open("a", encoding="utf-8") as log:
        log.write(json.dumps(line, ensure_ascii=False) + "\n")
    if backup_dir:
        backup(root, backup_dir, day)
    return results


def main() -> int:
    data_dir = Path(os.environ.get("DATA_DIR", "data"))
    backup_dir = os.environ.get("AOD_BACKUP_DIR")
    started = time.monotonic()
    results = run(data_dir, Path(backup_dir) if backup_dir else None, load_manifest())
    print(f"{summary(results)} ({time.monotonic() - started:.0f}s)")
    # An unavailable original is not a job failure: the site keeps serving its own copy.
    return 0


if __name__ == "__main__":
    sys.exit(main())
