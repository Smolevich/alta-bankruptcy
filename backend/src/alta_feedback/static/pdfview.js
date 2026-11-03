// Просмотр PDF на странице, как на справочнике (PdfDialog): любой элемент с data-pdf открывает диалог.
// На узком экране встроенный просмотр неудобен (iOS показывает одну страницу) — PDF открывается вкладкой.
// Без скрипта ссылка просто ведёт на PDF.
(() => {
  // Ссылка «Бланки ↓» ведёт к свёрнутому блоку банка — раскрываем его.
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
    // Ссылка на сайт банка — только у официальных бланков; бланк от вкладчика и так открыт целиком.
    orig.hidden = !el.dataset.orig;
    orig.href = el.dataset.orig || '';
    // <object> не перечитывает data на открытом элементе, поэтому каждый раз новый.
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
