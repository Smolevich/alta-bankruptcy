"""Картотека кейсов вкладчиков: разбор формы «Мой кейс», правки админа и публичная лента.

Кейс — личная история: что человек подавал и куда, чем кончилось. Открытие счетов сюда не
относится — для них отдельная форма /account со статистикой.
"""

from dataclasses import dataclass
from datetime import date

from alta_feedback.accounts import scrub_pii
from alta_feedback.proposals import is_http_url, split_sources

CATEGORIES = ("property", "credit", "joint", "business", "other")
STATUSES = ("new", "accepted", "rejected", "test", "spam")
ADMIN_STATUSES = {
    "new": "новый", "accepted": "принят", "rejected": "отклонён", "test": "тест", "spam": "спам",
}
SUMMARY_MAX = 2000
FILED_MAX = 1000
RESULT_MAX = 1000
URL_MAX = 1000
SOURCE_MAX = 500
SOURCES_MAX = 10
CONTACT_MAX = 200
COMMENT_MAX = 1000
OLDEST = date(2000, 1, 1)
FLAGS = ("published", "files_published")
EDITOR_FIELDS = ("status", "comment", "own_url", *FLAGS)


@dataclass(frozen=True)
class CaseReport:
    category: str
    summary: str
    filed: str
    result: str
    event_date: str
    sources: tuple[str, ...]
    own_url: str
    contact: str


def scrubbed(raw: str | None) -> str:
    """Свободный текст кейса: обрезаем пробелы и прячем похожее на телефон, email, счёт, JMBG."""
    return scrub_pii((raw or "").strip())


def parse_date(raw: str, today: date) -> str | None:
    try:
        value = date.fromisoformat(raw.strip())
    except ValueError:
        return None
    return value.isoformat() if OLDEST <= value <= today else None


def parse_case(form: dict[str, str], today: date, lang: str = "ru") -> tuple[CaseReport, list[str]]:
    """Кейс из полей формы и ошибки на языке страницы. Источники необязательны — это личный опыт."""
    msg = TEXTS[lang]["errors"]
    category = (form.get("category") or "").strip()
    summary = scrubbed(form.get("summary"))
    filed = scrubbed(form.get("filed"))
    result = scrubbed(form.get("result"))
    event_date = parse_date(form.get("event_date") or "", today)
    sources = tuple(scrub_pii(s) for s in split_sources(form.get("sources") or ""))
    own_url = (form.get("own_url") or "").strip()
    contact = (form.get("contact") or "").strip()
    errors: list[str] = []
    if category not in CATEGORIES:
        errors.append(msg["category"])
    if not summary:
        errors.append(msg["summary"])
    for value, limit in ((summary, SUMMARY_MAX), (filed, FILED_MAX), (result, RESULT_MAX)):
        if len(value) > limit:
            errors.append(msg["too_long"].format(limit))
            break
    if not result:
        errors.append(msg["result"])
    if event_date is None:
        errors.append(msg["date"])
    if len(sources) > SOURCES_MAX or any(len(s) > SOURCE_MAX for s in sources):
        errors.append(msg["sources_long"].format(SOURCES_MAX, SOURCE_MAX))
    if own_url and (len(own_url) > URL_MAX or not is_http_url(own_url)):
        errors.append(msg["own_url"])
    if len(contact) > CONTACT_MAX:
        errors.append(msg["contact_long"].format(CONTACT_MAX))
    report = CaseReport(category, summary, filed, result, event_date or "", sources, own_url, contact)
    return report, errors


def parse_case_update(body: object) -> tuple[dict[str, str | int], str | None]:
    """Поля, которые меняет админ: статус, комментарий, ссылка автора и флаги публикации."""
    if not isinstance(body, dict):
        return {}, "нужен JSON-объект"
    changes = {key: body[key] for key in EDITOR_FIELDS if key in body}
    if not changes:
        return {}, f"нужно хотя бы одно поле из {list(EDITOR_FIELDS)}"
    for key in FLAGS:
        if key in changes and not isinstance(changes[key], bool):
            return {}, f"{key}: true или false"
    if any(not isinstance(changes[key], str) for key in changes if key not in FLAGS):
        return {}, "status, comment, own_url — строки"
    clean: dict[str, str | int] = {
        key: int(value) if key in FLAGS else value.strip() for key, value in changes.items()
    }
    if "status" in clean and clean["status"] not in STATUSES:
        return {}, f"status: одно из {list(STATUSES)}"
    own_url = clean.get("own_url")
    if own_url and (len(str(own_url)) > URL_MAX or not is_http_url(str(own_url))):
        return {}, "own_url: нужна ссылка http(s)"
    if len(str(clean.get("comment", ""))) > COMMENT_MAX:
        return {}, f"comment: не длиннее {COMMENT_MAX} знаков"
    return clean, None


