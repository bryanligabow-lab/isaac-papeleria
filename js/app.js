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
    // Evitar interferir con typing en inputs (excepto teclas de función F-keys)
    const inField = /input|select|textarea/i.test(document.activeElement?.tagName || "");
    // F12 → punto de venta (si no estamos ya, ir al POS; si estamos, lo maneja el módulo)
    if (e.key === "F12" && !location.hash.startsWith("#/pos")) {
      e.preventDefault();
      location.hash = "#/pos";
    }
    // F8 → caja
    else if (e.key === "F8" && !inField) { e.preventDefault(); location.hash = "#/caja"; }
    // F10 → dashboard
    else if (e.key === "F10" && !inField) { e.preventDefault(); location.hash = "#/dashboard"; }
  });
})();

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
            ${APP_CONFIG.mode === "demo" ? '<span class="pill" title="Datos guardados en este navegador">Modo demo</span>' : ''}
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
}

function roleName(rolId) {
  const r = DB.get("roles", rolId);
  return r ? r.nombre : "—";
}

window.renderShell = renderShell;
