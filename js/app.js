// Arranque de la aplicación.
(async function bootstrap() {
  await DB.init();
  Auth.loadSession();

  // Renderizar shell o login según sesión
  renderShell();
  if (!Auth.isLoggedIn()) {
    location.hash = "#/login";
  } else if (!location.hash || location.hash === "#" || location.hash === "#/login") {
    location.hash = "#/dashboard";
  }
  Router.render();

  // ===== Atajos globales =====
  document.addEventListener("keydown", e => {
    if (!Auth.isLoggedIn()) return;
    const inField = /input|select|textarea/i.test(document.activeElement?.tagName || "");
    if (e.key === "F12" && !location.hash.startsWith("#/pos")) {
      e.preventDefault();
      location.hash = "#/pos";
    }
    else if (e.key === "F8" && !inField) { e.preventDefault(); location.hash = "#/caja"; }
    else if (e.key === "F10" && !inField) { e.preventDefault(); location.hash = "#/dashboard"; }
    else if (e.key === "F5") { /* deja el navegador refrescar */ }
  });

  // ===== Health check + sync periódico =====
  if (DB.isOnline()) {
    const health = await DB.healthCheck();
    if (!health.ok) {
      showHealthBanner(health);
    } else if (Auth.isLoggedIn()) {
      // arrancar sync periódico
      startPeriodicSync();
    }
  }

  // Recarga al volver a la pestaña
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && DB.isOnline() && Auth.isLoggedIn()) {
      refreshFromServer();
    }
  });
})();

let _periodicSync = null;
function startPeriodicSync() {
  if (_periodicSync) clearInterval(_periodicSync);
  _periodicSync = setInterval(refreshFromServer, 60000); // cada 60 segundos
}
window.startPeriodicSync = startPeriodicSync;

let _syncing = false;
async function refreshFromServer() {
  if (_syncing || !DB.isOnline() || !Auth.isLoggedIn()) return;
  // CRÍTICO: si hay cola de push pendiente, NO bajar datos del servidor —
  // sobrescribiríamos cambios locales que aún no han subido (ej: detalles de venta recién hecha).
  try {
    const q = JSON.parse(localStorage.getItem("kam_sync_queue_v1") || "[]");
    if (q.length > 0) {
      console.log("Refresh diferido: hay", q.length, "cambios locales pendientes de subir");
      return;
    }
  } catch (e) {}
  _syncing = true;
  try {
    await DB.syncDownAll();
    if (window.Router) Router.render();
  } catch (e) {
    console.warn("Refresh fallido:", e.message);
  } finally {
    _syncing = false;
  }
}
window.refreshFromServer = refreshFromServer;

function showHealthBanner(health) {
  // Quitar banner previo si existe
  document.getElementById("health-banner")?.remove();
  const div = document.createElement("div");
  div.id = "health-banner";
  const messages = {
    no_spreadsheet_id: {
      title: "⚠️ Falta configurar SPREADSHEET_ID en Apps Script",
      body: `Sin esto la base de datos NO se guarda en Google Sheets — los datos sólo viven en este navegador y no se comparten entre dispositivos.<br>
        <strong>Pasos:</strong> Apps Script → ⚙️ Configuración del proyecto → Propiedades del script → Agregar <code>SPREADSHEET_ID</code> con el ID de tu hoja → Guardar.<br>
        Luego ejecuta la función <code>initDatabase</code> una vez.`
    },
    no_init: {
      title: "⚠️ Apps Script configurado pero base de datos vacía",
      body: "Ejecuta la función <code>initDatabase</code> en Apps Script una sola vez para crear las pestañas y el usuario admin."
    },
    bad_url: {
      title: "⚠️ La URL del Apps Script es inválida",
      body: "Revisa en Configuración que la URL termine en <code>/exec</code> y esté correctamente desplegada como Aplicación web."
    },
    ping_fail: { title: "⚠️ No se puede contactar al servidor", body: "El Apps Script no responde. Revisa tu conexión a internet o si la implementación está activa." },
    server_error: { title: "⚠️ Error del servidor", body: U.escape(health.message) },
    network: { title: "⚠️ Sin conexión a internet", body: "Los cambios se guardarán localmente y se sincronizarán cuando vuelva la conexión." },
    demo_mode: { title: "📴 Modo demo activo", body: "Los datos sólo se guardan en este navegador. Para compartir entre dispositivos, conecta Google Sheets en Configuración." }
  };
  const m = messages[health.code] || { title: "⚠️ Problema con el servidor", body: U.escape(health.message) };
  div.innerHTML = `
    <div style="background:#fef3c7;border-bottom:2px solid #d97706;padding:12px 20px;color:#7c2d12;font-size:13px;line-height:1.5">
      <div style="max-width:1200px;margin:0 auto;display:flex;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <strong>${m.title}</strong>
          <div style="margin-top:4px">${m.body}</div>
        </div>
        <button id="health-banner-close" style="background:transparent;border:1px solid #d97706;color:#7c2d12;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;flex-shrink:0">Cerrar</button>
      </div>
    </div>
  `;
  document.body.insertBefore(div, document.body.firstChild);
  div.querySelector("#health-banner-close").addEventListener("click", () => div.remove());
}
window.showHealthBanner = showHealthBanner;

