"""Формы и админка для страницы про ALTA; админ-API — по токену, админка предложений — и через Access."""

import hmac
import json
import os
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from jinja2 import Environment, PackageLoader, select_autoescape
from markupsafe import Markup
from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    PlainTextResponse,
    RedirectResponse,
    Response,
)
from starlette.routing import Mount, Route

from alta_feedback import casebook, proposals, uploads
from alta_feedback.accounts import (
    ACCOUNT_STATUSES,
    ACCOUNT_TYPES,
    BANKS,
    CITIES,
    COMMENT_MAX,
    DOCUMENTS,
    FREE_TEXT_MAX,
    RESIDENCIES,
    RESULTS,
    labels,
    match_label,
    parse_account_form,
)
from alta_feedback.aod_archive import archive_root, load_manifest
from alta_feedback.bank_forms import catalog, codes_by_name, for_page
from alta_feedback.branches import BRANCH_MAX, NOT_SURE, branch_options, city_key, directory
from alta_feedback.cases import CASES, VNZH, case_banks, criteria, criteria_checked, parse_case_filter
from alta_feedback.cf_access import HEADER as ACCESS_HEADER
from alta_feedback.cf_access import AccessConfig, AccessKeys, admin_email, config_from_env
from alta_feedback.nbs import ASSETS, METRICS, SOURCE_URL, snapshot
from alta_feedback.pow import CHALLENGE_TTL, Challenge, create_challenge, derive_key, verify_payload
from alta_feedback.site import (
    DEFAULT_SITE_DIR,
    REVALIDATE,
    SITE_CSP,
    ArchiveFiles,
    SiteFiles,
    index_file,
)
from alta_feedback.stats import (
    PAGE_SIZE,
    AnswerFilter,
    account_stats,
    answer_cards,
    answer_page,
    hide_rare_branches,
    parse_cursor,
    parse_filter,
    shown_before,
)
from alta_feedback.store import Store
from alta_feedback.validate import (
    STATUSES,
    TEXT_MAX,
    TITLE_MAX,
    UA_MAX,
    clean_section_id,
    clip,
    hash_ip,
    is_bot,
    parse_form,
)

BODY_MAX = 16_384
# Кириллица в urlencoded — до 6 байт на знак (текст и источники), разметка редактора — до 3 байт.
PROPOSAL_BODY_MAX = 6 * (proposals.TEXT_MAX + proposals.SOURCES_TEXT_MAX) + 3 * proposals.HTML_MAX + 65_536
PROPOSALS_SHOWN = 300
RATE_LIMIT = 5
RATE_WINDOW = timedelta(hours=1)
# Сколько держим хэш IP и браузер: лимиту хватает часа, остальное — чтобы разобрать волну спама.
TRACE_TTL = timedelta(days=30)
ADMIN_PAGE_MAX = 500
PUBLIC_ACCOUNTS_MAX = 2000
LOCAL_TZ = ZoneInfo("Europe/Belgrade")
STATIC_DIR = Path(__file__).parent / "static"
SCRIPTS = frozenset({
    "branch.js", "combo.js", "filters.js", "pdfview.js", "pow.js", "proposals-admin.js", "richtext.js",
    "voice.js",
})
# Перебор запускает отметка «Я не робот»; среднее число попыток — половина, на Mac ~0,4 с, на телефоне 1–3 с.
POW_MAX_NUMBER = 200_000
POW_FAILED = "Не прошла проверка от ботов. Подождите пару секунд и отправьте ещё раз."
DEFAULT_RETURN_URL = "https://alta.smolevich.com"

# Счётчик посещений Cloudflare Web Analytics: единственный разрешённый чужой скрипт и адрес отправки данных.
CF_SCRIPT = "https://static.cloudflareinsights.com"
CF_CONNECT = "https://cloudflareinsights.com"

# Своих скриптов на странице нет; стили только встроенные.
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        f"default-src 'none'; script-src {CF_SCRIPT}; connect-src {CF_CONNECT}; style-src 'unsafe-inline'; "
        "img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}

