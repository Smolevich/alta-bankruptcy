"""Предложения материалов для сайта и канала: разбор формы, правки редактора и тексты страницы."""

import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from alta_feedback.richtext import plain_to_html, sanitize, visible_text

TITLE_MAX = 200
TEXT_MAX = 50_000
# Разметка поверх текста: лимит текста считается по видимым знакам, а HTML целиком — с запасом на теги.
HTML_MAX = 4 * TEXT_MAX
URL_MAX = 1000
# Источники — свободный текст в любом формате; ограничиваем только поле целиком.
SOURCES_TEXT_MAX = 20_000
# Подставляется, если автор не выбрал: «куда» решает редактор, автору выбор не обязателен.
DEFAULT_TARGET = "both"
CONTACT_MAX = 200
COMMENT_MAX = 1000
TARGETS = ("site", "channel", "both")
# spam в публичный список не попадает: так убирают мусор, не теряя строку для лимита по IP.
STATUSES = ("new", "in_review", "needs_changes", "approved", "published", "rejected", "spam")
PUBLIC_STATUSES = STATUSES[:-1]
LANGS = ("ru", "en", "sr")
EDITOR_FIELDS = ("status", "review_url", "published_url", "comment", "edited_text")


@dataclass(frozen=True)
class Proposal:
    title: str
    text: str
    doc_url: str
    sources: tuple[str, ...]
    target: str
    contact: str


def is_http_url(value: str) -> bool:
    parts = urlsplit(value)
    return parts.scheme in {"http", "https"} and bool(parts.netloc) and not any(c.isspace() for c in value)


# Конец ссылки: перед пробелом, концом строки или «,»/«;», за которыми идёт следующая ссылка.
LINK = re.compile(r"https?://\S+?(?=[,;]?(?:\s|$)|[,;]\s*https?://)")
SEPARATORS = " \t,;"


def split_line(line: str) -> list[str]:
    """Строку с несколькими ссылками (через запятую, «;» или пробел) режет на источники по ссылке;
    подпись перед ссылкой остаётся с ней, хвост после последней — с последней."""
    ends = [m.end() for m in LINK.finditer(line)]
    if len(ends) < 2:
        return [line]
    starts = [0, *ends[:-1]]
    ends[-1] = len(line)
    parts = (line[a:b].strip(SEPARATORS) for a, b in zip(starts, ends, strict=True))
    return [part for part in parts if part]


def split_sources(raw: str) -> tuple[str, ...]:
    """Источники из поля: каждый с новой строки или ссылки через запятую; пустые строки не считаются."""
    return tuple(part for line in raw.splitlines() if line.strip() for part in split_line(line.strip()))


def grouped(number: int) -> str:
    """50000 → «50 000»: так лимит читается в подсказках и ошибках на всех трёх языках."""
    return f"{number:,}".replace(",", " ")


def with_scheme(url: str) -> str:
    """Ссылку, вставленную без https:// (docs.google.com/…), дополняет схемой."""
    return url if not url or "://" in url or ":" in url.split("/")[0] else f"https://{url}"


def fallback_title(text_html: str, doc_url: str) -> str:
    """Заголовок, если автор его не написал: начало текста, иначе ссылка на документ."""
    words = " ".join(visible_text(text_html).split()) or doc_url
    return words if len(words) <= 80 else words[:80].rsplit(" ", 1)[0] + "…"


def clean_text(raw: str, is_html: bool) -> str:
    """Текст из редактора (HTML) или из простого поля без JS → очищенный HTML; пустой — ""."""
    clean = sanitize(raw) if is_html else plain_to_html(raw.strip())
    return clean if visible_text(clean) else ""


def too_long(clean: str) -> bool:
    return len(visible_text(clean)) > TEXT_MAX or len(clean) > HTML_MAX


def display_html(item: dict) -> str:
    """Что показать как текст предложения: правка редактора, иначе текст автора; всегда очищенный HTML.

    Старые предложения хранят простой текст (text_format пустой)."""
    if item.get("edited_text"):
        return sanitize(item["edited_text"])
    if item.get("text_format") == "html":
        return sanitize(item.get("text") or "")
    return plain_to_html(item.get("text") or "")


def parse_proposal(form: dict[str, str], lang: str = "ru") -> tuple[Proposal, list[str]]:
    """Собирает предложение из полей формы и возвращает его вместе со списком ошибок на языке страницы."""
    msg = TEXTS[lang]["errors"]
    text = clean_text(form.get("text") or "", form.get("text_format") == "html")
    doc_url = with_scheme((form.get("doc_url") or "").strip())
    title = " ".join((form.get("title") or "").split()) or fallback_title(text, doc_url)
    raw_sources = form.get("sources") or ""
    target = (form.get("target") or "").strip()
    target = target if target in TARGETS else DEFAULT_TARGET
    contact = (form.get("contact") or "").strip()
    errors: list[str] = []
    if not text and not doc_url:
        errors.append(msg["body"])
    if too_long(text):
        errors.append(msg["text_long"].format(grouped(TEXT_MAX)))
    if doc_url and (len(doc_url) > URL_MAX or not is_http_url(doc_url)):
        errors.append(msg["doc_url"])
    if len(raw_sources) > SOURCES_TEXT_MAX:
        errors.append(msg["sources_long"].format(grouped(SOURCES_TEXT_MAX)))
    if len(contact) > CONTACT_MAX:
        errors.append(msg["contact_long"].format(CONTACT_MAX))
    return Proposal(title[:TITLE_MAX], text, doc_url, split_sources(raw_sources), target, contact), errors


