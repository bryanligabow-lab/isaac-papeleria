// Pantalla de login.
Router.register("/login", async (host) => {
  host.parentElement.parentElement?.replaceWith?.(host.parentElement.parentElement);
  host.innerHTML = `
    <div class="login-wrap">
      <form class="login-card" id="login-form">
        <div style="text-align:center;margin-bottom:8px">
          <img src="assets/logo.svg" alt="KAM Papelería" style="max-width:200px;height:auto">
        </div>
        <p class="sub" style="text-align:center;margin-top:0">Sistema administrativo · Inicia sesión</p>
        <label class="lbl">Usuario
          <input class="inp" name="username" value="admin" autocomplete="username" required>
        </label>
        <label class="lbl">Contraseña
          <input class="inp" name="password" type="password" value="admin123" autocomplete="current-password" required>
        </label>
        <label class="lbl flex" style="gap:6px;align-items:center">
          <input type="checkbox" name="remember" checked> Recordarme
        </label>
        <button class="btn btn-primary" type="submit">Entrar</button>
        <div class="demo-note">${APP_CONFIG.mode === "demo" ? "Modo demo · datos en este navegador" : "Conectado a la API"}<br>Por defecto: <strong>admin / admin123</strong></div>
      </form>
    </div>
  `;
  // En login no queremos shell
  document.getElementById("app").innerHTML = "";
  document.getElementById("app").appendChild(host);

  document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const d = U.formData(e.target);
    try {
      const submitBtn = e.target.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.textContent = APP_CONFIG.mode === "production" ? "Verificando con servidor..." : "Entrando...";
      await Auth.login(d.username, d.password, !!d.remember);
      U.toast("Bienvenido, " + (Auth.currentUser().nombre || Auth.currentUser().username), "success");
      renderShell();
      location.hash = "#/dashboard";
      Router.render();
      // Arrancar sync periódico tras login exitoso
      if (window.startPeriodicSync) window.startPeriodicSync();
    } catch (err) {
      U.toast(err.message, "danger", 5000);
      const submitBtn = e.target.querySelector("button[type=submit]");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Entrar"; }
    }
  });
});