# Страница отчёта о счёте грузит только свои скрипты: списки с поиском и микрофон;
# connect-src — только за новой задачей, когда старая протухла, пока форма была открыта.
ACCOUNT_PAGE_HEADERS = {
    "Content-Security-Policy": (
        f"default-src 'none'; script-src 'self' {CF_SCRIPT}; connect-src 'self' {CF_CONNECT}; "
        "style-src 'unsafe-inline'; img-src 'self' data:; "
        "form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    ),
    "Permissions-Policy": "microphone=(self)",
}

# Сводке нужны свои скрипты (фильтры и просмотр PDF; в сеть они не ходят) и встроенный просмотр
# бланков банков со своего адреса: Chrome показывает PDF в <object> как фрейм, поэтому нужны и object-src,
# и frame-src; сам PDF разрешает показывать себя только своим страницам.
STATS_PAGE_HEADERS = {
    "Content-Security-Policy": SECURITY_HEADERS["Content-Security-Policy"].replace(
        f"script-src {CF_SCRIPT};", f"script-src 'self' {CF_SCRIPT}; object-src 'self'; frame-src 'self';"
    ),
}

# Страница предложений — служебная для рабочей группы: в поиск не попадает и ссылкам вес не передаёт.
NOINDEX = {"X-Robots-Tag": "noindex, nofollow"}
# Форме предложения нужен свой скрипт редактора (static/richtext.js); форме кейса — проверка от ботов
# (static/pow.js), которая за новой задачей ходит на свой же адрес.
PROPOSALS_PAGE_HEADERS = {
    **NOINDEX,
    "Content-Security-Policy": SECURITY_HEADERS["Content-Security-Policy"].replace(
        f"script-src {CF_SCRIPT}; connect-src {CF_CONNECT};",
        f"script-src 'self' {CF_SCRIPT}; connect-src 'self' {CF_CONNECT};",
    ),
}
# Админке нужен свой скрипт и запросы к /admin/proposals со своего адреса; вход — Cloudflare Access.
PROPOSALS_ADMIN_HEADERS = {
    **NOINDEX,
    "Content-Security-Policy": (
        "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; "
        "img-src 'self' data: blob:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"
    ),
}
# Файлы кейсов: картинка показывается как есть, PDF только скачивается; sandbox — на случай,
# если браузер всё же попробует исполнить что-то внутри.
CASE_FILE_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
}
CASE_BODY_MAX = uploads.TOTAL_MAX + 2 * 1024 * 1024
CASES_SHOWN = 500

templates = Environment(
    loader=PackageLoader("alta_feedback", "templates"),
    autoescape=select_autoescape(["html"]),
)


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        declared = request.headers.get("content-length", "0")
        if declared.isdigit() and int(declared) > body_limit(request.url.path):
            response: Response = PlainTextResponse("Слишком большой запрос", status_code=413)
        else:
            response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response


def body_limit(path: str) -> int:
    if path in CASE_PATHS:
        return CASE_BODY_MAX
    big = path in PROPOSAL_PATHS or path.startswith("/admin/proposals/")
    return PROPOSAL_BODY_MAX if big else BODY_MAX


def client_ip(request: Request) -> str:
    """cloudflared ставит CF-Connecting-IP; uvicorn слушает только петлю, поэтому заголовку верим."""
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "")


def render(
    name: str, status_code: int = 200, headers: dict[str, str] | None = None, **context
) -> HTMLResponse:
    context.setdefault("return_url", os.environ.get("RETURN_URL", DEFAULT_RETURN_URL))
    context.setdefault("text_max", TEXT_MAX)
    html = templates.get_template(name).render(**context)
    return HTMLResponse(html, status_code=status_code, headers=headers)


def ip_hash_of(request: Request) -> str:
    return hash_ip(client_ip(request), request.app.state.ip_salt)


async def home(request: Request) -> Response:
    """«/» — справочник; со ссылкой «Предложить правку» (?s=…, ?t=…) и без справочника — форма."""
    index = index_file(request.app.state.site_dir)
    if index is None or request.query_params.keys() & {"s", "t"}:
        return await form_page(request)
    return FileResponse(
        index, headers={"Content-Security-Policy": SITE_CSP, "Cache-Control": REVALIDATE}
    )


async def form_page(request: Request) -> HTMLResponse:
    params = request.query_params
    return render(
        "form.html",
        section_id=clean_section_id(params.get("s")),
        section_title=clip(params.get("t"), TITLE_MAX),
        values={},
        errors=[],
    )


async def submit(request: Request) -> Response:
    form = {key: str(value) for key, value in (await request.form()).items()}
    if is_bot(form):
        return RedirectResponse("/spasibo", status_code=303)
    suggestion, errors = parse_form(form)
    if errors:
        return render(
            "form.html", status_code=400, section_id=suggestion.section_id,
            section_title=suggestion.section_title, values=form, errors=errors,
        )
    store: Store = request.app.state.store
    now = datetime.now(UTC)
    ip_hash = ip_hash_of(request)
    if store.recent_from(ip_hash, now, RATE_WINDOW) >= RATE_LIMIT:
        return render("limit.html", status_code=429)
    user_agent = request.headers.get("user-agent", "")[:UA_MAX]
    store.add(suggestion, ip_hash, user_agent, now)
    store.forget_old_traces(now - TRACE_TTL)
    query = urlencode({"s": suggestion.section_id}) if suggestion.section_id else ""
    return RedirectResponse(f"/spasibo?{query}" if query else "/spasibo", status_code=303)


async def thanks(request: Request) -> HTMLResponse:
    return render("thanks.html", section_id=clean_section_id(request.query_params.get("s")))


