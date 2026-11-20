// PDF viewing on the page, as on the reference (PdfDialog): any element with data-pdf opens a dialog.
// On a narrow screen the embedded viewer is awkward (iOS shows one page), so the PDF opens in a tab.
// Without the script the link just leads to the PDF.
(() => {
  // The "Forms" link leads to a collapsed bank block: expand it.
  const openTarget = () => {
    const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el && el.tagName === 'DETAILS') el.open = true;
  };
  openTarget();
  window.addEventListener('hashchange', openTarget);

  const dlg = document.getElementById('pdf-view');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const title = dlg.querySelector('strong');
  const orig = dlg.querySelector('header a');
  const wide = matchMedia('(min-width: 768px)');

  const show = (el) => {
    const src = el.dataset.pdf;
    const obj = dlg.querySelector('object');
    title.textContent = el.dataset.title || el.textContent.trim();
    // A link to the bank site exists only for official forms; a depositor's form is already fully open.
    orig.hidden = !el.dataset.orig;
    orig.href = el.dataset.orig || '';
    // <object> does not reload data on an open element, so a new one each time.
    const fresh = obj.cloneNode(false);
    fresh.data = `${src}#view=FitH`;
    obj.replaceWith(fresh);
    dlg.showModal();
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-pdf]');
    if (!el || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (wide.matches) show(el);
    else window.open(el.dataset.pdf, '_blank', 'noopener');
  });
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => dlg.querySelector('object').removeAttribute('data'));
})();
