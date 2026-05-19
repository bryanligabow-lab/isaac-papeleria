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

        <h3 style="margin-top:24px">🔗 Conexión Google Sheets</h3>
        <div id="sync-status-box" style="padding:14px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border);margin-bottom:12px">Verificando conexión…</div>
        <div class="grid grid-2">
          <label class="lbl">URL Apps Script <input class="inp" id="api-url" value="${U.escape(APP_CONFIG.apiUrl || "")}" placeholder="https://script.google.com/macros/s/.../exec"></label>
          <label class="lbl">Modo
            <select class="sel" id="api-mode">
              <option value="demo" ${APP_CONFIG.mode === "demo" ? "selected" : ""}>Demo (sin servidor)</option>
              <option value="production" ${APP_CONFIG.mode === "production" ? "selected" : ""}>Producción (Sheets)</option>
            </select>
          </label>
        </div>
        <div class="flex" style="gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn btn-ghost" id="btn-save-api">Guardar URL</button>
          <button class="btn" id="btn-ping">🔍 Probar conexión</button>
          <button class="btn btn-primary" id="btn-sync-up">🔼 Subir todo a Sheets</button>
          <button class="btn btn-warning" id="btn-sync-down">🔽 Bajar todo de Sheets</button>
        </div>
        <div id="sync-progress" style="margin-top:12px;display:none">
          <div style="background:var(--surface-2);border-radius:6px;height:10px;overflow:hidden">
            <div id="sync-bar" style="background:var(--accent);height:100%;width:0%;transition:width .2s"></div>
          </div>
          <div id="sync-msg" class="muted" style="font-size:12px;margin-top:6px"></div>
        </div>

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
      APP_CONFIG.apiUrl = url;
      APP_CONFIG.mode = mode;
      U.toast("Guardado. Recarga la página.", "success");
    });

    // === Sync UI ===
    const statusBox = host.querySelector("#sync-status-box");
    const progressBox = host.querySelector("#sync-progress");
    const progressBar = host.querySelector("#sync-bar");
    const progressMsg = host.querySelector("#sync-msg");

    async function refreshStatus() {
      if (!DB.isOnline()) {
        statusBox.innerHTML = '<strong>📴 Modo demo</strong><br><span class="muted">Los datos sólo se guardan en este navegador. Configura la URL del Apps Script para conectar Google Sheets.</span>';
        return;
      }
      statusBox.innerHTML = '⏳ Probando conexión con Google Sheets…';
      const ok = await DB.pingServer();
      const s = DB.getStatus();
      if (ok) {
        statusBox.innerHTML = `<strong style="color:var(--success)">🟢 Conectado a Google Sheets</strong><br>
          <span class="muted">URL: <code style="font-size:11px">${U.escape(APP_CONFIG.apiUrl.slice(0,60))}…</code></span><br>
          <span class="muted">Cambios pendientes en cola: <strong>${s.queueSize}</strong> · Última sync: ${s.lastSync ? new Date(s.lastSync).toLocaleString() : "—"}</span>`;
      } else {
        statusBox.innerHTML = '<strong style="color:var(--danger)">🔴 No se puede conectar</strong><br><span class="muted">Verifica que la URL del Apps Script sea correcta, esté desplegada como "Aplicación web" con acceso "Cualquier persona", y que hayas ejecutado <code>initDatabase</code>.</span>';
      }
    }
    refreshStatus();

    host.querySelector("#btn-ping").addEventListener("click", refreshStatus);

    host.querySelector("#btn-sync-up").addEventListener("click", async () => {
      if (!DB.isOnline()) return U.toast("Configura la URL primero", "warning");
      if (!await U.confirm("Subir a Sheets",
        "Esto sube TODA la información local (productos, ventas, compras, caja, usuarios, etc) a Google Sheets. Los registros con el mismo ID se actualizarán. Puede tardar 1-2 minutos. ¿Continuar?")) return;
      progressBox.style.display = "block";
      progressBar.style.width = "0%";
      try {
        const result = await DB.syncUpAll((done, total, table, errors) => {
          progressBar.style.width = (done / total * 100) + "%";
          progressMsg.textContent = `${done}/${total} — ${table}` + (errors ? ` · ⚠️ ${errors} errores` : "");
        });
        progressMsg.textContent = `✅ Subida completa (${result.done}/${result.total}` + (result.errors ? ` · ${result.errors} errores` : "") + ")";
        U.toast(`Subidos ${result.done} registros a Sheets`, "success");
        refreshStatus();
      } catch (e) {
        progressMsg.textContent = "❌ Error: " + e.message;
        U.toast("Error: " + e.message, "danger");
      }
    });

    host.querySelector("#btn-sync-down").addEventListener("click", async () => {
      if (!DB.isOnline()) return U.toast("Configura la URL primero", "warning");
      if (!await U.confirm("Bajar de Sheets",
        "Esto REEMPLAZA todos los datos locales con lo que está en Google Sheets. Los cambios locales no sincronizados se perderán. ¿Continuar?")) return;
      progressBox.style.display = "block";
      progressBar.style.width = "0%";
      try {
        await DB.syncDownAll((done, total, table) => {
          progressBar.style.width = (done / total * 100) + "%";
          progressMsg.textContent = `${done}/${total} — ${table}`;
        });
        progressMsg.textContent = "✅ Datos descargados";
        U.toast("Datos sincronizados desde Sheets", "success");
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        progressMsg.textContent = "❌ Error: " + e.message;
        U.toast("Error: " + e.message, "danger");
      }
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
