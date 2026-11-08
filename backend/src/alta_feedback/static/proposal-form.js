// Текст в редакторе скрыт, поэтому нативный required не сработает: нужен либо текст, либо ссылка на документ.
(() => {
  const form = document.querySelector("form[data-body-required]");
  const text = document.getElementById("text");
  const docUrl = document.getElementById("doc_url");
  if (!form || !text || !docUrl) return;
  form.addEventListener("submit", (event) => {
    if (text.value.trim() || docUrl.value.trim()) {
      docUrl.setCustomValidity("");
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    docUrl.setCustomValidity(form.dataset.bodyRequired);
    docUrl.reportValidity();
  });
  docUrl.addEventListener("input", () => docUrl.setCustomValidity(""));
})();
