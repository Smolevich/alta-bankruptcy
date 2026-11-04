"""Предложения материалов для сайта и канала: разбор формы, правки редактора и тексты страницы."""

from dataclasses import dataclass
from urllib.parse import urlsplit

TITLE_MAX = 200
TEXT_MAX = 20_000
URL_MAX = 1000
SOURCE_MAX = 500
SOURCES_MAX = 20
CONTACT_MAX = 200
COMMENT_MAX = 1000
TARGETS = ("site", "channel", "both")
# spam в публичный список не попадает: так убирают мусор, не теряя строку для лимита по IP.
STATUSES = ("new", "in_review", "needs_changes", "approved", "published", "rejected", "spam")
PUBLIC_STATUSES = STATUSES[:-1]
LANGS = ("ru", "en", "sr")
EDITOR_FIELDS = ("status", "review_url", "published_url", "comment")


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


def split_sources(raw: str) -> tuple[str, ...]:
    """Один источник — одна строка; пустые строки не считаются."""
    return tuple(line.strip() for line in raw.splitlines() if line.strip())


def parse_proposal(form: dict[str, str], lang: str = "ru") -> tuple[Proposal, list[str]]:
    """Собирает предложение из полей формы и возвращает его вместе со списком ошибок на языке страницы."""
    msg = TEXTS[lang]["errors"]
    title = " ".join((form.get("title") or "").split())
    text = (form.get("text") or "").strip()
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
    if len(text) > TEXT_MAX:
        errors.append(msg["text_long"].format(TEXT_MAX))
    if doc_url and (len(doc_url) > URL_MAX or not is_http_url(doc_url)):
        errors.append(msg["doc_url"])
    if not sources:
        errors.append(msg["sources"])
    elif len(sources) > SOURCES_MAX or any(len(s) > SOURCE_MAX for s in sources):
        errors.append(msg["sources_long"].format(SOURCES_MAX, SOURCE_MAX))
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
        "f_sources_hint": "Обязательно хотя бы один. Каждый с новой строки: ссылка или название документа",
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
            "sources_long": "Источников — не больше {}, каждый не длиннее {} знаков.",
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
        "f_sources_hint": "At least one. One per line: a link or the document's name",
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
            "sources_long": "At most {} sources, each up to {} characters.",
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
        "f_sources_hint": "Najmanje jedan. Svaki u novom redu: link ili naziv dokumenta",
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
            "sources_long": "Najviše {} izvora, svaki do {} znakova.",
            "target": "Izaberite gde: sajt, kanal ili oba.",
            "contact_long": "Kontakt je duži od {} znakova.",
        },
    },
}


def page_path(lang: str) -> str:
    return "/predlozheniya/" if lang == "ru" else f"/{lang}/predlozheniya/"


def site_home(lang: str) -> str:
    return "/" if lang == "ru" else f"/{lang}/"
