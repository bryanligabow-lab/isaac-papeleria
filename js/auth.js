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
