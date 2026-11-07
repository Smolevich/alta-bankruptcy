"""Фото и PDF к кейсам: тип по содержимому, перекодирование без EXIF, хранение рядом с базой.

Картинку всегда пересобираем через Pillow: так уходят EXIF (геометка, модель телефона), XMP и всё,
что могли дописать в хвост файла, а HEIC становится JPEG, который откроет любой браузер.
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
# Защита от «бомбы»: маленький файл, который распаковывается в гигапиксели.
MAX_PIXELS = 60_000_000
JPEG_QUALITY = 85
# Сколько файлов принимаем с одного хэша IP в час — отдельно от лимита на сами кейсы.
FILES_PER_HOUR = 30
# Место: ниже этого свободного остатка на диске загрузки не принимаем, база и бэкапы важнее.
MIN_FREE_BYTES = 3 * 1024**3
STORE_MAX_BYTES = 5 * 1024**3
FILES_DIR = "case-files"
NAME_RE = re.compile(r"^[0-9a-f]{24}\.(jpg|png|pdf)$")
MEDIA_TYPES = {"jpg": "image/jpeg", "png": "image/png", "pdf": "application/pdf"}

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class UploadError(ValueError):
    """Файл не принят; код — ключ текста ошибки на языке страницы."""

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
    """Тип по первым байтам, а не по имени и не по Content-Type от браузера."""
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
    """Открывает картинку, поворачивает по EXIF и сохраняет заново — уже без метаданных."""
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
    """Один файл формы → безопасная копия; тип, размер и целостность проверяются здесь."""
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
    """Хватит ли места: и свободного на диске, и в отведённой кейсам квоте."""
    root.mkdir(parents=True, exist_ok=True)
    free = shutil.disk_usage(root).free
    return free - incoming >= min_free and stored_bytes(root) + incoming <= quota


def save(root: Path, item: CleanFile) -> str:
    """Пишет файл под случайным именем (его нельзя угадать перебором) и возвращает имя."""
    root.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(12)}.{item.ext}"
    tmp = root / f".{name}.tmp"
    tmp.write_bytes(item.data)
    tmp.replace(root / name)
    return name


def path_of(root: Path, name: str) -> Path | None:
    """Путь к файлу по имени из базы; всё, что не похоже на наше имя, — None."""
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
    """Бэкап папки файлов к ночным бэкапам ботов: запускается тем же таймером, что архив AOD."""
    data_dir = Path(os.environ.get("DATA_DIR", "data"))
    backup_dir = os.environ.get("CASES_BACKUP_DIR")
    root = files_root(data_dir)
    if not backup_dir:
        print("CASES_BACKUP_DIR не задан — бэкап файлов кейсов пропущен")
        return 0
    root.mkdir(parents=True, exist_ok=True)
    # Файлы лежат плоско: добавление и удаление меняют время самой папки, и бэкап это заметит.
    out = backup(root, Path(backup_dir), datetime.now(UTC).date().isoformat(), files=[root])
    print(f"case files: {stored_bytes(root)} bytes → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