def parse_editor_update(body: object) -> tuple[dict[str, str], str | None]:
    """Поля, которые меняет редактор; пустая строка стирает ссылку или комментарий. Вторым — ошибка."""
    if not isinstance(body, dict):
        return {}, "нужен JSON-объект"
    changes = {key: body[key] for key in EDITOR_FIELDS if key in body}
    if not changes:
        return {}, f"нужно хотя бы одно поле из {list(EDITOR_FIELDS)}"
    if any(not isinstance(value, str) for value in changes.values()):
        return {}, "значения — строки"
    changes = {key: value.strip() for key, value in changes.items()}
    if "status" in changes and changes["status"] not in STATUSES:
        return {}, f"status: одно из {list(STATUSES)}"
    for key in ("review_url", "published_url"):
        value = changes.get(key)
        if value and (len(value) > URL_MAX or not is_http_url(value)):
            return {}, f"{key}: нужна ссылка http(s)"
    if len(changes.get("comment", "")) > COMMENT_MAX:
        return {}, f"comment: не длиннее {COMMENT_MAX} знаков"
    if "edited_text" in changes:
        changes["edited_text"] = clean_text(changes["edited_text"], is_html=True)
        if too_long(changes["edited_text"]):
            return {}, f"edited_text: не длиннее {TEXT_MAX} знаков текста"
    return changes, None


