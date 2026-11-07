// Админка отметок очереди: свежие отметки по источникам и кнопка «снять все отметки этого источника».
// Токен живёт только в sessionStorage этой вкладки.
(() => {
  const KEY = "alta-admin-token";
  const FRESH_MS = 2 * 60 * 60 * 1000;
  const STATES = { none: "очереди нет", few: "несколько человек", full: "полный зал", outside: "на улице" };
  const $ = (id) => document.getElementById(id);
  const storage = {
    get() { try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; } },
    set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* приватный режим */ } },
    clear() { try { sessionStorage.removeItem(KEY); } catch { /* нечего чистить */ } },
  };
  let token = storage.get();
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  const nearText = (v) => (v === 1 ? "рядом" : v === 0 ? "далеко" : "без геолокации");

  async function api(path, options = {}) {
    const res = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    if (res.status === 401) { token = ""; storage.clear(); $("login").hidden = false; throw new Error("Токен не подошёл"); }
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  }

  async function load() {
    $("login").hidden = true;
    const since = new Date(Date.now() - FRESH_MS).toISOString().replace(/\.\d+Z$/, "Z");
    try {
      const data = await api(`/admin/queue?since=${encodeURIComponent(since)}&limit=500`, { headers: { Accept: "application/json" } });
      render(data.items);
    } catch (e) { $("msg").textContent = e.message; }
  }

  function render(items) {
    const groups = new Map();
    for (const it of items) { if (!groups.has(it.source)) groups.set(it.source, []); groups.get(it.source).push(it); }
    const box = $("rows");
    box.replaceChildren();
    $("msg").textContent = `Отметок: ${items.length}, источников: ${groups.size}`;
    for (const [source, rows] of groups) {
      const card = el("section", "", "src");
      const head = el("div", "", "src-head");
      const title = el("span");
      title.append("Источник ", el("code", source.slice(0, 12)), ` · отметок: ${rows.length}`);
      const hidden = rows.every((r) => r.status === "spam");
      const btn = el("button", hidden ? "Сняты" : "Снять все отметки этого источника");
      btn.type = "button";
      btn.disabled = hidden;
      btn.addEventListener("click", async () => {
        if (!confirm(`Снять все отметки источника ${source.slice(0, 12)}? Они уйдут в спам и пропадут с карты.`)) return;
        btn.disabled = true;
        try { const r = await api(`/admin/queue/source/${encodeURIComponent(source)}/hide`, { method: "POST" }); $("msg").textContent = `Снято отметок: ${r.hidden}`; await load(); }
        catch (e) { btn.disabled = false; $("msg").textContent = e.message; }
      });
      head.append(title, btn);
      const list = el("ul");
      for (const r of rows) {
        const li = el("li");
        const near = el("span", nearText(r.near), r.near === 1 ? "near" : "muted");
        li.append(`${r.created_at.slice(11, 16)} UTC · отделение ${r.branch_id} · ${STATES[r.state] || r.state} · `, near, ` · ${r.status}${r.comment ? ` · «${r.comment}»` : ""}`);
        list.append(li);
      }
      card.append(head, list);
      box.append(card);
    }
  }

  $("login").addEventListener("submit", (ev) => {
    ev.preventDefault();
    token = $("token").value.trim();
    $("token").value = "";
    storage.set(token);
    load();
  });
  if (token) load();
})();