def bearer_ok(request: Request) -> bool:
    expected = request.app.state.admin_token
    given = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    return bool(expected) and hmac.compare_digest(given.encode(), expected.encode())


async def access_ok(request: Request) -> bool:
    """Вход через Cloudflare Access: подписанный токен команды с email из списка админов."""
    config, token = request.app.state.access, request.headers.get(ACCESS_HEADER, "")
    if config is None or not token:
        return False
    keys = request.app.state.access_keys
    email = await run_in_threadpool(admin_email, token, config, keys, keys.clock())
    return email is not None


async def authorized(request: Request, via_access: bool = False) -> bool:
    """Bearer-токен — для мониторов и терминала; Access — только там, где он стоит перед сервисом."""
    return bearer_ok(request) or (via_access and await access_ok(request))


def parse_since(raw: str | None) -> str | None:
    """since — ISO-время в UTC; пусто значит «с начала»."""
    if not raw:
        return "0000"
    try:
        moment = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def admin_list(
    table: str, statuses: frozenset[str], via_access: bool = False,
    decorate: Callable[[dict], dict] = lambda item: item,
) -> Callable[[Request], Awaitable[JSONResponse]]:
    async def handler(request: Request) -> JSONResponse:
        if not await authorized(request, via_access):
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        since = parse_since(request.query_params.get("since"))
        if since is None:
            return JSONResponse({"error": "since: нужен ISO, напр. 2026-10-31T12:00:00Z"}, status_code=400)
        status = request.query_params.get("status") or None
        if status and status not in statuses:
            return JSONResponse({"error": f"status: одно из {sorted(statuses)}"}, status_code=400)
        items = request.app.state.store.since(since, status, ADMIN_PAGE_MAX, table=table)
        return JSONResponse({"count": len(items), "items": [decorate(item) for item in items]})

    return handler


def admin_set_status(table: str, statuses: frozenset[str]) -> Callable[[Request], Awaitable[JSONResponse]]:
    async def handler(request: Request) -> JSONResponse:
        if not await authorized(request):
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        try:
            status = (await request.json()).get("status")
        except ValueError:
            status = None
        if status not in statuses:
            return JSONResponse({"error": f"status: одно из {sorted(statuses)}"}, status_code=400)
        found = request.app.state.store.set_status(int(request.path_params["id"]), status, table=table)
        if not found:
            return JSONResponse({"error": "not found"}, status_code=404)
        return JSONResponse({"id": request.path_params["id"], "status": status})

    return handler


def account_context(request: Request, values: dict, errors: list[str]) -> dict:
    return {
        "banks": BANKS, "cities": CITIES, "account_types": ACCOUNT_TYPES, "results": RESULTS,
        "residencies": RESIDENCIES, "documents": DOCUMENTS, "comment_max": COMMENT_MAX,
        "free_text_max": FREE_TEXT_MAX, "values": values, "errors": errors,
        "branch_max": BRANCH_MAX, "not_sure": NOT_SURE,
        "pow": new_challenge(request), "pow_ttl": int(CHALLENGE_TTL.total_seconds()),
    }


def new_challenge(request: Request) -> Challenge:
    state = request.app.state
    return create_challenge(state.pow_key, datetime.now(UTC), state.pow_max_number)


async def account_challenge(request: Request) -> JSONResponse:
    challenge = new_challenge(request)
    return JSONResponse({
        "algorithm": challenge.algorithm, "challenge": challenge.challenge, "salt": challenge.salt,
        "signature": challenge.signature, "maxnumber": challenge.maxnumber,
        "ttl": int(CHALLENGE_TTL.total_seconds()),
    })


def account_form(request: Request, values: dict, errors: list[str], status_code: int = 200) -> HTMLResponse:
    return render(
        "account.html", status_code=status_code, headers=ACCOUNT_PAGE_HEADERS,
        **account_context(request, values, errors),
    )


def today_local() -> datetime:
    return datetime.now(LOCAL_TZ)


async def account_page(request: Request) -> HTMLResponse:
    values = {"visit_date": today_local().date().isoformat(), "docs": []}
    return account_form(request, values, [])


