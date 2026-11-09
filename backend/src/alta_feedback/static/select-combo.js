// Единый выпадающий список сайта и форм вместо системного <select>: системный список у каждого
// браузера свой и стилям не поддаётся. Подключается к <select data-combo> (data-combo="search" —
// с поиском). Сам <select> остаётся в форме и хранит значение: без скрипта всё работает на нём,
// а код страниц читает и меняет select.value как раньше.
(() => {
  // Кириллицу сводим к латинице по-сербски: тогда «бел», «bel», «ниш» и «niš» находят свои города.
  const LATIN = {
    а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "dj", е: "e", ж: "z", з: "z", и: "i", ј: "j",
    к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t",
    ћ: "c", у: "u", ф: "f", х: "h", ц: "c", ч: "c", џ: "dz", ш: "s", щ: "s", ъ: "", ы: "y",
    ь: "", э: "e", ю: "ju", я: "ja",
  };

  /** Строка для сравнения: без регистра, диакритики, пробелов и дефисов, кириллица — латиницей. */
  const fold = (text) =>
    [...text.toLocaleLowerCase("ru").replaceAll("đ", "dj").normalize("NFD").replace(/\p{M}/gu, "")]
      .map((char) => LATIN[char] ?? char)
      .join("")
      .replace(/[^\p{L}\p{N}]+/gu, "");

  /** Варианты, где запрос встречается в подписи или в коде; пустой запрос — все варианты. */
  const filterOptions = (options, query) => {
    const needle = fold(query);
    if (!needle) return options;
    return options.filter((option) => option.value && [option.label, option.value].some((text) => fold(text).includes(needle)));
  };

  const TEXTS = {
    ru: { empty: "Ничего не нашлось", clear: "Сбросить" },
    en: { empty: "Nothing found", clear: "Clear" },
    sr: { empty: "Ništa nije pronađeno", clear: "Poništi" },
  };

  if (typeof module === "object" && module.exports) {
    module.exports = { fold, filterOptions };
    return;
  }

  const textsFor = (element) => {
    const lang = (element.closest("[lang]")?.getAttribute("lang") || "ru").slice(0, 2).toLowerCase();
    return TEXTS[lang] || TEXTS.ru;
  };

  const make = (tag, className, props = {}) => Object.assign(document.createElement(tag), { className, ...props });
  const attrs = (element, values) => Object.entries(values).forEach(([name, value]) => element.setAttribute(name, value));

  // Видимая часть экрана: на телефоне её съедает клавиатура, а сверху — липкая шапка сайта.
  const visibleArea = () => {
    const view = window.visualViewport;
    const top = view ? view.offsetTop : 0;
    return { top: top + 64, bottom: top + (view ? view.height : window.innerHeight) };
  };

  // Подсветка набранного в подписи, если оно там есть буквально (иначе совпадение через транслит).
  const labelWithMatch = (label, query) => {
    const at = query ? label.toLocaleLowerCase("ru").indexOf(query.trim().toLocaleLowerCase("ru")) : -1;
    if (at < 0 || !query.trim()) return [label];
    const end = at + query.trim().length;
    return [label.slice(0, at), make("mark", "", { textContent: label.slice(at, end) }), label.slice(end)];
  };

  // Код страниц ставит select.value напрямую, без события change, — поле должно это увидеть.
  const watchValue = (select, onSet) => {
    for (const prop of ["value", "selectedIndex"]) {
      const native = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
      Object.defineProperty(select, prop, {
        configurable: true,
        get() { return native.get.call(this); },
        set(next) { native.set.call(this, next); onSet(); },
      });
    }
  };

  let comboCount = 0;

  const enhance = (select) => {
    if (select.dataset.comboReady) return;
    select.dataset.comboReady = "1";
    const searchable = select.dataset.combo === "search";
    const texts = textsFor(select);
    const listId = `combo-list-${++comboCount}`;
    const readOptions = () => [...select.options].map((option) => ({ value: option.value, label: option.textContent.trim() }));
    const everythingOf = (options) => options.find((option) => !option.value);

    const box = make("div", `combo combo-select${searchable ? "" : " combo-pick"}`);
    // С поиском — поле ввода; без поиска — кнопка-поле: на телефоне не выскакивает клавиатура.
    const face = searchable
      ? make("input", "combo-input", { type: "text", autocomplete: "off", spellcheck: false })
      : make("div", "combo-face", { tabIndex: 0 });
    attrs(face, { role: "combobox", "aria-expanded": "false", "aria-controls": listId, "aria-haspopup": "listbox" });
    if (searchable) attrs(face, { "aria-autocomplete": "list", autocapitalize: "off", enterkeyhint: "done" });
    const labels = select.id ? [...document.querySelectorAll(`label[for="${select.id}"]`)] : [];
    if (select.closest("label")) labels.push(select.closest("label"));
    // Поле с поиском забирает id, чтобы <label for> ставил курсор в него. Без поиска id остаётся
    // у <select>: код страниц находит его по id и читает value.
    if (searchable && select.id) {
      face.id = select.id;
      select.removeAttribute("id");
    }
    // Имя поля — текст подписи без самого списка: подпись-обёртка содержит и <select> с вариантами.
    const labelText = (label) => {
      const copy = label.cloneNode(true);
      copy.querySelectorAll("select, .combo-select").forEach((node) => node.remove());
      return copy.textContent.replace(/\s+/g, " ").trim();
    };
    const name = select.getAttribute("aria-label") || labels.map(labelText).filter(Boolean).join(" ");
    if (name && !(searchable && face.id)) face.setAttribute("aria-label", name);
    const clear = make("button", "combo-clear", { type: "button", tabIndex: -1, hidden: true });
    clear.setAttribute("aria-label", texts.clear);
    const list = make("ul", "combo-list", { id: listId, hidden: true });
    list.setAttribute("role", "listbox");
    select.classList.add("combo-native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    box.hidden = select.hidden;
    box.append(face, ...(searchable ? [clear] : []), list);
    select.before(box);

    let shown = [];
    let active = -1;

    const current = () => {
      const options = readOptions();
      return options.find((option) => option.value === select.value) || everythingOf(options);
    };
    const showCurrent = () => {
      const option = current();
      if (searchable) {
        face.placeholder = everythingOf(readOptions())?.label || "";
        face.value = option && option.value ? option.label : "";
        clear.hidden = !select.value;
      } else {
        face.textContent = option ? option.label : "";
      }
      box.classList.toggle("chosen", Boolean(select.value));
    };

    const highlight = (index) => {
      active = index;
      [...list.children].forEach((item, i) => item.classList.toggle("active", i === index));
      const item = list.children[index];
      if (item && item.id) {
        face.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView({ block: "nearest" });
      } else {
        face.removeAttribute("aria-activedescendant");
      }
    };

    const place = () => {
      const area = visibleArea();
      const rect = face.getBoundingClientRect();
      const below = area.bottom - rect.bottom - 8;
      const above = rect.top - area.top - 8;
      const up = below < 200 && above > below;
      list.classList.toggle("up", up);
      list.style.maxHeight = `${Math.max(120, Math.min(340, up ? above : below))}px`;
      list.classList.remove("end");
      if (list.getBoundingClientRect().right > document.documentElement.clientWidth - 8) list.classList.add("end");
    };

    const render = (query) => {
      shown = searchable ? filterOptions(readOptions(), query) : readOptions();
      const items = shown.map((option, i) => {
        const item = make("li", "combo-option", { id: `${listId}-${i}` });
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(option.value === select.value));
        item.append(...labelWithMatch(option.label, query));
        if (!option.value) item.classList.add("all");
        // preventDefault: внутри <label> клик иначе дошёл бы до поля и открыл список заново.
        item.addEventListener("click", (event) => { event.preventDefault(); pick(option); });
        return item;
      });
      if (!items.length) {
        const empty = make("li", "combo-empty", { textContent: texts.empty });
        empty.setAttribute("aria-disabled", "true");
        items.push(empty);
      }
      list.replaceChildren(...items);
    };

    const open = (query = "") => {
      render(query);
      list.hidden = false;
      box.classList.add("open");
      face.setAttribute("aria-expanded", "true");
      place();
      const selectedIndex = shown.findIndex((option) => option.value === select.value);
      highlight(query ? (shown.length ? 0 : -1) : selectedIndex);
    };

    const close = () => {
      list.hidden = true;
      box.classList.remove("open");
      face.setAttribute("aria-expanded", "false");
      face.removeAttribute("aria-activedescendant");
      active = -1;
    };

    // Ушёл, не выбрав: в поле возвращается то, что реально выбрано, а не набранный обрывок.
    const dismiss = () => {
      close();
      showCurrent();
    };

    const pick = (option) => {
      const changed = select.value !== option.value;
      select.value = option.value;
      if (changed) {
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      dismiss();
      if (!searchable) face.focus();
    };

    const move = (step) => {
      if (list.hidden) return open();
      if (shown.length) highlight((active + step + shown.length) % shown.length);
    };

    // Без поиска: первая буква переводит на подходящий вариант, как в системном списке.
    let typed = "";
    let typedAt = 0;
    const typeAhead = (char) => {
      const now = Date.now();
      typed = now - typedAt < 700 ? typed + char : char;
      typedAt = now;
      if (list.hidden) open();
      const needle = fold(typed);
      const index = shown.findIndex((option) => fold(option.label).startsWith(needle));
      if (index >= 0) highlight(index);
    };

    face.addEventListener("keydown", (event) => {
      const { key } = event;
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        move(key === "ArrowDown" ? 1 : -1);
      } else if ((key === "Home" || key === "End") && !list.hidden && !searchable) {
        event.preventDefault();
        highlight(key === "Home" ? 0 : shown.length - 1);
      } else if (key === "Enter" || (key === " " && !searchable)) {
        if (list.hidden) {
          if (searchable) return;
          event.preventDefault();
          return open();
        }
        event.preventDefault();
        const everything = everythingOf(readOptions());
        if (active >= 0 && shown[active]) pick(shown[active]);
        else if (searchable && !face.value.trim() && everything) pick(everything);
      } else if (key === "Escape" && !list.hidden) {
        event.preventDefault();
        dismiss();
      } else if (key === "Tab") {
        if (!list.hidden && !searchable && active >= 0 && shown[active]) pick(shown[active]);
        else dismiss();
      } else if (!searchable && key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        typeAhead(key);
      }
    });

    if (searchable) {
      face.addEventListener("focus", () => {
        // На телефоне поднимаем поле к шапке, чтобы список поместился над клавиатурой.
        if (window.matchMedia("(max-width: 719px)").matches) (box.closest(".field") || box).scrollIntoView({ block: "start" });
        open();
        face.select();
      });
      face.addEventListener("click", () => { if (list.hidden) open(); });
      face.addEventListener("input", () => open(face.value));
    } else {
      face.addEventListener("click", (event) => {
        event.preventDefault();
        if (list.hidden) open();
        else dismiss();
      });
    }
    // Список не забирает фокус у поля, иначе на компьютере клик по варианту закрыл бы его раньше выбора.
    list.addEventListener("mousedown", (event) => event.preventDefault());
    clear.addEventListener("mousedown", (event) => event.preventDefault());
    clear.addEventListener("click", (event) => {
      event.preventDefault();
      const everything = everythingOf(readOptions());
      if (everything) pick(everything);
      face.focus();
    });
    // Подпись поля: клик по ней ставит фокус на наше поле, а не на спрятанный <select>.
    labels.forEach((label) => label.addEventListener("click", (event) => {
      if (box.contains(event.target)) return;
      event.preventDefault();
      face.focus();
    }));
    box.addEventListener("focusout", (event) => {
      if (event.relatedTarget && !box.contains(event.relatedTarget)) dismiss();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!list.hidden && !box.contains(event.target)) dismiss();
    });
    window.visualViewport?.addEventListener("resize", () => { if (!list.hidden) place(); });
    window.addEventListener("pageshow", showCurrent);
    select.addEventListener("change", showCurrent);
    select.form?.addEventListener("reset", () => setTimeout(showCurrent));
    // Страница прячет и показывает сам <select> атрибутом hidden — поле следует за ним.
    new MutationObserver(() => { box.hidden = select.hidden; }).observe(select, { attributes: true, attributeFilter: ["hidden"] });
    watchValue(select, showCurrent);
    showCurrent();
  };

  const enhanceAll = (root) => {
    if (root.matches?.("select[data-combo]")) enhance(root);
    root.querySelectorAll?.("select[data-combo]").forEach(enhance);
  };

  window.AltaSelectCombo = { enhance, enhanceAll };
  enhanceAll(document);
  // Строки админки и списки, которые страница дорисовывает скриптом, получают то же поле.
  new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach((node) => { if (node.nodeType === 1) enhanceAll(node); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
