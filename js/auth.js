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
      try {
        const res = await fetch(APP_CONFIG.apiUrl + "?action=login", {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ username, password })
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch (e) { throw new Error("Respuesta no válida del servidor"); }
        if (!data.ok) throw new Error(data.error || "Error de login");
        const remoteUser = data.data.user;
        const remoteToken = data.data.token;
        session = { token: remoteToken, user: remoteUser };
        saveSession(remember);
        // Sincronizar datos del servidor a local tras el login
        try { await DB.syncDownAll(); } catch (e) { console.warn("Sync inicial fallida:", e.message); }
        // Asegurar que el usuario quede en la cache local
        const dbAfter = DB.getDB();
        if (!dbAfter.usuarios.find(u => Number(u.id) === Number(remoteUser.id))) {
          dbAfter.usuarios.push(remoteUser);
          DB.setDB(dbAfter);
        }
        DB.audit("auth", "login", remoteUser.id, { username, modo: "remoto" });
        return remoteUser;
      } catch (e) {
        // Si el error es de configuración del servidor, mostrarlo claro
        if (/SPREADSHEET_ID/i.test(e.message)) {
          throw new Error("El servidor no está configurado. Falta SPREADSHEET_ID en Apps Script.");
        }
        // Cualquier otro error de red → intentar fallback local sólo para admin original
        console.warn("Login remoto falló:", e.message);
        throw new Error(e.message || "No se pudo conectar al servidor");
      }
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