async def account_submit(request: Request) -> Response:
    raw = await request.form()
    form = {key: str(value) for key, value in raw.items()}
    if is_bot(form):
        return RedirectResponse("/account/spasibo", status_code=303)
    # Без JS документы приходят одной строкой через запятую, со скриптом — тегами.
    docs = [str(value) for value in raw.getlist("docs")] + form.get("docs_text", "").split(",")
    report, errors = parse_account_form(form, docs, today_local().date(), directory())
    now = datetime.now(UTC)
    solved = verify_payload(request.app.state.pow_key, form.get("altcha", ""), now)
    if solved is None:
        errors.append(POW_FAILED)
    if errors:
        values = {**form, "docs": [doc.strip() for doc in docs if doc.strip()]}
        return account_form(request, values, errors, status_code=400)
    store: Store = request.app.state.store
    ip_hash = ip_hash_of(request)
    if store.recent_from(ip_hash, now, RATE_WINDOW, table="accounts") >= RATE_LIMIT:
        return render("limit.html", status_code=429)
    if not store.claim_challenge(solved.challenge, solved.expires_at, now):
        return account_form(request, {**form, "docs": docs}, [POW_FAILED], status_code=400)
    store.add_account(report, ip_hash, request.headers.get("user-agent", "")[:UA_MAX], now)
    store.forget_old_traces(now - TRACE_TTL)
    return RedirectResponse("/account/spasibo", status_code=303)


async def account_branches(request: Request) -> JSONResponse:
    """Подсказки для поля «Отделение» по введённым банку и городу; банк не из списка — только «Не помню»."""
    params = request.query_params
    city_text = params.get("city", "")
    bank_code = match_label(params.get("bank", ""), BANKS)
    city = city_key(match_label(city_text, CITIES), city_text)
    branches = directory().get(bank_code or "", ())
    return JSONResponse({"branches": branch_options(branches, city)})


async def account_thanks(request: Request) -> HTMLResponse:
    return render("account_thanks.html")


def stats_url(
    answer_filter: AnswerFilter, before: str | None = None, extra: dict[str, str] | None = None
) -> str:
    query = urlencode({**answer_filter.query(), **(extra or {}), **({"before": before} if before else {})})
    return f"/account/stats?{query}#answers" if query else "/account/stats#answers"


async def account_stats_page(request: Request) -> HTMLResponse:
    """Сводка и все ответы по фильтру; ответы листаются по 20 курсором before."""
    store: Store = request.app.state.store
    answer_filter = parse_filter(request.query_params)
    before = parse_cursor(request.query_params.get("before"))
    counts = store.public_branch_counts()
    items = store.public_accounts(answer_filter, with_person=True)
    case_filter = parse_case_filter(request.query_params)
    keep = case_filter.query()
    stats = account_stats(items, counts)
    page = answer_page(store.public_accounts(answer_filter, before, PAGE_SIZE + 1), PAGE_SIZE)
    first = shown_before(items, before) + 1
    has_any = bool(stats.total or store.public_accounts(limit=1))
    nbs = snapshot()
    reported, others = nbs.listing([tally.name for tally in stats.banks])
    forms = catalog()
    return render(
        "stats.html", headers=STATS_PAGE_HEADERS, stats=stats, results=RESULTS, nbs=nbs,
        metrics=(ASSETS, *METRICS),
        nbs_reported=reported, nbs_others=others, nbs_source=SOURCE_URL,
        banks=BANKS, cities=CITIES, filter=answer_filter, has_any=has_any,
        entries=answer_cards(page.items, counts), first=first, last=first + len(page.items) - 1,
        next_url=stats_url(answer_filter, page.next_cursor, keep) if page.next_cursor else None,
        start_url=stats_url(answer_filter, extra=keep) if before else None, page_size=PAGE_SIZE,
        case_filter=case_filter, cases=CASES, vnzh_options=VNZH,
        case_cards=case_banks(items, case_filter, criteria()), criteria_checked=criteria_checked(),
        bank_forms=for_page(forms, answer_filter.bank), forms_codes=codes_by_name(forms),
    )


def parse_limit(raw: str | None) -> int:
    """Размер страницы JSON: 1…PUBLIC_ACCOUNTS_MAX; не число — как раньше, максимум."""
    if not (raw or "").isdigit() or int(raw) < 1:
        return PUBLIC_ACCOUNTS_MAX
    return min(int(raw), PUBLIC_ACCOUNTS_MAX)


async def public_accounts(request: Request) -> JSONResponse:
    """Без limit и cursor ответ прежний; с ними — ещё next_cursor для следующей страницы."""
    store: Store = request.app.state.store
    params = request.query_params
    limit = parse_limit(params.get("limit"))
    rows = store.public_accounts(before=parse_cursor(params.get("cursor")), limit=limit + 1)
    page = answer_page(rows, limit)
    items = hide_rare_branches(page.items, store.public_branch_counts())
    body: dict = {"count": len(items), "items": items, "labels": labels()}
    if params.keys() & {"limit", "cursor"}:
        body["next_cursor"] = page.next_cursor
    return JSONResponse(body)


def case_path(lang: str) -> str:
    return f"{proposals.page_path(lang)}case"


PROPOSAL_PATHS = frozenset(proposals.page_path(lang) for lang in proposals.LANGS)
CASE_PATHS = frozenset(case_path(lang) for lang in proposals.LANGS)
MB = 1024 * 1024