TEXTS: dict[str, dict] = {
    "ru": {
        "html_lang": "ru",
        "title": "Предложить материал",
        "lead": "Для сайта alta.smolevich.com и канала @altabank_closed.",
        "how_title": "Как это работает",
        "how": [
            "Присылаете текст или ссылку на документ и источники, на которых он основан.",
            "Сверяем с первоисточниками и возвращаем документ с правками.",
            "После одобрения материал выходит на сайте и/или в канале @altabank_closed.",
        ],
        "rules": "Мнения публикуем только с пометкой «мнение». Цены адвокатов публично не сравниваем.",
        "f_title": "Заголовок",
        "f_title_hint": "Необязательно — если пусто, возьмём начало текста",
        "f_text": "Текст",
        "f_text_hint": "До {} знаков. Можно вместо текста дать ссылку на документ ниже",
        "f_doc_url": "Ссылка на документ",
        "f_doc_url_hint": "Google Docs или другой документ, открытый по ссылке. Нужен текст или ссылка",
        "f_sources": "Источники",
        "f_sources_hint": "Необязательно. Ссылки и названия документов — в любом виде, как удобно",
        "f_target": "Куда",
        "targets": {"site": "Сайт", "channel": "Канал", "both": "Сайт и канал"},
        "f_contact": "Имя или ник для связи",
        "f_contact_hint": "Необязательно. Не публикуется, нужно только если будет вопрос",
        "public_note": "Заголовок, текст, ссылка и источники видны всем в списке ниже. Имя и контакт — нет.",
        "trap": "Не заполняйте это поле",
        "submit": "Отправить",
        "sent": "Принято, номер {}. Статус будет меняться в списке ниже.",
        "list_title": "Все предложения",
        "empty": "Пока ничего нет.",
        "statuses": {
            "new": "Новое", "in_review": "На проверке", "needs_changes": "Нужны правки",
            "approved": "Одобрено", "published": "Опубликовано", "rejected": "Отклонено",
        },
        "show_text": "Текст предложения",
        "doc": "Документ",
        "sources": "Источники",
        "review": "Документ с правками",
        "published": "Публикация",
        "comment": "Редактор",
        "back": "← на сайт",
        "limit_title": "Слишком много предложений подряд",
        "limit": "С одного адреса принимаем не больше пяти предложений в час. Попробуйте позже.",
        "errors": {
            "body": "Добавьте текст или ссылку на документ.",
            "text_long": "Текст длиннее {} знаков — дайте его ссылкой на документ.",
            "doc_url": "Ссылка на документ не открывается — проверьте, что она вида https://…",
            "sources_long": (
                "В поле «Источники» больше {} знаков. "
                "Оставьте главные или перечислите их в документе по ссылке."
            ),
            "contact_long": "Контакт длиннее {} знаков.",
        },
    },
    "en": {
        "html_lang": "en",
        "title": "Suggest material",
        "lead": "For alta.smolevich.com and the @altabank_closed channel.",
        "how_title": "How it works",
        "how": [
            "Send a text or a link to a document, and the sources it is based on.",
            "We check it against the primary sources and return the document with edits.",
            "Once approved, it is published on the site and/or in the @altabank_closed channel.",
        ],
        "rules": (
            "Opinions are published only when marked as opinion. We do not compare lawyers' fees publicly."
        ),
        "f_title": "Title",
        "f_title_hint": "Optional — if empty, we use the start of the text",
        "f_text": "Text",
        "f_text_hint": "Up to {} characters. You can give a link to a document below instead",
        "f_doc_url": "Link to a document",
        "f_doc_url_hint": "Google Docs or another document open by link. A text or a link is needed",
        "f_sources": "Sources",
        "f_sources_hint": "Optional. Links and document names in any form you like",
        "f_target": "Where",
        "targets": {"site": "Site", "channel": "Channel", "both": "Site and channel"},
        "f_contact": "Name or handle for contact",
        "f_contact_hint": "Optional. Not published, only used if we have a question",
        "public_note": (
            "The title, text, link and sources are visible to everyone in the list below. "
            "Name and contact are not."
        ),
        "trap": "Leave this field empty",
        "submit": "Send",
        "sent": "Received, number {}. Its status will change in the list below.",
        "list_title": "All suggestions",
        "empty": "Nothing yet.",
        "statuses": {
            "new": "New", "in_review": "In review", "needs_changes": "Needs changes",
            "approved": "Approved", "published": "Published", "rejected": "Rejected",
        },
        "show_text": "Suggested text",
        "doc": "Document",
        "sources": "Sources",
        "review": "Document with edits",
        "published": "Publication",
        "comment": "Editor",
        "back": "← to the site",
        "limit_title": "Too many suggestions in a row",
        "limit": "We accept at most five suggestions an hour from one address. Please try later.",
        "errors": {
            "body": "Add a text or a link to a document.",
            "text_long": "The text is longer than {} characters — send it as a link to a document.",
            "doc_url": "The document link does not open — check that it looks like https://…",
            "sources_long": (
                "The Sources field is longer than {} characters. Keep the main ones or list them "
                "in the linked document."
            ),
            "contact_long": "The contact is longer than {} characters.",
        },
    },
    "sr": {
        "html_lang": "sr-Latn",
        "title": "Predložite materijal",
        "lead": "Za sajt alta.smolevich.com i kanal @altabank_closed.",
        "how_title": "Kako to funkcioniše",
        "how": [
            "Pošaljite tekst ili link ka dokumentu i izvore na kojima se zasniva.",
            "Proveravamo ga prema primarnim izvorima i vraćamo dokument sa izmenama.",
            "Posle odobrenja materijal izlazi na sajtu i/ili u kanalu @altabank_closed.",
        ],
        "rules": "Mišljenja objavljujemo samo uz oznaku „mišljenje“. Cene advokata javno ne upoređujemo.",
        "f_title": "Naslov",
        "f_title_hint": "Nije obavezno — ako je prazno, uzećemo početak teksta",
        "f_text": "Tekst",
        "f_text_hint": "Do {} znakova. Umesto teksta možete dati link ka dokumentu ispod",
        "f_doc_url": "Link ka dokumentu",
        "f_doc_url_hint": "Google Docs ili drugi dokument otvoren po linku. Potreban je tekst ili link",
        "f_sources": "Izvori",
        "f_sources_hint": "Nije obavezno. Linkovi i nazivi dokumenata — u bilo kom obliku",
        "f_target": "Gde",
        "targets": {"site": "Sajt", "channel": "Kanal", "both": "Sajt i kanal"},
        "f_contact": "Ime ili nadimak za kontakt",
        "f_contact_hint": "Nije obavezno. Ne objavljuje se, samo ako budemo imali pitanje",
        "public_note": "Naslov, tekst, link i izvori su svima vidljivi na listi ispod. Ime i kontakt nisu.",
        "trap": "Ne popunjavajte ovo polje",
        "submit": "Pošalji",
        "sent": "Primljeno, broj {}. Status će se menjati na listi ispod.",
        "list_title": "Svi predlozi",
        "empty": "Još ništa.",
        "statuses": {
            "new": "Novo", "in_review": "U proveri", "needs_changes": "Potrebne izmene",
            "approved": "Odobreno", "published": "Objavljeno", "rejected": "Odbijeno",
        },
        "show_text": "Tekst predloga",
        "doc": "Dokument",
        "sources": "Izvori",
        "review": "Dokument sa izmenama",
        "published": "Objava",
        "comment": "Urednik",
        "back": "← na sajt",
        "limit_title": "Previše predloga zaredom",
        "limit": "Sa jedne adrese primamo najviše pet predloga na sat. Pokušajte kasnije.",
        "errors": {
            "body": "Dodajte tekst ili link ka dokumentu.",
            "text_long": "Tekst je duži od {} znakova — pošaljite ga kao link ka dokumentu.",
            "doc_url": "Link ka dokumentu se ne otvara — proverite da li je oblika https://…",
            "sources_long": (
                "Polje „Izvori“ ima više od {} znakova. Ostavite glavne ili ih navedite u dokumentu po linku."
            ),
            "contact_long": "Kontakt je duži od {} znakova.",
        },
    },
}


def page_path(lang: str) -> str:
    return "/predlozheniya/" if lang == "ru" else f"/{lang}/predlozheniya/"


def site_home(lang: str) -> str:
    return "/" if lang == "ru" else f"/{lang}/"
