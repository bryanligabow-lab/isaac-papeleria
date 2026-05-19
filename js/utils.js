// Utilidades generales.
const U = {
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },

  nowISO() { return new Date().toISOString(); },

  fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  },

  fmtDateShort(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("es-CO");
  },

  todayStr() { return new Date().toISOString().slice(0, 10); },

  money(n) {
    n = Number(n) || 0;
    return APP_CONFIG.currency + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  num(n) { return Number(n) || 0; },

  pct(n) { return ((Number(n) || 0) * 100).toFixed(1) + "%"; },

  // SHA-256 sencillo para password (browser crypto)
  async sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  },

  // Toast
  toast(msg, type = "info", ms = 3500) {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      document.body.appendChild(host);
    }
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 250);
    }, ms);
  },

  // Confirm modal
  confirm(title, message) {
    return new Promise(resolve => {
      const wrap = document.createElement("div");
      wrap.className = "modal-backdrop";
      wrap.innerHTML = `
        <div class="modal">
          <h3>${U.escape(title)}</h3>
          <p>${U.escape(message)}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-act="no">Cancelar</button>
            <button class="btn btn-danger" data-act="yes">Confirmar</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      wrap.addEventListener("click", e => {
        const act = e.target.dataset.act;
        if (act === "yes") { wrap.remove(); resolve(true); }
        else if (act === "no" || e.target === wrap) { wrap.remove(); resolve(false); }
      });
    });
  },

  prompt(title, label, def = "") {
    return new Promise(resolve => {
      const wrap = document.createElement("div");
      wrap.className = "modal-backdrop";
      wrap.innerHTML = `
        <div class="modal">
          <h3>${U.escape(title)}</h3>
          <label class="lbl">${U.escape(label)}
            <input class="inp" id="__prompt_inp" value="${U.escape(def)}">
          </label>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-act="no">Cancelar</button>
            <button class="btn btn-primary" data-act="yes">Aceptar</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const inp = wrap.querySelector("#__prompt_inp");
      inp.focus(); inp.select();
      wrap.addEventListener("click", e => {
        const act = e.target.dataset.act;
        if (act === "yes") { const v = inp.value; wrap.remove(); resolve(v); }
        else if (act === "no" || e.target === wrap) { wrap.remove(); resolve(null); }
      });
    });
  },

  // Escapado HTML
  escape(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  },

  // Tabla genérica
  table(cols, rows, opts = {}) {
    const head = cols.map(c => `<th>${U.escape(c.label)}</th>`).join("");
    const body = rows.length
      ? rows.map(r => `<tr>${cols.map(c => `<td>${c.render ? c.render(r) : U.escape(r[c.key] ?? "")}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${cols.length}" class="empty">${opts.empty || "Sin registros"}</td></tr>`;
    return `<table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  },

  // Form helpers
  formData(form) {
    const data = {};
    new FormData(form).forEach((v, k) => {
      if (data[k] !== undefined) {
        if (!Array.isArray(data[k])) data[k] = [data[k]];
        data[k].push(v);
      } else data[k] = v;
    });
    return data;
  },

  // Filtros
  applyFilters(rows, filters) {
    return rows.filter(r => {
      for (const [k, v] of Object.entries(filters)) {
        if (v === "" || v === null || v === undefined) continue;
        if (k === "_from") { if (new Date(r.fecha || r.created_at) < new Date(v)) return false; continue; }
        if (k === "_to") { if (new Date(r.fecha || r.created_at) > new Date(v + "T23:59:59")) return false; continue; }
        if (k === "_search") {
          const s = String(v).toLowerCase();
          const hit = Object.values(r).some(x => String(x ?? "").toLowerCase().includes(s));
          if (!hit) return false;
          continue;
        }
        if (String(r[k] ?? "") !== String(v)) return false;
      }
      return true;
    });
  },

  // Descargar archivo
  download(filename, content, mime = "text/plain") {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // Exportar a CSV (excel-friendly)
  exportCSV(filename, rows, cols) {
    const head = cols.map(c => `"${(c.label || c.key).replaceAll('"', '""')}"`).join(",");
    const body = rows.map(r => cols.map(c => {
      const v = c.export ? c.export(r) : (r[c.key] ?? "");
      return `"${String(v).replaceAll('"', '""')}"`;
    }).join(",")).join("\n");
    const csv = "\uFEFF" + head + "\n" + body; // BOM para Excel
    U.download(filename, csv, "text/csv;charset=utf-8");
  },

  // Exportar a PDF (vía window.print con plantilla)
  exportPDF(title, html) {
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>${U.escape(title)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#222}
        h1{font-size:18px;margin:0 0 16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ccc;padding:6px;text-align:left}
        th{background:#f0f0f0}
        .meta{color:#666;font-size:11px;margin-bottom:12px}
      </style></head><body>
      <h1>${U.escape(title)}</h1>
      <div class="meta">${U.escape(APP_CONFIG.appName)} — Generado: ${new Date().toLocaleString()}</div>
      ${html}
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>
    `);
    w.document.close();
  }
};

window.U = U;
