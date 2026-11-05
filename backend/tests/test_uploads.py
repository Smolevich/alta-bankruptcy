import io

import pytest
from PIL import Image

from alta_feedback import uploads
from alta_feedback.uploads import UploadError, clean_upload, has_room, path_of, save

GPS_IFD = 0x8825


def jpeg_with_gps() -> bytes:
    image = Image.new("RGB", (40, 30), "navy")
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"
    exif.get_ifd(GPS_IFD)[2] = (44.0, 49.0, 0.0)
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def encoded(fmt: str, size: tuple[int, int] = (40, 30), mode: str = "RGB") -> bytes:
    out = io.BytesIO()
    Image.new(mode, size).save(out, format=fmt)
    return out.getvalue()


def opened(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def test_jpeg_loses_exif_with_location():
    assert not opened(clean_upload(jpeg_with_gps()).data).getexif()


def test_jpeg_tail_after_image_is_dropped():
    tail = b"<script>alert(1)</script>"
    assert tail not in clean_upload(jpeg_with_gps() + tail).data


def test_heic_becomes_jpeg():
    assert clean_upload(encoded("HEIF")).ext == "jpg"


def test_png_stays_png():
    assert opened(clean_upload(encoded("PNG")).data).format == "PNG"


def test_large_photo_is_scaled_down():
    image = opened(clean_upload(encoded("JPEG", (4000, 3000))).data)
    assert max(image.size) == uploads.MAX_SIDE


def test_type_comes_from_content_not_from_name():
    with pytest.raises(UploadError) as error:
        clean_upload(b"<html><script>alert(1)</script></html>")
    assert error.value.code == "file_type"


def test_jpeg_header_with_garbage_is_rejected():
    with pytest.raises(UploadError) as error:
        clean_upload(b"\xff\xd8\xff\xe0" + b"\x00" * 200)
    assert error.value.code == "broken"


def test_pixel_bomb_is_rejected():
    with pytest.raises(UploadError):
        clean_upload(encoded("PNG", (9000, 9000), "1"))


def test_file_over_limit_is_rejected():
    with pytest.raises(UploadError) as error:
        clean_upload(b"%PDF-1.7\n" + b"0" * uploads.FILE_MAX + b"%%EOF")
    assert error.value.code == "file_big"


def test_pdf_is_kept_as_pdf():
    assert clean_upload(b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n").ext == "pdf"


def test_truncated_pdf_is_rejected():
    with pytest.raises(UploadError):
        clean_upload(b"%PDF-1.7\n1 0 obj\n<<>>\n")


def test_saved_file_is_found_by_its_name(tmp_path):
    name = save(tmp_path, clean_upload(encoded("PNG")))
    assert path_of(tmp_path, name) == tmp_path / name


def test_path_outside_store_is_not_served(tmp_path):
    assert path_of(tmp_path, "../feedback.db") is None


def test_no_room_when_quota_is_used(tmp_path):
    save(tmp_path, clean_upload(encoded("PNG")))
    assert not has_room(tmp_path, 10, min_free=0, quota=20)


def test_room_when_quota_and_disk_allow(tmp_path):
    assert has_room(tmp_path, 10, min_free=0, quota=10_000)


def test_backup_of_case_files_is_written(tmp_path, monkeypatch):
    save(uploads.files_root(tmp_path), clean_upload(encoded("PNG")))
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("CASES_BACKUP_DIR", str(tmp_path / "bk"))
    uploads.main()
    assert len(list((tmp_path / "bk").glob("*.tar.gz"))) == 1
