"""SQLite-хранилище правок и отчётов об открытии счетов."""

import json
import sqlite3
from collections import Counter
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

from alta_feedback.accounts import AccountReport
from alta_feedback.casebook import CaseReport
from alta_feedback.proposals import PUBLIC_STATUSES, Proposal
from alta_feedback.queues import HIDDEN_STATUSES, QueueReport
from alta_feedback.stats import AnswerFilter
from alta_feedback.validate import Suggestion

SCHEMA = """
CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    section_id TEXT NOT NULL,
    section_title TEXT NOT NULL,
    text TEXT NOT NULL,
    source TEXT NOT NULL,
    contact TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    user_agent_short TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS suggestions_ip_time ON suggestions (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS suggestions_time ON suggestions (created_at);

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    bank TEXT NOT NULL,
    city TEXT NOT NULL,
    account_type TEXT NOT NULL,
    result TEXT NOT NULL,
    visit_date TEXT NOT NULL,
    residency TEXT NOT NULL,
    documents TEXT NOT NULL,
    comment TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    user_agent_short TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS accounts_ip_time ON accounts (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS accounts_time ON accounts (created_at);
CREATE INDEX IF NOT EXISTS accounts_status ON accounts (status);
CREATE INDEX IF NOT EXISTS accounts_public ON accounts (status, visit_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    doc_url TEXT NOT NULL,
    sources TEXT NOT NULL,
    target TEXT NOT NULL,
    contact TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    user_agent_short TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    review_url TEXT NOT NULL DEFAULT '',
    published_url TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL DEFAULT '',
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS proposals_ip_time ON proposals (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS proposals_time ON proposals (created_at);

CREATE TABLE IF NOT EXISTS case_stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    filed TEXT NOT NULL,
    result TEXT NOT NULL,
    event_date TEXT NOT NULL,
    sources TEXT NOT NULL,
    own_url TEXT NOT NULL,
    contact TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    user_agent_short TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    published INTEGER NOT NULL DEFAULT 0,
    files_published INTEGER NOT NULL DEFAULT 0,
    comment TEXT NOT NULL DEFAULT '',
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS case_stories_ip_time ON case_stories (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS case_stories_time ON case_stories (created_at);

CREATE TABLE IF NOT EXISTS case_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL REFERENCES case_stories (id),
    created_at TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    bytes INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS case_files_case ON case_files (case_id);

CREATE TABLE IF NOT EXISTS queue_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    state TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    ip_hash TEXT NOT NULL,
    user_agent_short TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS queue_reports_time ON queue_reports (created_at);
CREATE INDEX IF NOT EXISTS queue_reports_ip_time ON queue_reports (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS pow_used (
    challenge TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
);
"""

# Колонки, добавленные после запуска: (таблица, колонка, тип). Только nullable — старые строки получают NULL.
ADDED_COLUMNS = (
    ("accounts", "branch", "TEXT"),
    # html — text хранит очищенный HTML редактора; NULL — простой текст старых предложений.
    ("proposals", "text_format", "TEXT"),
    # Правка текста редактором перед публикацией; текст автора в text не меняется.
    ("proposals", "edited_text", "TEXT"),
)

COLUMNS = {
    "queue_reports": (
        "id", "created_at", "branch_id", "state", "comment", "ip_hash", "user_agent_short", "status",
    ),
    "suggestions": (
        "id", "created_at", "section_id", "section_title", "text",
        "source", "contact", "ip_hash", "user_agent_short", "status",
    ),
    "accounts": (
        "id", "created_at", "bank", "city", "account_type", "result", "visit_date",
        "residency", "documents", "comment", "ip_hash", "user_agent_short", "status", "branch",
    ),
    "proposals": (
        "id", "created_at", "title", "text", "doc_url", "sources", "target", "contact", "ip_hash",
        "user_agent_short", "status", "review_url", "published_url", "comment", "updated_at",
        "text_format", "edited_text",
    ),
    "case_stories": (
        "id", "created_at", "category", "summary", "filed", "result", "event_date", "sources", "own_url",
        "contact", "ip_hash", "user_agent_short", "status", "published", "files_published", "comment",
        "updated_at",
    ),
}
CASE_FILE_COLUMNS = ("case_id", "name", "kind", "bytes")
# Автор, его контакт и следы браузера в публичный список не попадают.
PUBLIC_PROPOSAL_COLUMNS = (
    "id", "created_at", "title", "text", "doc_url", "sources", "target", "status",
    "review_url", "published_url", "comment", "text_format", "edited_text",
)
PUBLIC_ACCOUNT_COLUMNS = (
    "id", "visit_date", "bank", "city", "branch", "account_type", "result", "residency", "documents",
    "comment",
)