def is_public(item: dict) -> bool:
    return item.get("status") == "accepted" and bool(item.get("published"))


def files_public(item: dict) -> bool:
    return is_public(item) and bool(item.get("files_published"))


def public_card(item: dict, files: list[dict]) -> dict:
    """Карточка ленты: только то, что видно всем; контакт, хэш IP и комментарий админа не попадают."""
    source_url = next((s for s in item["sources"] if is_http_url(s)), "")
    shown = files if files_public(item) else []
    return {
        "id": item["id"], "category": item["category"], "summary": item["summary"], "filed": item["filed"],
        "result": item["result"], "date": item["event_date"], "source_url": source_url,
        "own_url": item["own_url"],
        "files": [{"url": f"/api/cases/files/{f['name']}", "kind": f["kind"]} for f in shown],
    }


def category_labels() -> dict[str, dict[str, str]]:
    return {lang: TEXTS[lang]["categories"] for lang in TEXTS}


TEXTS: dict[str, dict] = {
    "ru": {
        "tab_material": "Материал",
        "tab_case": "Мой кейс",
        "case_title": "Поделиться своим кейсом",
        "case_lead": (
            "Что вы подавали по своим деньгам в ALTA и чем кончилось — сделка, кредит, общий счёт, ИП. "
            "После проверки кейс появится в ленте «Кейсы» на сайте."
        ),
        "account_note": "Про открытие счёта в другом банке — сюда:",
        "account_form": "форма",
        "account_stats": "статистика",
        "f_category": "О чём кейс",
        "categories": {
            "property": "Недвижимость или сделка (отмена, налог)",
            "credit": "Кредит или ипотека",
            "joint": "Семейный или совместный счёт",
            "business": "ИП или фирма",
            "other": "Другое",
        },
        "f_summary": "Суть",
        "f_summary_hint": "Что случилось, до {} знаков. Без имён, номеров счетов и телефонов",
        "f_filed": "Что подавали и куда",
        "f_filed_hint": "Заявление, жалоба, иск: в банк, AOD, суд, налоговую",
        "f_result": "Результат",
        "f_result_hint": "Чем кончилось или что сейчас: ответ, отказ, ждём",
        "f_date": "Дата",
        "f_date_hint": "Когда подавали или когда пришёл ответ",
        "f_sources": "Источники",
        "f_sources_hint": "Необязательно. Ссылка на закон, решение, ответ ведомства — каждый с новой строки",
        "f_own_url": "Ссылка на свою страницу",
        "f_own_url_hint": "Необязательно. Google Docs, Notion или свой сайт — проверим перед публикацией",
        "f_files": "Фото или PDF документов",
        "f_files_hint": "До {} файлов: JPG, PNG, HEIC или PDF, каждый до {} МБ, всего до {} МБ",
        "files_warning": (
            "Закройте личные данные: имя, JMBG, номер счёта, адрес, подпись. "
            "Файлы не публикуются, пока их не проверит модератор."
        ),
        "files_again": "Если была ошибка — выберите файлы заново: браузер их не сохраняет.",
        "f_contact": "Имя или ник для связи",
        "f_contact_hint": "Необязательно. Не публикуется",
        "case_submit": "Отправить кейс",
        "case_sent": "Кейс принят, номер {}. В ленте он появится после проверки.",
        "case_public_note": "Публикуем только после проверки модератором. Контакт не публикуется.",
        "errors": {
            "category": "Выберите, о чём кейс.",
            "summary": "Опишите суть.",
            "result": "Напишите результат — даже если пока «ждём ответа».",
            "too_long": "Одно из полей длиннее {} знаков.",
            "date": "Укажите дату — не раньше 2000 года и не позже сегодняшней.",
            "sources_long": "Источников — не больше {}, каждый не длиннее {} знаков.",
            "own_url": "Ссылка на свою страницу должна начинаться с https://.",
            "contact_long": "Контакт длиннее {} знаков.",
            "files_many": "Не больше {} файлов.",
            "files_total": "Файлы вместе больше {} МБ.",
            "file_big": "Файл «{}» больше {} МБ.",
            "file_type": "Файл «{}» — не JPG, PNG, HEIC или PDF.",
            "broken": "Файл «{}» не открывается — возможно, он повреждён.",
            "files_limit": "С одного адреса — не больше {} файлов в час. Отправьте кейс без фото или позже.",
            "no_room": "Сейчас не можем принять файлы. Отправьте кейс без них — фото пришлёте позже.",
            "pow": "Не прошла проверка от ботов. Подождите пару секунд и отправьте ещё раз.",
        },
        "pow": {
            "label": "Я не робот", "note": "Проверка<br>от ботов",
            "working": "Проверяем…", "done": "Проверено",
            "nojs": "Для проверки от ботов нужен JavaScript.",
            "expired": "Проверка устарела — отметьте «Я не робот» ещё раз.",
            "unsupported": "Браузер не умеет проверку — откройте страницу в Chrome или Safari.",
            "failed": "Проверка не прошла — отметьте ещё раз или обновите страницу.",
            "waiting": "Секунду, проверка ещё идёт — отправим сразу после неё.",
            "required": "Отметьте «Я не робот» — без этого форма не отправится.",
        },
    },
    "en": {
        "tab_material": "Material",
        "tab_case": "My case",
        "case_title": "Share your case",
        "case_lead": (
            "What you filed about your money at ALTA and how it ended — a sale, a loan, a joint account, "
            "a sole trader. Once checked, the case appears in the «Cases» feed on the site."
        ),
        "account_note": "About opening an account at another bank — go here:",
        "account_form": "form",
        "account_stats": "statistics",
        "f_category": "What the case is about",
        "categories": {
            "property": "Real estate or a deal (cancellation, tax)",
            "credit": "Loan or mortgage",
            "joint": "Family or joint account",
            "business": "Sole trader or company",
            "other": "Other",
        },
        "f_summary": "What happened",
        "f_summary_hint": "Up to {} characters. No names, account or phone numbers",
        "f_filed": "What you filed and where",
        "f_filed_hint": "Request, complaint, lawsuit: to the bank, AOD, court, tax office",
        "f_result": "Result",
        "f_result_hint": "How it ended or where it stands: answer, refusal, waiting",
        "f_date": "Date",
        "f_date_hint": "When you filed or when the answer came",
        "f_sources": "Sources",
        "f_sources_hint": "Optional. A law, a decision, an authority's reply — one per line",
        "f_own_url": "Link to your own page",
        "f_own_url_hint": "Optional. Google Docs, Notion or your site — checked before publishing",
        "f_files": "Photos or PDFs of documents",
        "f_files_hint": "Up to {} files: JPG, PNG, HEIC or PDF, each up to {} MB, {} MB in total",
        "files_warning": (
            "Cover personal data: name, JMBG, account number, address, signature. "
            "Files are not published until a moderator checks them."
        ),
        "files_again": "If there was an error, choose the files again: the browser does not keep them.",
        "f_contact": "Name or handle for contact",
        "f_contact_hint": "Optional. Not published",
        "case_submit": "Send the case",
        "case_sent": "Case received, number {}. It appears in the feed after a check.",
        "case_public_note": "Published only after a moderator's check. The contact is never published.",
        "errors": {
            "category": "Choose what the case is about.",
            "summary": "Describe what happened.",
            "result": "Write the result — even if it is «waiting for an answer».",
            "too_long": "One of the fields is longer than {} characters.",
            "date": "Give a date — not before 2000 and not after today.",
            "sources_long": "At most {} sources, each up to {} characters.",
            "own_url": "The link to your page must start with https://.",
            "contact_long": "The contact is longer than {} characters.",
            "files_many": "At most {} files.",
            "files_total": "The files together are larger than {} MB.",
            "file_big": "The file «{}» is larger than {} MB.",
            "file_type": "The file «{}» is not a JPG, PNG, HEIC or PDF.",
            "broken": "The file «{}» does not open — it may be damaged.",
            "files_limit": (
                "At most {} files an hour from one address. Send the case without photos or later."
            ),
            "no_room": "We cannot take files right now. Send the case without them and the photos later.",
            "pow": "The bot check failed. Wait a couple of seconds and send again.",
        },
        "pow": {
            "label": "I'm not a robot", "note": "Bot<br>check", "working": "Checking…", "done": "Checked",
            "nojs": "The bot check needs JavaScript.",
            "expired": "The check expired — tick «I'm not a robot» again.",
            "unsupported": "This browser cannot run the check — open the page in Chrome or Safari.",
            "failed": "The check failed — tick again or reload the page.",
            "waiting": "One moment, the check is still running — we will send right after it.",
            "required": "Tick «I'm not a robot» — the form will not send without it.",
        },
    },
    "sr": {
        "tab_material": "Materijal",
        "tab_case": "Moj slučaj",
        "case_title": "Podelite svoj slučaj",
        "case_lead": (
            "Šta ste podneli u vezi sa svojim novcem u ALTA banci i kako se završilo — prodaja, kredit, "
            "zajednički račun, preduzetnik. Posle provere slučaj se pojavljuje u listi „Slučajevi“ na sajtu."
        ),
        "account_note": "O otvaranju računa u drugoj banci — ovde:",
        "account_form": "obrazac",
        "account_stats": "statistika",
        "f_category": "O čemu je slučaj",
        "categories": {
            "property": "Nekretnina ili ugovor (raskid, porez)",
            "credit": "Kredit ili hipoteka",
            "joint": "Porodični ili zajednički račun",
            "business": "Preduzetnik ili firma",
            "other": "Drugo",
        },
        "f_summary": "Suština",
        "f_summary_hint": "Do {} znakova. Bez imena, brojeva računa i telefona",
        "f_filed": "Šta ste podneli i kome",
        "f_filed_hint": "Zahtev, prigovor, tužba: banci, AOD-u, sudu, poreskoj upravi",
        "f_result": "Rezultat",
        "f_result_hint": "Kako se završilo ili gde je sada: odgovor, odbijanje, čekamo",
        "f_date": "Datum",
        "f_date_hint": "Kada ste podneli ili kada je stigao odgovor",
        "f_sources": "Izvori",
        "f_sources_hint": "Nije obavezno. Zakon, rešenje, odgovor organa — svaki u novom redu",
        "f_own_url": "Link ka vašoj stranici",
        "f_own_url_hint": "Nije obavezno. Google Docs, Notion ili vaš sajt — proveravamo pre objave",
        "f_files": "Fotografije ili PDF dokumenata",
        "f_files_hint": "Do {} fajlova: JPG, PNG, HEIC ili PDF, svaki do {} MB, ukupno do {} MB",
        "files_warning": (
            "Prekrijte lične podatke: ime, JMBG, broj računa, adresu, potpis. "
            "Fajlovi se ne objavljuju dok ih moderator ne proveri."
        ),
        "files_again": "Ako je bilo greške, izaberite fajlove ponovo: pregledač ih ne čuva.",
        "f_contact": "Ime ili nadimak za kontakt",
        "f_contact_hint": "Nije obavezno. Ne objavljuje se",
        "case_submit": "Pošalji slučaj",
        "case_sent": "Slučaj je primljen, broj {}. U listi se pojavljuje posle provere.",
        "case_public_note": "Objavljujemo tek posle provere moderatora. Kontakt se ne objavljuje.",
        "errors": {
            "category": "Izaberite o čemu je slučaj.",
            "summary": "Opišite suštinu.",
            "result": "Napišite rezultat — čak i ako je „čekamo odgovor“.",
            "too_long": "Jedno od polja je duže od {} znakova.",
            "date": "Navedite datum — ne pre 2000. i ne posle današnjeg.",
            "sources_long": "Najviše {} izvora, svaki do {} znakova.",
            "own_url": "Link ka vašoj stranici mora da počinje sa https://.",
            "contact_long": "Kontakt je duži od {} znakova.",
            "files_many": "Najviše {} fajlova.",
            "files_total": "Fajlovi su zajedno veći od {} MB.",
            "file_big": "Fajl „{}“ je veći od {} MB.",
            "file_type": "Fajl „{}“ nije JPG, PNG, HEIC ili PDF.",
            "broken": "Fajl „{}“ ne može da se otvori — možda je oštećen.",
            "files_limit": (
                "Sa jedne adrese najviše {} fajlova na sat. Pošaljite slučaj bez fotografija ili kasnije."
            ),
            "no_room": (
                "Trenutno ne možemo da primimo fajlove. Pošaljite slučaj bez njih, a fotografije kasnije."
            ),
            "pow": "Provera protiv botova nije prošla. Sačekajte par sekundi i pošaljite ponovo.",
        },
        "pow": {
            "label": "Nisam robot", "note": "Provera<br>od botova",
            "working": "Proveravamo…", "done": "Provereno",
            "nojs": "Za proveru od botova potreban je JavaScript.",
            "expired": "Provera je istekla — ponovo označite „Nisam robot“.",
            "unsupported": "Pregledač ne podržava proveru — otvorite stranicu u Chrome-u ili Safariju.",
            "failed": "Provera nije prošla — označite ponovo ili osvežite stranicu.",
            "waiting": "Sekund, provera još traje — poslaćemo odmah posle nje.",
            "required": "Označite „Nisam robot“ — bez toga obrazac se ne šalje.",
        },
    },
}
