// Autenticación y permisos.
const Auth = (() => {
  let session = null; // { token, user }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(APP_CONFIG.sessionKey) || localStorage.getItem(APP_CONFIG.sessionKey);
      if (raw) session = JSON.parse(raw);
    } catch (e) {}
    return session;
  }

  function saveSession(persist = true) {
    const target = persist ? localStorage : sessionStorage;
    target.setItem(APP_CONFIG.sessionKey, JSON.stringify(session));
  }

  function clear() {
    session = null;
    localStorage.removeItem(APP_CONFIG.sessionKey);
    sessionStorage.removeItem(APP_CONFIG.sessionKey);
  }

  async function login(username, password, remember = true) {
    // Modo producción: autenticar contra Google Sheets (Apps Script)
    if (APP_CONFIG.mode === "production" && APP_CONFIG.apiUrl) {
      // 1. Descargar usuarios del servidor primero (GET, confiable)
      let serverUsers;
      try {
        const url = APP_CONFIG.apiUrl + "?action=list&table=usuarios";
        const res = await fetch(url, { method: "GET" });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch (e) {
          if (text.includes("SPREADSHEET_ID")) {
            throw new Error("El servidor no está configurado. Falta SPREADSHEET_ID en Apps Script.");
          }
          throw new Error("El servidor no devolvió una respuesta válida");
        }
        if (!data.ok) throw new Error(data.error || "Error consultando usuarios");
        serverUsers = data.data || [];
      } catch (e) {
        if (/SPREADSHEET_ID/i.test(e.message)) throw e;
        throw new Error("No se pudo conectar al servidor: " + e.message);
      }

      // 2. Buscar usuario y validar contraseña localmente (evita problemas de POST/redirect)
      const u = serverUsers.find(x => x.username === username && (x.activo === true || x.activo === "true" || x.activo === "TRUE" || x.activo === 1));
      if (!u) throw new Error("Usuario no encontrado en el servidor");
      const hash = await U.sha256(password + u.salt);
      if (hash !== u.password_hash) throw new Error("Contraseña incorrecta");

      // 3. Crear sesión local
      session = { token: U.uid(), user: u };
      saveSession(remember);

      // 4. Sincronizar TODOS los datos del servidor a local
      try {
        await DB.syncDownAll();
      } catch (e) {
        console.warn("Sync inicial fallida:", e.message);
        U.toast("Login OK, pero sync de datos parcial. Pulsa 🔄 para reintentar.", "warning", 5000);
      }
      // Asegurar que el usuario quede en la cache local
      const dbAfter = DB.getDB();
      if (!dbAfter.usuarios.find(uu => Number(uu.id) === Number(u.id))) {
        dbAfter.usuarios.push(u);
        DB.setDB(dbAfter);
      }
      DB.audit("auth", "login", u.id, { username, modo: "remoto" });
      return u;
    }

    // Modo demo: autenticar contra localStorage
    const users = DB.list("usuarios");
    const u = users.find(x => x.username === username && x.activo);
    if (!u) throw new Error("Usuario no encontrado");
    const hash = await U.sha256(password + u.salt);
    if (hash !== u.password_hash) throw new Error("Contraseña incorrecta");
    session = { token: U.uid(), user: u };
    saveSession(remember);
    DB.audit("auth", "login", u.id, { username });
    return u;
  }

  function logout() {
    if (session?.user) DB.audit("auth", "logout", session.user.id, {});
    clear();
  }

  function currentUser() { return session?.user || null; }
  function token() { return session?.token || null; }
  function isLoggedIn() { return !!session?.user; }

  function can(modulo, accion = "ver") {
    const u = currentUser();
    if (!u) return false;
    // admin (rol 1) tiene todo
    if (u.rol_id === 1) return true;
    const permisos = DB.list("permisos");
    const rp = DB.list("roles_permisos", { rol_id: u.rol_id });
    const allowed = rp.some(x => {
      const p = permisos.find(pp => pp.id === x.permiso_id);
      return p && p.modulo === modulo && p.accion === accion;
    });
    return allowed;
  }

  async function changePassword(userId, newPassword) {
    const salt = U.uid();
    const hash = await U.sha256(newPassword + salt);
    DB.update("usuarios", userId, { password_hash: hash, salt });
  }

  return {
    loadSession, login, logout, currentUser, token, isLoggedIn, can, changePassword
  };
})();

window.Auth = Auth;
