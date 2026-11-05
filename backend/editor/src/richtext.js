// Редактор текста предложения: Tiptap поверх <textarea>. Без JS остаётся обычное поле с простым текстом.
// Сервер всё равно чистит HTML (richtext.py), здесь только удобство: те же теги, что он пропускает.
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

const HTTP = /^https?:\/\/[^\s]+$/i;

const WORDS = {
  ru: { bold: "Жирный", italic: "Курсив", h2: "Заголовок", h3: "Подзаголовок", ul: "Список", ol: "Нумерованный список",
        quote: "Цитата", link: "Ссылка", ask: "Ссылка (https://…); пусто — убрать ссылку",
        bad: "Нужна ссылка, начинающаяся с http:// или https://", text: "Текст" },
  en: { bold: "Bold", italic: "Italic", h2: "Heading", h3: "Subheading", ul: "List", ol: "Numbered list",
        quote: "Quote", link: "Link", ask: "Link (https://…); empty removes the link",
        bad: "The link must start with http:// or https://", text: "Text" },
  sr: { bold: "Podebljano", italic: "Kurziv", h2: "Naslov", h3: "Podnaslov", ul: "Lista", ol: "Numerisana lista",
        quote: "Citat", link: "Link", ask: "Link (https://…); prazno uklanja link",
        bad: "Link mora da počinje sa http:// ili https://", text: "Tekst" },
};
const W = WORDS[(document.documentElement.lang || "ru").slice(0, 2)] || WORDS.ru;

const BUTTONS = [
  { label: "B", title: W.bold, run: (c) => c.toggleBold(), active: (e) => e.isActive("bold") },
  { label: "I", title: W.italic, run: (c) => c.toggleItalic(), active: (e) => e.isActive("italic") },
  { label: "H2", title: W.h2, run: (c) => c.toggleHeading({ level: 2 }), active: (e) => e.isActive("heading", { level: 2 }) },
  { label: "H3", title: W.h3, run: (c) => c.toggleHeading({ level: 3 }), active: (e) => e.isActive("heading", { level: 3 }) },
  { label: "•", title: W.ul, run: (c) => c.toggleBulletList(), active: (e) => e.isActive("bulletList") },
  { label: "1.", title: W.ol, run: (c) => c.toggleOrderedList(), active: (e) => e.isActive("orderedList") },
  { label: "❝", title: W.quote, run: (c) => c.toggleBlockquote(), active: (e) => e.isActive("blockquote") },
];

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}

// Простой текст из поля без JS → абзацы; пустая строка разделяет абзацы, перевод строки — <br>.
export function plainToHtml(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function button(spec, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "rt-btn";
  b.textContent = spec.label;
  b.title = spec.title;
  b.setAttribute("aria-label", spec.title);
  b.addEventListener("mousedown", (event) => event.preventDefault());
  b.addEventListener("click", onClick);
  return b;
}

function askLink(editor) {
  const current = editor.getAttributes("link").href || "";
  const url = (window.prompt(W.ask, current) || "").trim();
  const chain = editor.chain().focus().extendMarkRange("link");
  if (!url) chain.unsetLink().run();
  else if (HTTP.test(url)) chain.setLink({ href: url }).run();
  else window.alert(W.bad);
}

function toolbar(editor) {
  const bar = document.createElement("div");
  bar.className = "rt-bar";
  bar.setAttribute("role", "toolbar");
  const items = BUTTONS.map((spec) => {
    const b = button(spec, () => { spec.run(editor.chain().focus()).run(); });
    bar.append(b);
    return [b, spec];
  });
  const link = button({ label: "🔗", title: W.link }, () => askLink(editor));
  bar.append(link);
  const sync = () => {
    for (const [b, spec] of items) b.classList.toggle("on", spec.active(editor));
    link.classList.toggle("on", editor.isActive("link"));
  };
  editor.on("transaction", sync);
  sync();
  return bar;
}

function extensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        protocols: [],
        defaultProtocol: "https",
        isAllowedUri: (url) => HTTP.test(url),
        HTMLAttributes: { rel: "noopener nofollow", target: null },
      },
    }),
  ];
}

// Заменяет textarea редактором. format: "html" — в поле уже HTML, иначе простой текст.
// Возвращает редактор; при каждом изменении textarea получает его HTML, а hidden text_format = html.
export function mount(textarea, { format = "plain", onChange } = {}) {
  const box = document.createElement("div");
  box.className = "rt";
  const area = document.createElement("div");
  area.className = "rt-area";
  const start = format === "html" ? textarea.value : plainToHtml(textarea.value);
  const editor = new Editor({
    element: area,
    extensions: extensions(),
    content: start,
    editorProps: { attributes: { class: "rt-doc", "aria-label": textarea.getAttribute("aria-label") || W.text } },
  });
  box.append(toolbar(editor), area);
  textarea.hidden = true;
  textarea.removeAttribute("maxlength");
  textarea.after(box);
  const write = () => {
    textarea.value = editor.isEmpty ? "" : editor.getHTML();
    if (onChange) onChange(editor);
  };
  editor.on("update", write);
  write();
  return editor;
}

// Поле формы предложения: textarea[data-richtext] → редактор и скрытое text_format=html.
function enhanceForms() {
  for (const textarea of document.querySelectorAll("textarea[data-richtext]")) {
    const format = document.createElement("input");
    format.type = "hidden";
    format.name = "text_format";
    format.value = "html";
    textarea.form.append(format);
    mount(textarea, { format: textarea.dataset.format || "plain" });
  }
}

window.AltaRichText = { mount, plainToHtml };
enhanceForms();
