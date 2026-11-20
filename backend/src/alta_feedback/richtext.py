"""Proposal text with markup: a strict allowlist over stdlib html.parser.

Why not nh3: a new dependency changes pyproject.toml and uv.lock, and those are under CODEOWNERS review.
There is one entry point, `sanitize`; it can be replaced with nh3.clean with the same tags without
touching the rest.

What passes: p, br, strong, em, h2, h3, ul, ol, li, blockquote and a with an http(s) href only;
we set the link's rel ourselves. Other tags are dropped and their text is kept escaped; the contents
of script, style, iframe, template, svg, math and the like are dropped entirely. Attributes other than
the href of a are dropped. The output is always balanced: unclosed tags are closed, extra closing
ones are ignored.
"""

import html
from html.parser import HTMLParser
from urllib.parse import urlsplit

ALLOWED = frozenset({"p", "br", "strong", "em", "h2", "h3", "ul", "ol", "li", "a", "blockquote"})
VOID = frozenset({"br"})
# Synonyms produced by pasting from Word/Google Docs: same meaning, the tag is from the list.
ALIASES = {"b": "strong", "i": "em", "h1": "h2", "h4": "h3", "h5": "h3", "h6": "h3", "div": "p"}
DROP_CONTENT = frozenset({
    "script", "style", "iframe", "template", "svg", "math", "object", "embed", "noscript", "noembed",
    "noframes", "frameset", "frame", "xmp", "plaintext", "textarea", "select", "title", "head", "applet",
})
LINK_REL = "noopener nofollow"
# Invisible characters used to hide the scheme: "​javascript:". Control characters and spaces are caught
# by the check below.
INVISIBLE = frozenset({0x7F, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF})


def safe_href(raw: str | None) -> str | None:
    """An http(s) link with a host; javascript:, data:, relative and with junk inside gives None."""
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
    """Editor HTML -> safe HTML from the allowed tags."""
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
    """Text without markup: the length limit is counted on it."""
    parser = TextOnly()
    parser.feed(clean)
    parser.close()
    return "".join(parser.parts).strip()


def plain_to_html(text: str) -> str:
    """Plain text (field without JS, old proposals) -> paragraphs; a single newline becomes <br>."""
    paragraphs = [p.strip() for p in text.replace("\r\n", "\n").replace("\r", "\n").split("\n\n")]
    return "".join(
        f"<p>{html.escape(p, quote=False).replace(chr(10), '<br>')}</p>" for p in paragraphs if p
    )
