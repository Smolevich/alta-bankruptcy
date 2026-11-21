"""Static alta-bankruptcy reference at "/": the folder built by CI is served as is."""

from pathlib import Path

from starlette.exceptions import HTTPException
from starlette.responses import PlainTextResponse, RedirectResponse, Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from alta_feedback.aod_archive import ArchivedPdf

DEFAULT_SITE_DIR = Path("/var/www/alta-bankruptcy")

# Starlight inlines scripts and styles, and Pagefind search loads wasm from the same
# origin; everything else is blocked. The service forms are not under this CSP: they have their own.
SITE_CSP = (
    "default-src 'none'; "
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://static.cloudflareinsights.com; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; "
    # Branch map: MapLibre draws in its own module worker from our own origin.
    "worker-src 'self' blob:; "
    "connect-src 'self' https://cloudflareinsights.com; "
    "form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
)
# Embedded PDF viewer on the documents page: the page allows object and frame from its own origin,
# and the PDF itself allows only a page from the same origin to show it.
# aod.rs stays in the list for the ArchiveFiles fallback: until a copy exists, the viewer falls back to
# the original.
EMBED = "'self' https://www.aod.rs"
SITE_CSP = SITE_CSP.replace("form-action", f"object-src {EMBED}; frame-src {EMBED}; form-action")
PDF_CSP = SITE_CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'")
# Names under /_astro/ contain a content hash; everything else (including the search index) changes
# without a name change, and Cloudflare must not keep it in cache.
IMMUTABLE = "public, max-age=31536000, immutable"
REVALIDATE = "no-cache"
# A copy of an AOD document under its own name does not change (a new version of the original lands beside
# it), but
# the manifest can be pointed at another one, hence a day, not immutable.
ARCHIVE_CACHE = "public, max-age=86400"
CONDITIONAL_HEADERS = {b"if-none-match", b"if-modified-since"}


def without_conditionals_on_range(scope: Scope) -> Scope:
    """Starlette answers a Range with If-None-Match by 304 instead of 206, and pmtiles fails
    for a returning visitor ("HTTP Byte Serving"): always send the file slice in full (RFC 9110
    allows ignoring conditional headers)."""
    headers = scope.get("headers", [])
    if not any(name == b"range" for name, _ in headers):
        return scope
    kept = [(name, value) for name, value in headers if name not in CONDITIONAL_HEADERS]
    return {**scope, "headers": kept}


class SiteFiles(StaticFiles):
    def __init__(self, directory: Path) -> None:
        super().__init__(directory=directory, html=True, check_dir=False)

    async def check_config(self) -> None:
        # No folder before the first rollout, and that is not an error: the service answers 404, not 500.
        return

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, without_conditionals_on_range(scope))
        if response.status_code == 307:
            # Starlette sends 307 for a folder address without a slash; this is a permanent rule, and
            # Google should
            # move signals to the slash variant rather than treat it as temporary.
            response.status_code = 308
        response.headers["Content-Security-Policy"] = PDF_CSP if path.endswith(".pdf") else SITE_CSP
        cache = IMMUTABLE if path.startswith("_astro/") and response.status_code == 200 else REVALIDATE
        response.headers["Cache-Control"] = cache
        return response


class ArchiveFiles(StaticFiles):
    """Public PDF copies from the AOD site (/docs/aod/<name>), see aod_archive.

    Serves only what the manifest marks public: closed ones are in a neighboring folder
    this handler does not look at.
    """

    def __init__(self, directory: Path, manifest: dict[str, ArchivedPdf]) -> None:
        super().__init__(directory=directory, check_dir=False)
        self.public = {name: item for name, item in manifest.items() if item.public}

    async def check_config(self) -> None:
        return

    async def get_response(self, path: str, scope: Scope) -> Response:
        item = self.public.get(path)
        if item is None:
            return PlainTextResponse("not found", status_code=404)
        try:
            response = await super().get_response(path, scope)
        except HTTPException as e:
            if e.status_code != 404:
                raise
            # No copy yet (the first check run did not pass): show the original.
            return RedirectResponse(item.url, status_code=307)
        response.headers["Content-Security-Policy"] = PDF_CSP
        response.headers["Cache-Control"] = ARCHIVE_CACHE
        return response


def index_file(site_dir: Path) -> Path | None:
    index = site_dir / "index.html"
    return index if index.is_file() else None
