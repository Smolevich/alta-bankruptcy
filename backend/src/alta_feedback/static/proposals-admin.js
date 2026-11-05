// Админка предложений: вход — Cloudflare Access перед этой страницей, его cookie браузер шлёт сам.
// Пока на сервере Access не настроен, страница показывает поле токена (он живёт только в sessionStorage).
(() => {
  const KEY = "alta-admin-token";
  const $ = (id) => document.getElementById(id);
  const labels = JSON.parse($("labels").textContent);
  const login = $("login");
  const RELOGIN = "Вход истёк или не выполнен — обновите страницу, чтобы войти заново.";
  let items = [];
  let kind = "material";
  const blobUrls = [];

  const storage = {
    get() { try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; } },
    set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* приватный режим: токен живёт до перезагрузки */ } },
    clear() { try { sessionStorage.removeItem(KEY); } catch { /* нечего чистить */ } },
  };
  let token = login ? storage.get() : "";

  function say(text, isError) {
    $("msg").textContent = text;
    $("msg").className = isError ? "msg err" : "msg";
  }

  async function api(path, options = {}) {
    let response;
    try {
      // manual: истёкшая сессия Access отвечает переходом на свою страницу входа, а не данными.
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
      response = await fetch(path, { ...options, headers, cache: "no-store", redirect: "manual" });
    } catch {
      throw new Error(RELOGIN);
    }
    if (login && response.status === 401) {
      token = ""; storage.clear(); login.hidden = false; $("panel").hidden = true;
      throw new Error("Токен не подошёл.");
    }
    if (response.type === "opaqueredirect" || response.status === 401 || response.status === 403) {
      throw new Error(RELOGIN);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  // Файлы кейсов закрыты так же, как список: берём их тем же запросом с входом, а показываем из blob.
  async function fileUrl(name) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`/admin/proposals/cases/files/${encodeURIComponent(name)}`, {
      headers, cache: "no-store", redirect: "manual",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    blobUrls.push(url);
    return url;
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
    // text_html и edited_text сервер отдаёт уже очищенными (richtext.py) — только разрешённые теги.
    f("text").innerHTML = item.text_html;
    f("text").hidden = !item.text_html;
    redactor(row, item);
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

  function showEdited(row, item) {
    const f = (name) => row.querySelector(`[data-f="${name}"]`);
    f("edited").innerHTML = item.edited_text || item.text_html;
    f("edited-tag").textContent = item.edited_text ? "правка редактора" : "как у автора";
    f("edit-reset").hidden = !item.edited_text;
  }

  // Редактор поднимается только по кнопке: на сотню строк сотня редакторов не нужна.
  function redactor(row, item) {
    const f = (name) => row.querySelector(`[data-f="${name}"]`);
    let editor = null;
    showEdited(row, item);
    f("edit").addEventListener("click", () => {
      if (editor || !window.AltaRichText) return;
      f("edited-input").value = item.edited_text || item.text_html;
      f("edited").hidden = true;
      editor = window.AltaRichText.mount(f("edited-input"), { format: "html" });
      f("edit").hidden = true;
      f("edit-save").hidden = false;
    });
    const send = async (value) => {
      const note = f("edit-note");
      note.className = "saved"; note.textContent = "Сохраняю…";
      try {
        const body = await api(`/admin/proposals/${item.id}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ edited_text: value }),
        });
        item.edited_text = body.edited_text;
        if (editor) { editor.destroy(); editor = null; row.querySelector(".rt").remove(); }
        f("edited").hidden = false; f("edit").hidden = false; f("edit-save").hidden = true;
        showEdited(row, item);
        note.textContent = "Сохранено";
      } catch (error) {
        note.className = "saved err"; note.textContent = error.message;
      }
    };
    f("edit-save").addEventListener("click", () => send(f("edited-input").value));
    f("edit-reset").addEventListener("click", () => send(""));
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

  function fillCase(row, item) {
    const f = (name) => row.querySelector(`[data-f="${name}"]`);
    f("category").textContent = labels.categories[item.category] || item.category;
    f("meta").textContent = `№${item.id} · ${day(item.created_at)} · событие ${item.event_date}`;
    f("contact").textContent = item.contact || "—";
    f("summary").textContent = item.summary;
    f("filed").textContent = item.filed || "—";
    f("result").textContent = item.result;
    if (item.own_url) f("own").append("Своя страница: ", link(item.own_url));
    for (const source of item.sources) {
      const li = document.createElement("li");
      li.append(/^https?:\/\//.test(source) ? link(source) : source);
      f("sources").append(li);
    }
    for (const file of item.files) {
      if (file.kind === "image") {
        const img = document.createElement("img");
        img.alt = "Фото к кейсу";
        fileUrl(file.name).then((url) => {
          img.src = url;
          img.addEventListener("click", () => window.open(url, "_blank", "noopener"));
        }).catch(() => { img.alt = "не загрузилось"; });
        f("files").append(img);
      } else {
        const button = document.createElement("button");
        button.type = "button"; button.className = "ghost"; button.textContent = "PDF ↓";
        button.addEventListener("click", async () => {
          const a = document.createElement("a");
          a.href = await fileUrl(file.name); a.download = file.name; a.click();
        });
        f("files").append(button);
      }
    }
    const form = row.querySelector("form");
    form.elements.status.value = item.status;
    form.elements.published.checked = Boolean(item.published);
    form.elements.files_published.checked = Boolean(item.files_published);
    form.elements.own_url.value = item.own_url || "";
    form.elements.comment.value = item.comment || "";
    row.classList.toggle("is-new", item.status === "new");
    form.addEventListener("submit", (event) => saveCase(event, item, row));
    f("delete").addEventListener("click", () => removeCase(item, row));
  }

  async function saveCase(event, item, row) {
    event.preventDefault();
    const form = event.target;
    const note = row.querySelector('[data-f="saved"]');
    const changes = {
      status: form.elements.status.value,
      published: form.elements.published.checked,
      files_published: form.elements.files_published.checked,
      own_url: form.elements.own_url.value.trim(),
      comment: form.elements.comment.value.trim(),
    };
    note.className = "saved"; note.textContent = "Сохраняю…";
    try {
      await api(`/admin/proposals/cases/${item.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
      });
      Object.assign(item, changes);
      row.classList.toggle("is-new", item.status === "new");
      note.textContent = item.status !== "accepted" && item.published ? "Сохранено; в ленте — только после «принят»" : "Сохранено";
      counts();
    } catch (error) {
      note.className = "saved err"; note.textContent = error.message;
    }
  }

  async function removeCase(item, row) {
    if (!window.confirm(`Удалить кейс №${item.id} вместе с файлами? Это необратимо.`)) return;
    try {
      await api(`/admin/proposals/cases/${item.id}`, { method: "DELETE" });
      items = items.filter((other) => other !== item);
      row.remove();
      counts();
    } catch (error) {
      row.querySelector('[data-f="saved"]').textContent = error.message;
    }
  }

  function counts() {
    $("new-count").textContent = items.filter((item) => item.status === "new").length;
    $("total").textContent = items.length;
    $("count").hidden = false;
  }

  function render() {
    const status = $(kind === "case" ? "case-filter" : "filter").value;
    const rows = $("rows");
    rows.replaceChildren();
    for (const url of blobUrls.splice(0)) URL.revokeObjectURL(url);
    const shown = items.filter((item) => !status || item.status === status).reverse();
    for (const item of shown) {
      const row = $(kind === "case" ? "case-tpl" : "row-tpl").content.firstElementChild.cloneNode(true);
      (kind === "case" ? fillCase : fill)(row, item);
      rows.append(row);
    }
    say(shown.length ? "" : "Ничего нет.");
  }

  async function load() {
    say("Загружаю…");
    try {
      items = (await api(kind === "case" ? "/admin/proposals/cases" : "/admin/proposals")).items;
    } catch (error) {
      say(error.message, true);
      return;
    }
    if (login) login.hidden = true;
    $("panel").hidden = false;
    counts();
    render();
  }

  $("filter").addEventListener("change", render);
  $("case-filter").addEventListener("change", render);
  function chooseKind() {
    kind = $("kind").value;
    $("filter").hidden = kind === "case";
    $("case-filter").hidden = kind !== "case";
    $("heading").textContent = kind === "case" ? "Кейсы" : "Предложения";
  }
  $("kind").addEventListener("change", () => { chooseKind(); items = []; load(); });
  // ?type=case — сразу на кейсы: ссылку удобно держать в закладках.
  if (new URLSearchParams(window.location.search).get("type") === "case") {
    $("kind").value = "case";
    chooseKind();
  }
  $("reload").addEventListener("click", load);
  if (login) {
    login.addEventListener("submit", (event) => {
      event.preventDefault();
      token = $("token").value.trim();
      $("token").value = "";
      storage.set(token);
      load();
    });
    if (token) load();
  } else {
    load();
  }
})();
