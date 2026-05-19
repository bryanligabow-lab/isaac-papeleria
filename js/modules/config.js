// Configuración general del sistema.
Router.register("/config", async (host) => {
  document.getElementById("page-title").textContent = "Configuración";

  function render() {
    const cfg = DB.list("config");
    host.innerHTML = `
      <div class="page">
        <div class="page-header">
          <h2>Configuración del sistema</h2>
          <div class="actions">
            <button class="btn btn-primary" id="btn-load-catalog">📦 Cargar catálogo KAM (62 productos)</button>
            <button class="btn btn-warning" id="btn-reset">Reiniciar todo</button>
            <button class="btn" id="btn-export-db">⬇ Backup JSON</button>
            <button class="btn" id="btn-import-db">⬆ Restaurar JSON</button>
          </div>
        </div>
        <h3>Parámetros</h3>
        <form id="frm-cfg">
          <div class="grid grid-2">
            ${cfg.map(c => `<label class="lbl">${U.escape(c.descripcion || c.clave)}<input class="inp" name="${c.clave}" value="${U.escape(c.valor || "")}"></label>`).join("")}
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>

        <h3 style="margin-top:24px">Conexión API (modo producción)</h3>
        <p class="muted">Para conectar a Google Sheets vía Apps Script, pega aquí la URL <code>/exec</code> de tu Apps Script desplegado.</p>
        <div class="grid grid-2">
          <label class="lbl">URL Apps Script <input class="inp" id="api-url" value="${U.escape(APP_CONFIG.apiUrl || "")}" placeholder="https://script.google.com/macros/s/.../exec"></label>
          <label class="lbl">Modo
            <select class="sel" id="api-mode">
              <option value="demo" ${APP_CONFIG.mode === "demo" ? "selected" : ""}>Demo (localStorage)</option>
              <option value="production" ${APP_CONFIG.mode === "production" ? "selected" : ""}>Producción (API)</option>
            </select>
          </label>
        </div>
        <button class="btn btn-primary" id="btn-save-api">Guardar conexión</button>

        <h3 style="margin-top:24px">Auditoría</h3>
        <p class="muted">Últimos 50 eventos del sistema.</p>
        <div id="audit-list"></div>
      </div>
    `;

    host.querySelector("#frm-cfg").addEventListener("submit", e => {
      e.preventDefault();
      const data = U.formData(e.target);
      const db = DB.getDB();
      db.config.forEach(c => { if (data[c.clave] !== undefined) c.valor = data[c.clave]; });
      DB.setDB(db);
      U.toast("Configuración guardada", "success");
    });

    host.querySelector("#btn-reset").addEventListener("click", async () => {
      if (await U.confirm("Reiniciar", "Esto borrará TODOS los datos locales (usuarios, ventas, compras, etc) y volverá a sembrar el sistema desde cero. ¿Continuar?")) {
        await DB.resetDemo();
        location.reload();
      }
    });

    host.querySelector("#btn-load-catalog").addEventListener("click", async () => {
      if (!await U.confirm("Cargar catálogo KAM",
        "Esto eliminará los productos actuales, sus categorías y movimientos de inventario, y cargará el catálogo completo de KAM Papelería (62 productos con stock inicial). NO afecta ventas, compras, caja, ni usuarios. ¿Continuar?"
      )) return;

      const db = DB.getDB();
      const hayMovs = (db.ventas?.length || 0) + (db.compras?.length || 0) > 0;
      if (hayMovs && !await U.confirm("Atención", "Detectamos ventas o compras existentes. Si las cargaste con los productos antiguos quedarán referenciando productos inexistentes. Te recomiendo usar 'Reiniciar todo'. ¿Aún así quieres cargar el catálogo?")) return;

      DB.loadKamCatalog();
      U.toast(`Catálogo KAM cargado (${DB.KAM_PRODUCTOS.length} productos)`, "success");
      setTimeout(() => location.reload(), 600);
    });

    host.querySelector("#btn-export-db").addEventListener("click", () => {
      U.download(`isaac_papeleria_backup_${U.todayStr()}.json`, JSON.stringify(DB.getDB(), null, 2), "application/json");
    });
    host.querySelector("#btn-import-db").addEventListener("click", async () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "application/json";
      input.onchange = async () => {
        const f = input.files[0]; if (!f) return;
        if (!await U.confirm("Restaurar", "¿Sobrescribir todos los datos actuales con este backup?")) return;
        const text = await f.text();
        try {
          const data = JSON.parse(text);
          DB.setDB(data);
          U.toast("Backup restaurado", "success");
          setTimeout(() => location.reload(), 800);
        } catch (e) { U.toast("Archivo inválido", "danger"); }
      };
      input.click();
    });

    host.querySelector("#btn-save-api").addEventListener("click", () => {
      const url = host.querySelector("#api-url").value.trim();
      const mode = host.querySelector("#api-mode").value;
      localStorage.setItem("isaac_api_url", url);
      localStorage.setItem("isaac_api_mode", mode);
      U.toast("Guardado. Recarga la página.", "success");
    });

    const audits = DB.list("auditoria").slice(-50).reverse();
    host.querySelector("#audit-list").innerHTML = U.table([
      { key: "fecha", label: "Fecha", render: r => U.fmtDate(r.fecha) },
      { key: "user", label: "Usuario", render: r => U.escape(DB.get("usuarios", r.usuario_id)?.username || "—") },
      { key: "modulo", label: "Módulo" },
      { key: "accion", label: "Acción" },
      { key: "entidad_id", label: "ID" },
      { key: "detalle_json", label: "Detalle", render: r => `<code style="font-size:11px">${U.escape((r.detalle_json || "").slice(0,120))}</code>` }
    ], audits);
  }

  // override config from localStorage at load
  const savedUrl = localStorage.getItem("isaac_api_url");
  const savedMode = localStorage.getItem("isaac_api_mode");
  if (savedUrl !== null) APP_CONFIG.apiUrl = savedUrl;
  if (savedMode) APP_CONFIG.mode = savedMode;

  render();
}, { module: "config" });
