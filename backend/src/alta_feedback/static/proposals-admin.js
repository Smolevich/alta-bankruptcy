// Админка предложений: вход — Cloudflare Access перед этой страницей; его cookie браузер шлёт сам.
(() => {
  const $ = (id) => document.getElementById(id);
  const labels = JSON.parse($("labels").textContent);
  const RELOGIN = "Вход истёк или не выполнен — обновите страницу, чтобы войти заново.";
  let items = [];

  function say(text, isError) {
    $("msg").textContent = text;
    $("msg").className = isError ? "msg err" : "msg";
  }

  async function api(path, options = {}) {
    let response;
    try {
      // manual: истёкшая сессия Access отвечает переходом на свою страницу входа, а не данными.
      response = await fetch(path, { ...options, cache: "no-store", redirect: "manual" });
    } catch {
      throw new Error(RELOGIN);
    }
    if (response.type === "opaqueredirect" || response.status === 401 || response.status === 403) {
      throw new Error(RELOGIN);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  function day(iso) {
    return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${iso.slice(11, 16)} UTC`;
  }

  function link(url) {
    const a = document.createElement("a");
    a.href = url; a.textContent = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    return a;
  }

  function fill(row, item) {
    const f = (name) => row.querySelector(`[data-f="${name}"]`);
    f("title").textContent = item.title;
    f("meta").textContent = `№${item.id} · ${day(item.created_at)} · ${labels.targets[item.target] || item.target}`;
    f("contact").textContent = item.contact || "—";
    f("text").textContent = item.text;
    f("text").hidden = !item.text;
    if (item.doc_url) f("doc").append("Документ: ", link(item.doc_url));
    for (const source of item.sources) {
      const li = document.createElement("li");
      li.append(/^https?:\/\//.test(source) ? link(source) : source);
      f("sources").append(li);
    }
    const form = row.querySelector("form");
    for (const name of ["status", "review_url", "published_url", "comment"]) form.elements[name].value = item[name] || "";
    row.classList.toggle("is-new", item.status === "new");
    form.addEventListener("submit", (event) => save(event, item, row));
  }

  async function save(event, item, row) {
    event.preventDefault();
    const form = event.target;
    const note = row.querySelector('[data-f="saved"]');
    const changes = Object.fromEntries(
      ["status", "review_url", "published_url", "comment"].map((name) => [name, form.elements[name].value.trim()]),
    );
    note.className = "saved"; note.textContent = "Сохраняю…";
    try {
      await api(`/admin/proposals/${item.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
      });
      Object.assign(item, changes);
      row.classList.toggle("is-new", item.status === "new");
      note.textContent = "Сохранено";
      counts();
    } catch (error) {
      note.className = "saved err"; note.textContent = error.message;
    }
  }

  function counts() {
    $("new-count").textContent = items.filter((item) => item.status === "new").length;
    $("total").textContent = items.length;
    $("count").hidden = false;
  }

  function render() {
    const status = $("filter").value;
    const rows = $("rows");
    rows.replaceChildren();
    const shown = items.filter((item) => !status || item.status === status).reverse();
    for (const item of shown) {
      const row = $("row-tpl").content.firstElementChild.cloneNode(true);
      fill(row, item);
      rows.append(row);
    }
    say(shown.length ? "" : "Ничего нет.");
  }

  async function load() {
    say("Загружаю…");
    try {
      items = (await api("/admin/proposals")).items;
    } catch (error) {
      say(error.message, true);
      return;
    }
    $("panel").hidden = false;
    counts();
    render();
  }

  $("filter").addEventListener("change", render);
  $("reload").addEventListener("click", load);
  load();
})();
