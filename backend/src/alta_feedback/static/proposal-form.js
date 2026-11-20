// The editor text is hidden, so native required will not work: either text or a document link is needed.
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
