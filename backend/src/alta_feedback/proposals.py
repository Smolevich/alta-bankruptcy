"""Предложения материалов для сайта и канала: разбор формы, правки редактора и тексты страницы."""

import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from alta_feedback.richtext import plain_to_html, sanitize, visible_text

TITLE_MAX = 200
TEXT_MAX = 20_000
# Разметка поверх текста: лимит текста считается по видимым знакам, а HTML целиком — с запасом на теги.
HTML_MAX = 4 * TEXT_MAX
URL_MAX = 1000
SOURCE_MAX = 1000
SOURCES_MAX = 40
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


def source_errors(sources: tuple[str, ...], msg: dict[str, str]) -> list[str]:
    """Что не так со списком источников — с номером и началом источника, который не прошёл."""
    if not sources:
        return [msg["sources"]]
    errors = [msg["sources_many"].format(len(sources), SOURCES_MAX)] if len(sources) > SOURCES_MAX else []
    for number, source in enumerate(sources, 1):
        if len(source) > SOURCE_MAX:
            errors.append(msg["source_long"].format(number, len(source), SOURCE_MAX, source[:60]))
    return errors


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
    title = " ".join((form.get("title") or "").split())
    text = clean_text(form.get("text") or "", form.get("text_format") == "html")
    doc_url = (form.get("doc_url") or "").strip()
    sources = split_sources(form.get("sources") or "")
    target = (form.get("target") or "").strip()
    contact = (form.get("contact") or "").strip()
    errors: list[str] = []
    if not title:
        errors.append(msg["title"])
    elif len(title) > TITLE_MAX:
        errors.append(msg["title_long"].format(TITLE_MAX))
    if not text and not doc_url:
        errors.append(msg["body"])
    if too_long(text):
        errors.append(msg["text_long"].format(TEXT_MAX))
    if doc_url and (len(doc_url) > URL_MAX or not is_http_url(doc_url)):
        errors.append(msg["doc_url"])
    errors += source_errors(sources, msg)
    if target not in TARGETS:
        errors.append(msg["target"])
    if len(contact) > CONTACT_MAX:
        errors.append(msg["contact_long"].format(CONTACT_MAX))
    return Proposal(title, text, doc_url, sources, target, contact), errors


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
        "f_text": "Текст",
        "f_text_hint": "До {} знаков. Или оставьте пустым и дайте ссылку ниже",
        "f_doc_url": "Ссылка на документ",
        "f_doc_url_hint": "Google Docs или другой документ, открытый по ссылке",
        "f_sources": "Источники",
        "f_sources_hint": (
            "Обязательно хотя бы один. Каждый с новой строки (ссылки можно через запятую): "
            "ссылка или название документа"
        ),
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
            "title": "Напишите заголовок.",
            "title_long": "Заголовок длиннее {} знаков.",
            "body": "Добавьте текст или ссылку на документ.",
            "text_long": "Текст длиннее {} знаков — дайте его ссылкой на документ.",
            "doc_url": "Ссылка на документ должна начинаться с https://.",
            "sources": "Укажите хотя бы один источник.",
            "sources_many": "Источников получилось {}, а можно не больше {}. Оставьте главные.",
            "source_long": (
                "Источник №{} длиннее, чем можно: {} знаков при лимите {} («{}…»). "
                "Если это несколько источников, поставьте каждый с новой строки."
            ),
            "target": "Выберите, куда: сайт, канал или оба.",
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
        "f_text": "Text",
        "f_text_hint": "Up to {} characters. Or leave empty and give a link below",
        "f_doc_url": "Link to a document",
        "f_doc_url_hint": "Google Docs or another document open by link",
        "f_sources": "Sources",
        "f_sources_hint": (
            "At least one. One per line (links may be comma-separated): a link or the document's name"
        ),
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
            "title": "Add a title.",
            "title_long": "The title is longer than {} characters.",
            "body": "Add a text or a link to a document.",
            "text_long": "The text is longer than {} characters — send it as a link to a document.",
            "doc_url": "The document link must start with https://.",
            "sources": "Give at least one source.",
            "sources_many": "That is {} sources; the limit is {}. Keep the main ones.",
            "source_long": (
                "Source #{} is too long: {} characters, the limit is {} (\u201c{}…\u201d). "
                "If it is several sources, put each on its own line."
            ),
            "target": "Choose where: site, channel or both.",
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
        "f_text": "Tekst",
        "f_text_hint": "Do {} znakova. Ili ostavite prazno i dajte link ispod",
        "f_doc_url": "Link ka dokumentu",
        "f_doc_url_hint": "Google Docs ili drugi dokument otvoren po linku",
        "f_sources": "Izvori",
        "f_sources_hint": (
            "Najmanje jedan. Svaki u novom redu (linkovi mogu i sa zarezom): link ili naziv dokumenta"
        ),
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
            "title": "Napišite naslov.",
            "title_long": "Naslov je duži od {} znakova.",
            "body": "Dodajte tekst ili link ka dokumentu.",
            "text_long": "Tekst je duži od {} znakova — pošaljite ga kao link ka dokumentu.",
            "doc_url": "Link ka dokumentu mora da počinje sa https://.",
            "sources": "Navedite najmanje jedan izvor.",
            "sources_many": "Izvora je {}, a dozvoljeno je najviše {}. Ostavite glavne.",
            "source_long": (
                "Izvor br. {} je predugačak: {} znakova, a dozvoljeno je {} („{}…“). "
                "Ako je to više izvora, stavite svaki u novi red."
            ),
            "target": "Izaberite gde: sajt, kanal ili oba.",
            "contact_long": "Kontakt je duži od {} znakova.",
        },
    },
}


def page_path(lang: str) -> str:
    return "/predlozheniya/" if lang == "ru" else f"/{lang}/predlozheniya/"


def site_home(lang: str) -> str:
    return "/" if lang == "ru" else f"/{lang}/"
