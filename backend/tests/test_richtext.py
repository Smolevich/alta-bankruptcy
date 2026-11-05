import re

import pytest

from alta_feedback.richtext import plain_to_html, safe_href, sanitize, visible_text

LINK = 'rel="noopener nofollow"'


@pytest.mark.parametrize(
    "dirty",
    [
        "<script>alert(1)</script>",
        "<SCRIPT>alert(1)</SCRIPT>",
        "<script src=https://evil.example/x.js></script>",
        "<scr<script>ipt>alert(1)</script>",
        "<script>alert(1)",
        "<img src=x onerror=alert(1)>",
        "<body onload=alert(1)>",
        "<p onmouseover=alert(1)>x</p>",
        "<svg onload=alert(1)><script>alert(1)</script></svg>",
        "<svg><a href=javascript:alert(1)>x</a></svg>",
        "<math><mtext><script>alert(1)</script></mtext></math>",
        "<iframe src=https://evil.example></iframe>",
        "<iframe srcdoc='<script>alert(1)</script>'>",
        "<template><img src=x onerror=alert(1)></template>",
        "<style>body{background:url(javascript:alert(1))}</style>",
        "<p style='background:url(javascript:alert(1))'>x</p>",
        "<object data=javascript:alert(1)></object>",
        "<embed src=javascript:alert(1)>",
        "<form action=javascript:alert(1)><button>x</button></form>",
        "<input autofocus onfocus=alert(1)>",
        "<meta http-equiv=refresh content='0;url=javascript:alert(1)'>",
        "<base href=javascript:alert(1)//>",
        "<!--<script>alert(1)</script>-->",
        "<![CDATA[<script>alert(1)</script>]]>",
        "<?xml version='1.0'?><script>alert(1)</script>",
        "<noscript><img src=x onerror=alert(1)></noscript>",
        "<textarea><script>alert(1)</script></textarea>",
        "<a href=x onclick=alert(1)>x</a>",
        "<details open ontoggle=alert(1)>",
        "<video><source onerror=alert(1)></video>",
    ],
)
def test_no_script_survives(dirty):
    clean = sanitize(dirty)
    assert not re.search(r"<(?!/?(p|br|strong|em|h2|h3|ul|ol|li|a|blockquote)\b)", clean), clean
    assert not re.search(r"on\w+\s*=|javascript:|<script|<svg|<iframe|style=", clean, re.I), clean


@pytest.mark.parametrize(
    "href",
    [
        "javascript:alert(1)",
        "JaVaScRiPt:alert(1)",
        " javascript:alert(1)",
        "\tjavascript:alert(1)",
        "java\tscript:alert(1)",
        "java&#x09;script:alert(1)",
        "&#106;avascript:alert(1)",
        "&#x6A;avascript:alert(1)",
        "&#0000106avascript:alert(1)",
        "javascript&colon;alert(1)",
        "​javascript:alert(1)",
        "\x01javascript:alert(1)",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "DATA:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
        "//evil.example/",
        "/admin/proposals",
        "evil.example",
        "#top",
        "https:evil.example",
        "",
    ],
)
def test_link_without_http_scheme_loses_href(href):
    assert "<a" not in sanitize(f'<a href="{href}">x</a>')


def test_link_text_stays_when_href_is_dropped():
    assert sanitize('<a href="javascript:alert(1)">read</a>') == "read"


def test_http_link_gets_our_rel_and_nothing_else():
    clean = sanitize('<a href="https://example.com/a?b=1&c=2" target="_blank" rel="opener" class="x">y</a>')
    assert clean == f'<a href="https://example.com/a?b=1&amp;c=2" {LINK}>y</a>'


def test_quote_in_href_cannot_break_out_of_attribute():
    clean = sanitize('<a href="https://example.com/&quot; onmouseover=&quot;alert(1)">y</a>')
    assert "onmouseover" not in clean


def test_nested_links_are_flattened():
    clean = sanitize('<a href="https://a.example">1<a href="https://b.example">2</a></a>')
    assert clean.count("<a ") == 1


@pytest.mark.parametrize(
    ("dirty", "clean"),
    [
        ("<p>a<b>b<i>c</p>", "<p>a<strong>b<em>c</em></strong></p>"),
        ("<ul><li>one<li>two</ul>", "<ul><li>one<li>two</li></li></ul>"),
        ("</p></strong>text</em>", "text"),
        ("<h1>T</h1><h4>t</h4>", "<h2>T</h2><h3>t</h3>"),
        ("<blockquote><p>q</p></blockquote>", "<blockquote><p>q</p></blockquote>"),
        ("a<br/>b<br>c", "a<br>b<br>c"),
        ("<span><font color=red>x</font></span>", "x"),
        ("<table><tr><td>cell</td></tr></table>", "cell"),
        ("<img src=https://example.com/a.png>", ""),
    ],
)
def test_structure(dirty, clean):
    assert sanitize(dirty) == clean


@pytest.mark.parametrize(
    "dirty",
    ["&lt;script&gt;alert(1)&lt;/script&gt;", "＜script＞alert(1)＜/script＞", "1 < 2 && 3 > 2", "‮gnp.exe"],
)
def test_text_that_looks_like_markup_stays_inert(dirty):
    assert "<script" not in sanitize(dirty)


def test_text_is_escaped():
    assert sanitize("<p>1 < 2 & 3 > 2</p>") == "<p>1 &lt; 2 &amp; 3 &gt; 2</p>"


def test_null_bytes_are_removed():
    assert "\x00" not in sanitize("<p>a\x00b</p>")


def test_sanitize_is_idempotent():
    once = sanitize('<p>a <b>b</b> <a href="https://example.com">c</a></p><ul><li>d</li></ul>')
    assert sanitize(once) == once


def test_visible_text_ignores_tags():
    assert visible_text("<p><strong>ab</strong></p><ul><li>c</li></ul>") == "abc"


def test_plain_text_becomes_paragraphs_and_line_breaks():
    assert plain_to_html("one\ntwo\n\n<three>") == "<p>one<br>two</p><p>&lt;three&gt;</p>"


def test_safe_href_keeps_https():
    assert safe_href(" https://example.com/x ") == "https://example.com/x"