def number_param(request: Request, name: str) -> int | None:
    value = request.query_params.get(name, "")
    return int(value) if value.isdigit() else None


def proposals_page(
    request: Request, lang: str, values: dict, errors: list[str], status_code: int = 200, kind: str = "",
) -> HTMLResponse:
    """Одна страница, две формы: «Материал» (по умолчанию) и «Мой кейс» (?type=case)."""
    kind = kind or ("case" if request.query_params.get("type") == "case" else "material")
    path = proposals.page_path(lang)
    return render(
        "proposals.html", status_code=status_code, headers=PROPOSALS_PAGE_HEADERS, t=proposals.TEXTS[lang],
        c=casebook.TEXTS[lang], kind=kind, case_action=case_path(lang), material_url=path,
        case_url=f"{path}?type=case", categories=casebook.CATEGORIES,
        html_lang=proposals.TEXTS[lang]["html_lang"], lang=lang, action=path,
        home=proposals.site_home(lang), targets=proposals.TARGETS, values=values, errors=errors,
        sent=number_param(request, "sent"), case_sent=number_param(request, "case_sent"),
        items=[with_html(item) for item in request.app.state.store.public_proposals(PROPOSALS_SHOWN)],
        title_max=proposals.TITLE_MAX, body_max=proposals.TEXT_MAX, url_max=proposals.URL_MAX,
        contact_max=proposals.CONTACT_MAX, sources_text_max=proposals.SOURCES_TEXT_MAX,
        default_target=proposals.DEFAULT_TARGET, grouped=proposals.grouped,
        summary_max=casebook.SUMMARY_MAX, filed_max=casebook.FILED_MAX, result_max=casebook.RESULT_MAX,
        files_max=uploads.MAX_FILES, file_mb=uploads.FILE_MAX // MB, total_mb=uploads.TOTAL_MAX // MB,
        today=today_local().date().isoformat(),
        pow=new_challenge(request) if kind == "case" else None, pow_ttl=int(CHALLENGE_TTL.total_seconds()),
    )


def with_html(item: dict) -> dict:
    """Текст для показа — только через очистку; Markup, чтобы шаблон не экранировал теги второй раз."""
    return {**item, "html": Markup(proposals.display_html(item))}


def with_original_html(item: dict) -> dict:
    """Админке — текст автора отдельно от правки редактора."""
    return {**item, "text_html": proposals.display_html({**item, "edited_text": None})}


def proposals_view(lang: str) -> Callable[[Request], Awaitable[HTMLResponse]]:
    async def handler(request: Request) -> HTMLResponse:
        return proposals_page(request, lang, {}, [])

    return handler


def proposals_submit(lang: str) -> Callable[[Request], Awaitable[Response]]:
    async def handler(request: Request) -> Response:
        form = {key: str(value) for key, value in (await request.form()).items()}
        path = proposals.page_path(lang)
        if is_bot(form):
            return RedirectResponse(path, status_code=303)
        proposal, errors = proposals.parse_proposal(form, lang)
        if errors:
            # В редактор возвращаем уже очищенный HTML, а не то, что пришло.
            values = {**form, "text": proposal.text} if form.get("text_format") == "html" else form
            return proposals_page(request, lang, values, errors, status_code=400)
        store: Store = request.app.state.store
        now = datetime.now(UTC)
        ip_hash = ip_hash_of(request)
        if store.recent_from(ip_hash, now, RATE_WINDOW, table="proposals") >= RATE_LIMIT:
            text = proposals.TEXTS[lang]
            return render(
                "limit.html", status_code=429, headers=NOINDEX, html_lang=text["html_lang"],
                limit_title=text["limit_title"], limit_text=text["limit"],
                return_url=path, back=text["back"],
            )
        item_id = store.add_proposal(proposal, ip_hash, request.headers.get("user-agent", "")[:UA_MAX], now)
        store.forget_old_traces(now - TRACE_TTL)
        return RedirectResponse(f"{path}?sent={item_id}#p{item_id}", status_code=303)

    return handler


type RawFile = tuple[str, bytes]