def iso(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def add_missing_columns(db: sqlite3.Connection) -> None:
    for table, column, kind in ADDED_COLUMNS:
        existing = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
        if column not in existing:
            db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {kind}")


def public_conditions(answer_filter: AnswerFilter) -> tuple[list[str], list[str | int]]:
    """WHERE для публичной выборки; имена колонок — только из equals(), значения — параметрами."""
    clauses = ["status = 'accepted'"]
    args: list[str | int] = []
    for column, value in answer_filter.equals().items():
        clauses.append(f"{column} = ?")
        args.append(value)
    if answer_filter.date_from:
        clauses.append("visit_date >= ?")
        args.append(answer_filter.date_from)
    if answer_filter.date_to:
        clauses.append("visit_date <= ?")
        args.append(answer_filter.date_to)
    return clauses, args


def decode_row(row: sqlite3.Row) -> dict:
    item = dict(row)
    for column in ("documents", "sources"):
        if column in item:
            item[column] = json.loads(item[column])
    return item


class Store:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(SCHEMA)
            add_missing_columns(db)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        """Соединение на одну операцию: коммит при успехе, закрытие всегда."""
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def add(self, item: Suggestion, ip_hash: str, user_agent: str, now: datetime) -> int:
        with self.connect() as db:
            cur = db.execute(
                "INSERT INTO suggestions (created_at, section_id, section_title, text, source,"
                " contact, ip_hash, user_agent_short) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (iso(now), item.section_id, item.section_title, item.text, item.source,
                 item.contact, ip_hash, user_agent),
            )
            return int(cur.lastrowid or 0)

    def add_account(self, item: AccountReport, ip_hash: str, user_agent: str, now: datetime) -> int:
        with self.connect() as db:
            cur = db.execute(
                "INSERT INTO accounts (created_at, bank, city, account_type, result, visit_date,"
                " residency, documents, comment, ip_hash, user_agent_short, branch)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (iso(now), item.bank, item.city, item.account_type, item.result, item.visit_date,
                 item.residency, json.dumps(list(item.documents)), item.comment, ip_hash, user_agent,
                 item.branch),
            )
            return int(cur.lastrowid or 0)

    def add_proposal(self, item: Proposal, ip_hash: str, user_agent: str, now: datetime) -> int:
        with self.connect() as db:
            cur = db.execute(
                "INSERT INTO proposals (created_at, title, text, doc_url, sources, target, contact,"
                " ip_hash, user_agent_short, text_format) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'html')",
                (iso(now), item.title, item.text, item.doc_url, json.dumps(list(item.sources)),
                 item.target, item.contact, ip_hash, user_agent),
            )
            return int(cur.lastrowid or 0)

    def update_proposal(self, item_id: int, changes: dict[str, str], now: datetime) -> bool:
        """changes — уже проверенные поля редактора (proposals.EDITOR_FIELDS)."""
        assignments = ", ".join(f"{column} = ?" for column in changes)
        with self.connect() as db:
            cur = db.execute(
                f"UPDATE proposals SET {assignments}, updated_at = ? WHERE id = ?",
                (*changes.values(), iso(now), item_id),
            )
            return cur.rowcount == 1

    def delete_proposal(self, item_id: int) -> bool:
        with self.connect() as db:
            return db.execute("DELETE FROM proposals WHERE id = ?", (item_id,)).rowcount == 1

    def public_proposals(self, limit: int) -> list[dict]:
        """Все предложения, кроме спама, свежие сверху, без автора и контакта."""
        marks = ", ".join("?" for _ in PUBLIC_STATUSES)
        query = (
            f"SELECT {', '.join(PUBLIC_PROPOSAL_COLUMNS)} FROM proposals"
            f" WHERE status IN ({marks}) ORDER BY id DESC LIMIT ?"
        )
        with self.connect() as db:
            return [decode_row(row) for row in db.execute(query, (*PUBLIC_STATUSES, limit))]

    def add_case(
        self, item: CaseReport, files: list[tuple[str, str, int]], ip_hash: str, user_agent: str,
        now: datetime,
    ) -> int:
        """Кейс и его файлы (имя, вид, байты) одной транзакцией; сами файлы уже лежат на диске."""
        with self.connect() as db:
            cur = db.execute(
                "INSERT INTO case_stories (created_at, category, summary, filed, result, event_date, sources,"
                " own_url, contact, ip_hash, user_agent_short) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (iso(now), item.category, item.summary, item.filed, item.result, item.event_date,
                 json.dumps(list(item.sources)), item.own_url, item.contact, ip_hash, user_agent),
            )
            case_id = int(cur.lastrowid or 0)
            db.executemany(
                "INSERT INTO case_files (case_id, created_at, name, kind, bytes) VALUES (?, ?, ?, ?, ?)",
                [(case_id, iso(now), name, kind, size) for name, kind, size in files],
            )
            return case_id

    def case_files(self, case_ids: list[int] | None = None) -> dict[int, list[dict]]:
        """Файлы по кейсам; None — все."""
        query = f"SELECT {', '.join(CASE_FILE_COLUMNS)} FROM case_files"
        args: list[int] = []
        if case_ids is not None:
            query += f" WHERE case_id IN ({', '.join('?' for _ in case_ids)})"
            args = case_ids
        out: dict[int, list[dict]] = {}
        with self.connect() as db:
            for row in db.execute(query + " ORDER BY id", args):
                out.setdefault(row["case_id"], []).append(dict(row))
        return out

    def case_of_file(self, name: str) -> dict | None:
        query = (
            "SELECT s.id, s.status, s.published, s.files_published FROM case_files f"
            " JOIN case_stories s ON s.id = f.case_id WHERE f.name = ?"
        )
        with self.connect() as db:
            row = db.execute(query, (name,)).fetchone()
            return dict(row) if row else None

    def files_from(self, ip_hash: str, now: datetime, window: timedelta) -> int:
        """Сколько файлов прислали с этого хэша IP за окно — лимит загрузок отдельно от лимита кейсов."""
        query = (
            "SELECT COUNT(*) FROM case_files f JOIN case_stories s ON s.id = f.case_id"
            " WHERE s.ip_hash = ? AND f.created_at > ?"
        )
        with self.connect() as db:
            return int(db.execute(query, (ip_hash, iso(now - window))).fetchone()[0])

    def public_cases(self, limit: int) -> list[dict]:
        """Только принятые и отмеченные к публикации, свежие события сверху."""
        query = (
            f"SELECT {', '.join(COLUMNS['case_stories'])} FROM case_stories"
            " WHERE status = 'accepted' AND published = 1 ORDER BY event_date DESC, id DESC LIMIT ?"
        )
        with self.connect() as db:
            return [decode_row(row) for row in db.execute(query, (limit,))]

    def update_case(self, item_id: int, changes: dict[str, str | int], now: datetime) -> bool:
        """changes — уже проверенные поля (casebook.EDITOR_FIELDS)."""
        assignments = ", ".join(f"{column} = ?" for column in changes)
        with self.connect() as db:
            cur = db.execute(
                f"UPDATE case_stories SET {assignments}, updated_at = ? WHERE id = ?",
                (*changes.values(), iso(now), item_id),
            )
            return cur.rowcount == 1

    def delete_case(self, item_id: int) -> list[str] | None:
        """Удаляет кейс и строки его файлов; возвращает имена файлов, чтобы стереть их с диска."""
        with self.connect() as db:
            rows = db.execute("SELECT name FROM case_files WHERE case_id = ?", (item_id,))
            names = [row[0] for row in rows]
            db.execute("DELETE FROM case_files WHERE case_id = ?", (item_id,))
            if db.execute("DELETE FROM case_stories WHERE id = ?", (item_id,)).rowcount != 1:
                return None
            return names

    def recent_from(
        self, ip_hash: str, now: datetime, window: timedelta, table: str = "suggestions"
    ) -> int:
        if table not in COLUMNS:
            raise ValueError(f"unknown table {table}")
        with self.connect() as db:
            row = db.execute(
                f"SELECT COUNT(*) FROM {table} WHERE ip_hash = ? AND created_at > ?",
                (ip_hash, iso(now - window)),
            ).fetchone()
            return int(row[0])

    def since(self, moment: str, status: str | None, limit: int, table: str = "suggestions") -> list[dict]:
        query = f"SELECT {', '.join(COLUMNS[table])} FROM {table} WHERE created_at > ?"
        args: list[str | int] = [moment]
        if status:
            query += " AND status = ?"
            args.append(status)
        query += " ORDER BY id LIMIT ?"
        args.append(limit)
        with self.connect() as db:
            return [decode_row(row) for row in db.execute(query, args)]

    def set_status(self, item_id: int, status: str, table: str = "suggestions") -> bool:
        if table not in COLUMNS:
            raise ValueError(f"unknown table {table}")
        with self.connect() as db:
            cur = db.execute(f"UPDATE {table} SET status = ? WHERE id = ?", (status, item_id))
            return cur.rowcount == 1

    def public_accounts(
        self,
        answer_filter: AnswerFilter | None = None,
        before: tuple[str, int] | None = None,
        limit: int | None = None,
        with_person: bool = False,
    ) -> list[dict]:
        """Только принятые отчёты и только публичные поля, свежие визиты сверху.

        before — (visit_date, id) последней показанной записи: следующая страница идёт строго после неё.
        with_person — добавить хэш IP как `person`, чтобы сводка считала людей, а не ответы;
        наружу его не отдавать.
        """
        clauses, args = public_conditions(answer_filter or AnswerFilter())
        if before:
            clauses.append("(visit_date < ? OR (visit_date = ? AND id < ?))")
            args += [before[0], before[0], before[1]]
        columns = [*PUBLIC_ACCOUNT_COLUMNS, *(["ip_hash AS person"] if with_person else [])]
        query = (
            f"SELECT {', '.join(columns)} FROM accounts WHERE {' AND '.join(clauses)}"
            " ORDER BY visit_date DESC, id DESC"
        )
        if limit is not None:
            query += " LIMIT ?"
            args.append(limit)
        with self.connect() as db:
            return [decode_row(row) for row in db.execute(query, args)]

    def public_branch_counts(self) -> Counter:
        """Число принятых ответов по (банк, отделение) — по всем, без фильтров и страниц."""
        query = (
            "SELECT bank, branch, COUNT(*) FROM accounts"
            " WHERE status = 'accepted' AND branch IS NOT NULL AND branch != '' GROUP BY bank, branch"
        )
        with self.connect() as db:
            return Counter({(bank, branch): count for bank, branch, count in db.execute(query)})

    def add_queue_report(self, item: QueueReport, ip_hash: str, user_agent: str, now: datetime) -> int:
        with self.connect() as db:
            cur = db.execute(
                "INSERT INTO queue_reports (created_at, branch_id, state, comment, ip_hash, user_agent_short)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (iso(now), item.branch_id, item.state, item.comment, ip_hash, user_agent),
            )
            return int(cur.lastrowid)

    def queue_report_since(self, ip_hash: str, branch_id: str, since: datetime) -> bool:
        with self.connect() as db:
            row = db.execute(
                "SELECT 1 FROM queue_reports WHERE ip_hash = ? AND branch_id = ? AND created_at > ? LIMIT 1",
                (ip_hash, branch_id, iso(since)),
            ).fetchone()
            return row is not None

    def fresh_queue_reports(self, since: datetime) -> list[tuple[str, str, str]]:
        """(branch_id, state, created_at) без отклонённых модератором, по возрастанию времени."""
        marks = ", ".join("?" * len(HIDDEN_STATUSES))
        with self.connect() as db:
            rows = db.execute(
                "SELECT branch_id, state, created_at FROM queue_reports"
                f" WHERE created_at > ? AND status NOT IN ({marks}) ORDER BY created_at",
                (iso(since), *HIDDEN_STATUSES),
            )
            return [(r[0], r[1], r[2]) for r in rows]

    def claim_challenge(self, challenge: str, expires_at: int, now: datetime) -> bool:
        """Отмечает решённую задачу использованной; False — её уже предъявляли."""
        with self.connect() as db:
            db.execute("DELETE FROM pow_used WHERE expires_at < ?", (int(now.timestamp()),))
            cur = db.execute(
                "INSERT OR IGNORE INTO pow_used (challenge, expires_at) VALUES (?, ?)",
                (challenge, expires_at),
            )
            return cur.rowcount == 1

    def forget_old_traces(self, before: datetime) -> None:
        """Стирает хэш IP и браузер у записей старше срока: лимиту частоты они нужны лишь час."""
        with self.connect() as db:
            for table in COLUMNS:
                db.execute(
                    f"UPDATE {table} SET ip_hash = '', user_agent_short = ''"
                    " WHERE created_at < ? AND (ip_hash != '' OR user_agent_short != '')",
                    (iso(before),),
                )
