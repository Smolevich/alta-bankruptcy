"""Photos and PDFs for cases: type by content, re-encoding without EXIF, storage next to the database.

An image is always rebuilt through Pillow: this drops EXIF (geotag, phone model), XMP and anything
that could have been appended to the file tail, and HEIC becomes JPEG that any browser opens.
"""

import io
import os
import re
import secrets
import shutil
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import pillow_heif
from PIL import Image, ImageOps, UnidentifiedImageError

from alta_feedback.aod_archive import backup

pillow_heif.register_heif_opener()

MAX_FILES = 10
FILE_MAX = 10 * 1024 * 1024
TOTAL_MAX = 40 * 1024 * 1024
MAX_SIDE = 2560
# Protection against a "bomb": a small file that decompresses into gigapixels.
MAX_PIXELS = 60_000_000
JPEG_QUALITY = 85
# How many files we accept per IP hash per hour, separate from the limit on the cases themselves.
FILES_PER_HOUR = 30
# Space: below this free remainder on disk we do not accept uploads, the database and backups matter more.
MIN_FREE_BYTES = 3 * 1024**3
STORE_MAX_BYTES = 5 * 1024**3
FILES_DIR = "case-files"
NAME_RE = re.compile(r"^[0-9a-f]{24}\.(jpg|png|pdf)$")
MEDIA_TYPES = {"jpg": "image/jpeg", "png": "image/png", "pdf": "application/pdf"}

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class UploadError(ValueError):
    """File rejected; code is the key of the error text in the page language."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class CleanFile:
    data: bytes
    ext: str

    @property
    def kind(self) -> str:
        return "pdf" if self.ext == "pdf" else "image"


def sniff(head: bytes) -> str | None:
    """Type by the first bytes, not by name or the browser's Content-Type."""
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[4:8] == b"ftyp" and head[8:12] in {b"heic", b"heix", b"hevc", b"heim", b"heis", b"mif1", b"msf1"}:
        return "heic"
    if head.startswith(b"%PDF-"):
        return "pdf"
    return None


def reencode(data: bytes, kind: str) -> CleanFile:
    """Opens an image, rotates it by EXIF and saves it again, now without metadata."""
    try:
        with Image.open(io.BytesIO(data)) as img:
            if img.width * img.height > MAX_PIXELS:
                raise UploadError("broken")
            img.load()
            image = ImageOps.exif_transpose(img)
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError) as e:
        raise UploadError("broken") from e
    image.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    if kind == "png":
        image.save(out, format="PNG", optimize=True)
        return CleanFile(out.getvalue(), "png")
    if image.mode not in {"RGB", "L"}:
        image = image.convert("RGB")
    image.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return CleanFile(out.getvalue(), "jpg")


def clean_pdf(data: bytes) -> CleanFile:
    if b"%%EOF" not in data[-2048:]:
        raise UploadError("broken")
    return CleanFile(data, "pdf")


def clean_upload(data: bytes) -> CleanFile:
    """One form file -> a safe copy; type, size and integrity are checked here."""
    if len(data) > FILE_MAX:
        raise UploadError("file_big")
    kind = sniff(data[:16])
    if kind is None:
        raise UploadError("file_type")
    return clean_pdf(data) if kind == "pdf" else reencode(data, kind)


def files_root(data_dir: Path) -> Path:
    return data_dir / FILES_DIR


def stored_bytes(root: Path) -> int:
    return sum(p.stat().st_size for p in root.glob("*") if p.is_file()) if root.is_dir() else 0


def has_room(root: Path, incoming: int, min_free: int = MIN_FREE_BYTES, quota: int = STORE_MAX_BYTES) -> bool:
    """Is there enough space: both free on disk and within the quota allotted to cases."""
    root.mkdir(parents=True, exist_ok=True)
    free = shutil.disk_usage(root).free
    return free - incoming >= min_free and stored_bytes(root) + incoming <= quota


def save(root: Path, item: CleanFile) -> str:
    """Writes a file under a random name (it cannot be guessed by brute force) and returns the name."""
    root.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(12)}.{item.ext}"
    tmp = root / f".{name}.tmp"
    tmp.write_bytes(item.data)
    tmp.replace(root / name)
    return name


def path_of(root: Path, name: str) -> Path | None:
    """Path to a file by a name from the database; anything that does not look like our name gives None."""
    if not NAME_RE.match(name):
        return None
    path = root / name
    return path if path.is_file() else None


def remove(root: Path, names: list[str]) -> None:
    for name in names:
        path = path_of(root, name)
        if path:
            path.unlink()


def media_type(name: str) -> str:
    return MEDIA_TYPES[name.rsplit(".", 1)[-1]]


def main() -> int:
    """Backup of the files folder for the nightly bot backups: runs on the same timer as the AOD archive."""
    data_dir = Path(os.environ.get("DATA_DIR", "data"))
    backup_dir = os.environ.get("CASES_BACKUP_DIR")
    root = files_root(data_dir)
    if not backup_dir:
        print("CASES_BACKUP_DIR не задан — бэкап файлов кейсов пропущен")
        return 0
    root.mkdir(parents=True, exist_ok=True)
    # Files lie flat: adding and deleting change the folder's mtime, and the backup will notice.
    out = backup(root, Path(backup_dir), datetime.now(UTC).date().isoformat(), files=[root])
    print(f"case files: {stored_bytes(root)} bytes → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
