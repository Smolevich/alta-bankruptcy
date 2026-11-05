"""Текст предложения с разметкой: строгий allowlist поверх stdlib html.parser.

Почему не nh3: новая зависимость меняет pyproject.toml и uv.lock, а они под ревью CODEOWNERS.
Точка входа одна — `sanitize`; заменить её на nh3.clean с теми же тегами можно, не трогая остальное.

Что пропускаем: p, br, strong, em, h2, h3, ul, ol, li, blockquote и a с href только http(s);
rel у ссылки ставим сами. Остальные теги выкидываем, их текст оставляем экранированным; содержимое
script, style, iframe, template, svg, math и подобных выкидываем целиком. Атрибуты, кроме href у a,
выкидываем. Выход всегда сбалансирован: незакрытое закрываем, лишние закрывающие игнорируем.
"""

import html
from html.parser import HTMLParser
from urllib.parse import urlsplit

ALLOWED = frozenset({"p", "br", "strong", "em", "h2", "h3", "ul", "ol", "li", "a", "blockquote"})
VOID = frozenset({"br"})
# Синонимы, которые даёт вставка из Word/Google Docs: смысл тот же, тег — из списка.
ALIASES = {"b": "strong", "i": "em", "h1": "h2", "h4": "h3", "h5": "h3", "h6": "h3", "div": "p"}
DROP_CONTENT = frozenset({
    "script", "style", "iframe", "template", "svg", "math", "object", "embed", "noscript", "noembed",
    "noframes", "frameset", "frame", "xmp", "plaintext", "textarea", "select", "title", "head", "applet",
})
LINK_REL = "noopener nofollow"
# Невидимые символы, которыми прячут схему: «\u200bjavascript:». Управляющие и пробелы ловит проверка ниже.
INVISIBLE = frozenset({0x7F, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF})


def safe_href(raw: str | None) -> str | None:
    """Ссылка http(s) с хостом; javascript:, data:, относительные и с мусором внутри — None."""
    url = (raw or "").strip()
    if not url or any(c.isspace() or ord(c) < 0x20 or ord(c) in INVISIBLE for c in url):
        return None
    parts = urlsplit(url)
    if parts.scheme.lower() not in {"http", "https"} or not parts.netloc:
        return None
    return url


class Cleaner(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.stack: list[tuple[str, bool]] = []
        self.dropping: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.dropping or tag in DROP_CONTENT:
            if tag in DROP_CONTENT and tag not in VOID:
                self.dropping.append(tag)
            return
        name = ALIASES.get(tag, tag)
        if name not in ALLOWED:
            return
        if name in VOID:
            self.out.append(f"<{name}>")
            return
        if name == "a":
            href = safe_href(dict(attrs).get("href"))
            inside_link = any(t == "a" and kept for t, kept in self.stack)
            if href is None or inside_link:
                self.stack.append(("a", False))
                return
            self.out.append(f'<a href="{html.escape(href, quote=True)}" rel="{LINK_REL}">')
        else:
            self.out.append(f"<{name}>")
        self.stack.append((name, True))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if ALIASES.get(tag, tag) in VOID:
            self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if self.dropping:
            if tag == self.dropping[-1]:
                self.dropping.pop()
            return
        name = ALIASES.get(tag, tag)
        if not any(t == name for t, _ in self.stack):
            return
        while self.stack:
            open_tag, kept = self.stack.pop()
            if kept:
                self.out.append(f"</{open_tag}>")
            if open_tag == name:
                return

    def handle_data(self, data: str) -> None:
        if not self.dropping:
            self.out.append(html.escape(data.replace("\x00", ""), quote=False))

    def result(self) -> str:
        self.close()
        while self.stack:
            open_tag, kept = self.stack.pop()
            if kept:
                self.out.append(f"</{open_tag}>")
        return "".join(self.out).strip()


def sanitize(raw: str) -> str:
    """HTML из редактора → безопасный HTML из разрешённых тегов."""
    cleaner = Cleaner()
    cleaner.feed(raw)
    return cleaner.result()


class TextOnly(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def visible_text(clean: str) -> str:
    """Текст без разметки — по нему считается лимит длины."""
    parser = TextOnly()
    parser.feed(clean)
    parser.close()
    return "".join(parser.parts).strip()


def plain_to_html(text: str) -> str:
    """Простой текст (поле без JS, старые предложения) → абзацы; одиночный перевод строки — <br>."""
    paragraphs = [p.strip() for p in text.replace("\r\n", "\n").replace("\r", "\n").split("\n\n")]
    return "".join(
        f"<p>{html.escape(p, quote=False).replace(chr(10), '<br>')}</p>" for p in paragraphs if p
    )