async def read_uploads(raw_files: list[UploadFile], msg: dict[str, str]) -> tuple[list[RawFile], list[str]]:
    """Сырые байты выбранных файлов; пустые поля пропускаем. Читаем не больше лимита + 1 байт."""
    picked = [f for f in raw_files if f.filename]
    if len(picked) > uploads.MAX_FILES:
        return [], [msg["files_many"].format(uploads.MAX_FILES)]
    out: list[RawFile] = []
    for item in picked:
        name = clip(item.filename, 80)
        data = await item.read(uploads.FILE_MAX + 1)
        if len(data) > uploads.FILE_MAX:
            return [], [msg["file_big"].format(name, uploads.FILE_MAX // MB)]
        if data:
            out.append((name, data))
    if sum(len(data) for _, data in out) > uploads.TOTAL_MAX:
        return [], [msg["files_total"].format(uploads.TOTAL_MAX // MB)]
    return out, []


def clean_uploads(files: list[RawFile], msg: dict[str, str]) -> tuple[list[uploads.CleanFile], list[str]]:
    cleaned: list[uploads.CleanFile] = []
    for name, data in files:
        try:
            cleaned.append(uploads.clean_upload(data))
        except uploads.UploadError as e:
            return [], [msg[e.code].format(name, uploads.FILE_MAX // MB)]
    return cleaned, []


def case_form(request: Request, lang: str, values: dict, errors: list[str], status_code: int) -> HTMLResponse:
    return proposals_page(request, lang, values, errors, status_code=status_code, kind="case")


def case_submit(lang: str) -> Callable[[Request], Awaitable[Response]]:
    async def handler(request: Request) -> Response:
        # Без Content-Length размер тела заранее не проверить, а файлы большие — такие запросы не берём.
        if not request.headers.get("content-length", "").isdigit():
            return PlainTextResponse("Нужен Content-Length", status_code=411)
        page = case_path(lang).removesuffix("case")
        msg = casebook.TEXTS[lang]["errors"]
        raw = await request.form(max_files=uploads.MAX_FILES + 1, max_fields=40)
        form = {key: value for key, value in raw.items() if isinstance(value, str)}
        if is_bot(form):
            return RedirectResponse(f"{page}?type=case", status_code=303)
        state, now = request.app.state, datetime.now(UTC)
        report, errors = casebook.parse_case(form, today_local().date(), lang)
        solved = verify_payload(state.pow_key, form.get("altcha", ""), now)
        if solved is None:
            errors.append(msg["pow"])
        picked = [value for value in raw.getlist("files") if isinstance(value, UploadFile)]
        files, file_errors = await read_uploads(picked, msg)
        if errors or file_errors:
            return case_form(request, lang, form, errors + file_errors, 400)
        store: Store = state.store
        ip_hash = ip_hash_of(request)
        if store.recent_from(ip_hash, now, RATE_WINDOW, table="case_stories") >= RATE_LIMIT:
            text = proposals.TEXTS[lang]
            return render(
                "limit.html", status_code=429, headers=NOINDEX, html_lang=text["html_lang"],
                limit_title=text["limit_title"], limit_text=text["limit"], return_url=page, back=text["back"],
            )
        if files and store.files_from(ip_hash, now, RATE_WINDOW) + len(files) > uploads.FILES_PER_HOUR:
            return case_form(request, lang, form, [msg["files_limit"].format(uploads.FILES_PER_HOUR)], 429)
        cleaned, file_errors = await run_in_threadpool(clean_uploads, files, msg)
        if file_errors:
            return case_form(request, lang, form, file_errors, 400)
        root = uploads.files_root(state.data_dir)
        if cleaned and not uploads.has_room(root, sum(len(c.data) for c in cleaned)):
            return case_form(request, lang, form, [msg["no_room"]], 507)
        if not store.claim_challenge(solved.challenge, solved.expires_at, now):
            return case_form(request, lang, form, [msg["pow"]], 400)
        names = [uploads.save(root, item) for item in cleaned]
        try:
            rows = [(name, item.kind, len(item.data)) for name, item in zip(names, cleaned, strict=True)]
            user_agent = request.headers.get("user-agent", "")[:UA_MAX]
            case_id = store.add_case(report, rows, ip_hash, user_agent, now)
        except Exception:
            uploads.remove(root, names)
            raise
        store.forget_old_traces(now - TRACE_TTL)
        return RedirectResponse(f"{page}?type=case&case_sent={case_id}", status_code=303)

    return handler


def case_file_response(request: Request, name: str, cache: str) -> Response:
    path = uploads.path_of(uploads.files_root(request.app.state.data_dir), name)
    if path is None:
        return PlainTextResponse("not found", status_code=404)
    disposition = "attachment" if name.endswith(".pdf") else "inline"
    headers = {
        **CASE_FILE_HEADERS, "Cache-Control": cache,
        "Content-Disposition": f'{disposition}; filename="{name}"',
    }
    return FileResponse(path, media_type=uploads.media_type(name), headers=headers)


async def public_case_file(request: Request) -> Response:
    """Файл кейса наружу — только если кейс принят, опубликован и его файлы разрешены к показу."""
    name = request.path_params["name"]
    case = request.app.state.store.case_of_file(name)
    if case is None or not casebook.files_public(case):
        return PlainTextResponse("not found", status_code=404)
    # no-cache: снятый с публикации файл не должен остаться в кэше Cloudflare.
    return case_file_response(request, name, "no-cache")


async def admin_case_file(request: Request) -> Response:
    if not await authorized(request, via_access=True):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return case_file_response(request, request.path_params["name"], "no-store")


async def public_cases(request: Request) -> JSONResponse:
    """Лента «Кейсы» на сайте берёт отсюда: принятые и опубликованные, без контакта и служебных полей."""
    store: Store = request.app.state.store
    items = store.public_cases(CASES_SHOWN)
    files = store.case_files([item["id"] for item in items]) if items else {}
    cards = [casebook.public_card(item, files.get(item["id"], [])) for item in items]
    return JSONResponse(
        {"count": len(cards), "items": cards, "labels": {"category": casebook.category_labels()}},
        headers={"Cache-Control": "no-cache"},
    )


async def admin_cases(request: Request) -> JSONResponse:
    handler = admin_list("case_stories", frozenset(casebook.STATUSES), via_access=True)
    response = await handler(request)
    if response.status_code != 200:
        return response
    body = json.loads(response.body)
    ids = [item["id"] for item in body["items"]]
    files = request.app.state.store.case_files(ids) if ids else {}
    for item in body["items"]:
        item["files"] = files.get(item["id"], [])
    return JSONResponse(body)


async def admin_update_case(request: Request) -> JSONResponse:
    if not await authorized(request, via_access=True):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    try:
        body = await request.json()
    except ValueError:
        body = None
    changes, error = casebook.parse_case_update(body)
    if error:
        return JSONResponse({"error": error}, status_code=400)
    item_id = int(request.path_params["id"])
    if not request.app.state.store.update_case(item_id, changes, datetime.now(UTC)):
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse({"id": item_id, **changes})


async def admin_delete_case(request: Request) -> JSONResponse:
    if not await authorized(request, via_access=True):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    item_id = int(request.path_params["id"])
    names = request.app.state.store.delete_case(item_id)
    if names is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    uploads.remove(uploads.files_root(request.app.state.data_dir), names)
    return JSONResponse({"id": item_id, "deleted": True})


# Служебные и JSON-маршруты: человек по ним не ходит, ссылок со слешем не бывает.
SLASHLESS_PREFIXES = ("/admin", "/api", "/static", "/healthz", "/account/challenge", "/account/branches")


def to_canonical(path: str) -> Callable[[Request], Awaitable[Response]]:
    """Вариант со слешем на конце → канонический адрес; query сохраняем, ссылки в чатах бывают с ней."""
    async def handler(request: Request) -> Response:
        query = request.url.query
        return RedirectResponse(f"{path}?{query}" if query else path, status_code=308)

    return handler


def slash_twins(routes: list[Route]) -> list[Route]:
    """Для каждой GET-страницы без слеша ставит редирект с адреса со слешем (иначе справочник отдаёт 404)."""
    return [
        Route(f"{route.path}/", to_canonical(route.path), methods=["GET"])
        for route in routes
        if route.path != "/" and "{" not in route.path and not route.path.endswith("/")
        and "GET" in (route.methods or ())
        and not route.path.startswith(SLASHLESS_PREFIXES)
    ]


def to_slash(path: str) -> Callable[[Request], Awaitable[Response]]:
    async def handler(request: Request) -> Response:
        return RedirectResponse(path, status_code=308)

    return handler


async def proposals_admin_page(request: Request) -> HTMLResponse:
    """Оболочка без данных: предложения скрипт берёт из /admin/proposals, вход — Cloudflare Access."""
    return render(
        "proposals_admin.html", headers=PROPOSALS_ADMIN_HEADERS, t=proposals.TEXTS["ru"],
        c=casebook.TEXTS["ru"], case_statuses=casebook.STATUSES, case_status_labels=casebook.ADMIN_STATUSES,
        statuses=proposals.STATUSES, targets=proposals.TARGETS, url_max=proposals.URL_MAX,
        comment_max=proposals.COMMENT_MAX, access_on=request.app.state.access is not None,
    )


async def admin_update_proposal(request: Request) -> JSONResponse:
    if not await authorized(request, via_access=True):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    try:
        body = await request.json()
    except ValueError:
        body = None
    changes, error = proposals.parse_editor_update(body)
    if error:
        return JSONResponse({"error": error}, status_code=400)
    item_id = int(request.path_params["id"])
    if not request.app.state.store.update_proposal(item_id, changes, datetime.now(UTC)):
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse({"id": item_id, **changes})


async def admin_delete_proposal(request: Request) -> JSONResponse:
    if not await authorized(request, via_access=True):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    item_id = int(request.path_params["id"])
    if not request.app.state.store.delete_proposal(item_id):
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse({"id": item_id, "deleted": True})


def proposal_routes() -> list[Route]:
    routes: list[Route] = []
    for lang in proposals.LANGS:
        path = proposals.page_path(lang)
        routes += [
            Route(path, proposals_view(lang), methods=["GET"]),
            Route(path, proposals_submit(lang), methods=["POST"]),
            Route(case_path(lang), case_submit(lang), methods=["POST"]),
            Route(path.rstrip("/"), to_slash(path), methods=["GET"]),
        ]
    return routes + [
        Route("/predlozheniya/admin/", proposals_admin_page, methods=["GET"]),
        Route("/predlozheniya/admin", to_slash("/predlozheniya/admin/"), methods=["GET"]),
        Route(
            "/admin/proposals", admin_list(
                "proposals", frozenset(proposals.STATUSES), via_access=True, decorate=with_original_html,
            ),
            methods=["GET"],
        ),
        Route("/admin/proposals/{id:int}", admin_update_proposal, methods=["POST"]),
        Route("/admin/proposals/{id:int}", admin_delete_proposal, methods=["DELETE"]),
        # Кейсы — под тем же префиксом /admin/proposals, который закрывает Cloudflare Access.
        Route("/admin/proposals/cases", admin_cases, methods=["GET"]),
        Route("/admin/proposals/cases/{id:int}", admin_update_case, methods=["POST"]),
        Route("/admin/proposals/cases/{id:int}", admin_delete_case, methods=["DELETE"]),
        Route("/admin/proposals/cases/files/{name}", admin_case_file, methods=["GET"]),
        Route("/api/cases/public", public_cases, methods=["GET"]),
        Route("/api/cases/files/{name}", public_case_file, methods=["GET"]),
    ]


async def static_script(request: Request) -> Response:
    name = request.path_params["name"]
    if name not in SCRIPTS:
        return PlainTextResponse("not found", status_code=404)
    body = (STATIC_DIR / name).read_text(encoding="utf-8")
    return Response(body, media_type="text/javascript; charset=utf-8", headers={"Cache-Control": "no-cache"})


async def healthz(request: Request) -> PlainTextResponse:
    return PlainTextResponse("ok")


def create_app(
    data_dir: Path | None = None,
    admin_token: str | None = None,
    ip_salt: str | None = None,
    pow_max_number: int = POW_MAX_NUMBER,
    site_dir: Path | None = None,
    access: AccessConfig | None = None,
    access_keys: AccessKeys | None = None,
) -> Starlette:
    site = site_dir or Path(os.environ.get("SITE_DIR", DEFAULT_SITE_DIR))
    data = data_dir or Path(os.environ.get("DATA_DIR", "data"))
    aod_public = archive_root(data) / "public"
    page_routes = [
        Route("/", home, methods=["GET"]),
        Route("/fix", form_page, methods=["GET"]),
        Route("/", submit, methods=["POST"]),
        Route("/spasibo", thanks, methods=["GET"]),
        Route("/healthz", healthz, methods=["GET"]),
        Route("/admin/suggestions", admin_list("suggestions", STATUSES), methods=["GET"]),
        Route(
            "/admin/suggestions/{id:int}/status",
            admin_set_status("suggestions", STATUSES), methods=["POST"],
        ),
        Route("/account", account_page, methods=["GET"]),
        Route("/account", account_submit, methods=["POST"]),
        Route("/account/challenge", account_challenge, methods=["GET"]),
        Route("/account/branches", account_branches, methods=["GET"]),
        Route("/account/spasibo", account_thanks, methods=["GET"]),
        Route("/account/stats", account_stats_page, methods=["GET"]),
        Route("/static/{name}", static_script, methods=["GET"]),
        Route("/api/accounts/public", public_accounts, methods=["GET"]),
        Route("/admin/accounts", admin_list("accounts", ACCOUNT_STATUSES), methods=["GET"]),
        Route(
            "/admin/accounts/{id:int}/status",
            admin_set_status("accounts", ACCOUNT_STATUSES), methods=["POST"],
        ),
    ]
    app = Starlette(
        routes=[
            *page_routes,
            *slash_twins(page_routes),
            *proposal_routes(),
            Mount("/docs/aod", app=ArchiveFiles(aod_public, load_manifest()), name="aod"),
            # Последним: всё, чего нет среди маршрутов выше, ищем в собранном справочнике.
            Mount("/", app=SiteFiles(site), name="site"),
        ],
        middleware=[Middleware(SecurityHeaders)],
    )
    app.state.store = Store(data / "feedback.db")
    app.state.admin_token = admin_token if admin_token is not None else os.environ.get("ADMIN_TOKEN", "")
    app.state.ip_salt = ip_salt if ip_salt is not None else os.environ.get("IP_SALT", "")
    if not app.state.ip_salt:
        raise RuntimeError("IP_SALT не задан: без соли хэш IP подбирается перебором")
    app.state.pow_key = derive_key(app.state.ip_salt)
    app.state.pow_max_number = pow_max_number
    app.state.site_dir = site
    app.state.data_dir = data
    app.state.access = access or config_from_env(os.environ)
    app.state.access_keys = access_keys or AccessKeys(app.state.access.certs_url if app.state.access else "")
    return app
