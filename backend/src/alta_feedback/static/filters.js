// Фильтры сводки: поля дат в стиле страницы; списки с поиском даёт select-combo.js (data-combo).
// Без скрипта форма работает на тех же <select> и <input type=date> с теми же name.
(() => {
  const make = (tag, className, props = {}) => Object.assign(document.createElement(tag), { className, ...props });

  const CALENDAR_ICON =
    '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="4" width="15" height="13" rx="1.5" ' +
    'fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 8h15M6.5 2v4M13.5 2v4" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round"/></svg>';

  /** 2026-10-12 → 12.10.2026; пусто или не дата — пустая строка. */
  const russianDate = (iso) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
  };

  // Системный выбор даты на телефоне удобен, поэтому оставляем его, но прячем под поле в стиле страницы.
  const enhanceDate = (input) => {
    const box = make("div", "date");
    const face = make("span", "date-face");
    face.setAttribute("aria-hidden", "true");
    const icon = make("span", "date-icon", { innerHTML: CALENDAR_ICON });
    const clear = make("button", "date-clear", { type: "button", hidden: true });
    clear.setAttribute("aria-label", "Очистить дату");
    input.before(box);
    box.append(icon, face, input, clear);
    input.classList.add("date-native");

    const show = () => {
      const text = russianDate(input.value);
      face.textContent = text || "дд.мм.гггг";
      box.classList.toggle("chosen", Boolean(text));
      clear.hidden = !text;
    };
    input.addEventListener("click", () => {
      try { input.showPicker(); } catch { /* старый браузер откроет выбор сам */ }
    });
    input.addEventListener("input", show);
    input.addEventListener("change", show);
    clear.addEventListener("click", () => {
      input.value = "";
      show();
      input.focus();
    });
    window.addEventListener("pageshow", show);
    show();
  };

  if (typeof module === "object" && module.exports) {
    module.exports = { russianDate };
    return;
  }
  const form = document.querySelector("form.filters");
  if (!form) return;
  form.querySelectorAll("input[type=date]").forEach(enhanceDate);
  // Пустые поля не отправляем: ссылка на фильтр короче, её проще переслать.
  const named = () => [...form.querySelectorAll("select[name], input[name]")];
  form.addEventListener("submit", () => named().forEach((field) => { field.disabled = !field.value; }));
  window.addEventListener("pageshow", () => named().forEach((field) => { field.disabled = false; }));
})();
