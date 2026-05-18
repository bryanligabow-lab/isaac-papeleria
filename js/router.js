// Router por hash.
const Router = (() => {
  const routes = {};

  function register(path, handler, opts = {}) {
    routes[path] = { handler, opts };
  }

  async function go(path) {
    if (location.hash !== "#" + path) {
      location.hash = "#" + path;
    } else {
      render();
    }
  }

  async function render() {
    const raw = location.hash.slice(1) || "/dashboard";
    const [path, query] = raw.split("?");
    const params = Object.fromEntries(new URLSearchParams(query || ""));
    const r = routes[path];
    const app = document.getElementById("app-content");

    if (!Auth.isLoggedIn() && path !== "/login") {
      location.hash = "#/login";
      return;
    }
    if (Auth.isLoggedIn() && path === "/login") {
      location.hash = "#/dashboard";
      return;
    }
    if (!r) {
      app.innerHTML = `<div class="page"><h1>404</h1><p>Ruta no encontrada: ${U.escape(path)}</p></div>`;
      return;
    }
    if (r.opts.module && !Auth.can(r.opts.module, r.opts.action || "ver")) {
      app.innerHTML = `<div class="page"><h1>403</h1><p>No tienes permiso para ver este módulo.</p></div>`;
      return;
    }

    // marcar nav activo
    document.querySelectorAll(".nav-item").forEach(a => {
      a.classList.toggle("active", a.getAttribute("href") === "#" + path);
    });

    try {
      await r.handler(app, params);
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="page"><h1>Error</h1><pre>${U.escape(e.message || e)}</pre></div>`;
    }
  }

  window.addEventListener("hashchange", render);

  return { register, go, render };
})();

window.Router = Router;