function renderShell() {
  const app = document.getElementById("app");
  if (!Auth.isLoggedIn()) {
    app.innerHTML = `<div id="app-content"></div>`;
    return;
  }
  const u = Auth.currentUser();
  const initials = (u.nombre || u.username).split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  const nav = [
    { sec: "Principal", items: [
      { path: "/dashboard", label: "Dashboard", ico: "🏠", mod: "dashboard" }
    ]},
    { sec: "Operaciones", items: [
      { path: "/pos", label: "Punto de venta", ico: "💳", mod: "ventas" },
      { path: "/ventas", label: "Ventas (historial)", ico: "🛒", mod: "ventas" },
      { path: "/compras", label: "Compras", ico: "📦", mod: "compras" },
      { path: "/caja", label: "Caja", ico: "💵", mod: "caja" },
      { path: "/egresos", label: "Egresos", ico: "📤", mod: "egresos" }
    ]},
    { sec: "Inventario", items: [
      { path: "/inventario", label: "Stock & Kardex", ico: "📊", mod: "inventario" }
    ]},
    { sec: "Directorio", items: [
      { path: "/productos", label: "Productos", ico: "🏷️", mod: "productos" },
      { path: "/categorias", label: "Categorías", ico: "📁", mod: "categorias" },
      { path: "/clientes", label: "Clientes", ico: "👥", mod: "clientes" },
      { path: "/proveedores", label: "Proveedores", ico: "🏭", mod: "proveedores" },
      { path: "/metodos_pago", label: "Métodos de pago", ico: "💳", mod: "metodos_pago" },
      { path: "/cajas", label: "Cajas", ico: "🗄️", mod: "cajas" }
    ]},
    { sec: "Análisis", items: [
      { path: "/reportes", label: "Reportes", ico: "📈", mod: "reportes" }
    ]},
    { sec: "Sistema", items: [
      { path: "/usuarios", label: "Usuarios", ico: "🔐", mod: "usuarios" },
      { path: "/telegram", label: "Bot Telegram", ico: "🤖", mod: "telegram" },
      { path: "/config", label: "Configuración", ico: "⚙️", mod: "config" }
    ]}
  ];

  const navHtml = nav.map(s => `
    <div class="nav-section">${s.sec}</div>
    ${s.items.filter(i => Auth.can(i.mod, "ver")).map(i => `
      <a class="nav-item" href="#${i.path}">
        <span class="ico">${i.ico}</span>${i.label}
      </a>
    `).join("")}
  `).join("");

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <img src="assets/logo-mark.svg" alt="KAM" class="logo-img">
          <div class="name">${U.escape(APP_CONFIG.appName)}<small>Sistema administrativo</small></div>
        </div>
        <nav>${navHtml}</nav>
        <div style="padding:16px;margin-top:8px">
          <a href="#" id="logout-btn" class="btn btn-ghost" style="width:100%;justify-content:center">Cerrar sesión</a>
        </div>
      </aside>
      <div>
        <div class="topbar">
          <div class="flex">
            <button class="btn btn-ghost menu-btn" id="menu-btn">☰</button>
            <h1 id="page-title">${U.escape(APP_CONFIG.appName)}</h1>
            ${APP_CONFIG.mode === "demo"
              ? '<span class="pill" title="Datos guardados en este navegador">Modo demo</span>'
              : `<span class="pill" id="sync-pill" title="Conectado a Google Sheets">🔄 Sheets</span>
                 <button id="refresh-btn" class="btn btn-sm btn-ghost" title="Actualizar datos desde el servidor (Ctrl+R)" style="padding:4px 10px">🔄</button>`}
          </div>
          <div class="user">
            <div class="user-name">
              <strong>${U.escape(u.nombre || u.username)}</strong>
              <div class="muted" style="font-size:11px">${U.escape(roleName(u.rol_id))}</div>
            </div>
            <div class="avatar">${initials}</div>
          </div>
        </div>
        <main class="content"><div id="app-content"></div></main>
      </div>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", e => {
    e.preventDefault();
    Auth.logout();
    location.hash = "#/login";
    location.reload();
  });
  document.getElementById("menu-btn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // Botón de actualización manual
  document.getElementById("refresh-btn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.style.opacity = "0.5";
    btn.textContent = "⏳";
    try {
      await window.refreshFromServer();
      U.toast("Datos actualizados desde el servidor", "success", 1500);
    } catch (err) {
      U.toast("Error al actualizar: " + err.message, "danger");
    } finally {
      btn.style.opacity = "1";
      btn.textContent = "🔄";
    }
  });

  // Indicador de sincronización
  const syncPill = document.getElementById("sync-pill");
  if (syncPill) {
    const update = () => {
      const s = DB.getStatus();
      if (s.online === false) {
        syncPill.textContent = "⚠️ Sin conexión";
        syncPill.style.background = "#fef3c7";
        syncPill.style.color = "#92400e";
        syncPill.title = "No se pudo contactar Google Sheets — los cambios se guardan localmente y se enviarán cuando vuelva la conexión";
      } else if (s.queueSize > 0) {
        syncPill.textContent = `⏳ Sincronizando (${s.queueSize})`;
        syncPill.style.background = "#fef3c7";
        syncPill.style.color = "#92400e";
        syncPill.title = `${s.queueSize} cambios pendientes de enviar`;
      } else {
        syncPill.textContent = "✓ Sheets";
        syncPill.style.background = "#d1fae5";
        syncPill.style.color = "#065f46";
        syncPill.title = "Conectado a Google Sheets" + (s.lastSync ? " — última sync: " + new Date(s.lastSync).toLocaleTimeString() : "");
      }
    };
    window.addEventListener("kam:sync-status", update);
    update();
    DB.pingServer();
  }
}

function roleName(rolId) {
  const r = DB.get("roles", rolId);
  return r ? r.nombre : "—";
}

window.renderShell = renderShell;
