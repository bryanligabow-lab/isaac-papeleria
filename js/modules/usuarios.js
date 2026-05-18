// Usuarios, roles y permisos.
Router.register("/usuarios", async (host) => {
  document.getElementById("page-title").textContent = "Usuarios y permisos";

  function refresh() {
    const users = DB.list("usuarios");
    const roles = DB.list("roles");

    const usersHtml = U.table([
      { key: "id", label: "#" },
      { key: "username", label: "Usuario" },
      { key: "nombre", label: "Nombre" },
      { key: "rol", label: "Rol", render: r => U.escape(roles.find(x => x.id === r.rol_id)?.nombre || "—") },
      { key: "email", label: "Email" },
      { key: "telegram_id", label: "Telegram ID", render: r => r.telegram_id || "—" },
      { key: "activo", label: "Activo", render: r => r.activo ? '<span class="tag tag-pagada">Sí</span>' : '<span class="tag tag-anulada">No</span>' },
      { key: "act", label: "", render: r => `
        <div class="flex" style="gap:4px">
          <button class="btn btn-sm" data-edit="${r.id}">Editar</button>
          <button class="btn btn-sm" data-pass="${r.id}">Contraseña</button>
          ${r.activo ? `<button class="btn btn-sm btn-danger" data-toggle="${r.id}">Desactivar</button>` : `<button class="btn btn-sm btn-success" data-toggle="${r.id}">Activar</button>`}
        </div>
      ` }
    ], users);

    const rolesHtml = U.table([
      { key: "id", label: "#" },
      { key: "nombre", label: "Rol" },
      { key: "descripcion", label: "Descripción" },
      { key: "permisos", label: "Permisos", render: r => {
        const cnt = DB.list("roles_permisos", { rol_id: r.id }).length;
        return cnt + " asignados";
      } },
      { key: "act", label: "", render: r => `<button class="btn btn-sm" data-perm="${r.id}">Configurar permisos</button>` }
    ], roles);

    host.querySelector("#users-tbl").innerHTML = usersHtml;
    host.querySelector("#roles-tbl").innerHTML = rolesHtml;

    host.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openUser(DB.get("usuarios", Number(b.dataset.edit)))));
    host.querySelectorAll("[data-pass]").forEach(b => b.addEventListener("click", () => changePassword(Number(b.dataset.pass))));
    host.querySelectorAll("[data-toggle]").forEach(b => b.addEventListener("click", () => toggleUser(Number(b.dataset.toggle))));
    host.querySelectorAll("[data-perm]").forEach(b => b.addEventListener("click", () => openPermisos(Number(b.dataset.perm))));
  }

  host.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h2>Usuarios</h2>
        <div class="actions">
          <button class="btn btn-primary" id="btn-new-user">+ Nuevo usuario</button>
        </div>
      </div>
      <div id="users-tbl"></div>
      <div class="page-header" style="margin-top:24px">
        <h2>Roles</h2>
        <div class="actions">
          <button class="btn btn-primary" id="btn-new-role">+ Nuevo rol</button>
        </div>
      </div>
      <div id="roles-tbl"></div>
    </div>
  `;

  host.querySelector("#btn-new-user").addEventListener("click", () => openUser({}));
  host.querySelector("#btn-new-role").addEventListener("click", () => openRol({}));

  refresh();

  async function openUser(u = {}) {
    const roles = DB.list("roles", { activo: true });
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <form class="modal" id="frm">
          <h3>${u.id ? "Editar usuario" : "Nuevo usuario"}</h3>
          <div class="grid grid-2">
            <label class="lbl">Usuario <input class="inp" name="username" value="${U.escape(u.username || "")}" required ${u.id ? "readonly" : ""}></label>
            <label class="lbl">Nombre completo <input class="inp" name="nombre" value="${U.escape(u.nombre || "")}"></label>
            <label class="lbl">Email <input class="inp" type="email" name="email" value="${U.escape(u.email || "")}"></label>
            <label class="lbl">Rol
              <select class="sel" name="rol_id" required>
                ${roles.map(r => `<option value="${r.id}" ${u.rol_id === r.id ? "selected" : ""}>${U.escape(r.nombre)}</option>`).join("")}
              </select>
            </label>
            <label class="lbl">Telegram ID <input class="inp" name="telegram_id" value="${U.escape(u.telegram_id || "")}"></label>
            ${u.id ? "" : `<label class="lbl">Contraseña inicial <input class="inp" type="password" name="password" required></label>`}
            <label class="lbl">Activo <input type="checkbox" name="activo" ${u.activo !== false ? "checked" : ""}></label>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl");
    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) mdl.remove(); });
    mdl.querySelector("#frm").addEventListener("submit", async e => {
      e.preventDefault();
      const data = U.formData(e.target);
      data.rol_id = Number(data.rol_id);
      data.activo = e.target.querySelector("[name=activo]").checked;
      try {
        if (u.id) {
          DB.update("usuarios", u.id, data);
        } else {
          const salt = U.uid();
          const hash = await U.sha256(data.password + salt);
          delete data.password;
          DB.insert("usuarios", { ...data, password_hash: hash, salt });
        }
        U.toast("Usuario guardado", "success");
        mdl.remove();
        refresh();
      } catch (err) { U.toast(err.message, "danger"); }
    });
  }

  async function changePassword(uid) {
    const np = await U.prompt("Cambiar contraseña", "Nueva contraseña (mín. 4 caracteres)");
    if (!np || np.length < 4) return U.toast("Cancelado", "warning");
    await Auth.changePassword(uid, np);
    U.toast("Contraseña actualizada", "success");
  }

  async function toggleUser(uid) {
    if (uid === 1) return U.toast("No puedes desactivar al admin principal", "danger");
    const u = DB.get("usuarios", uid);
    DB.update("usuarios", uid, { activo: !u.activo });
    refresh();
  }

  async function openRol(r = {}) {
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <form class="modal" id="frm">
          <h3>${r.id ? "Editar rol" : "Nuevo rol"}</h3>
          <label class="lbl">Nombre <input class="inp" name="nombre" value="${U.escape(r.nombre || "")}" required></label>
          <label class="lbl">Descripción <input class="inp" name="descripcion" value="${U.escape(r.descripcion || "")}"></label>
          <label class="lbl">Activo <input type="checkbox" name="activo" ${r.activo !== false ? "checked" : ""}></label>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl");
    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) mdl.remove(); });
    mdl.querySelector("#frm").addEventListener("submit", e => {
      e.preventDefault();
      const data = U.formData(e.target);
      data.activo = e.target.querySelector("[name=activo]").checked;
      if (r.id) DB.update("roles", r.id, data);
      else DB.insert("roles", data);
      U.toast("Rol guardado", "success");
      mdl.remove();
      refresh();
    });
  }

  async function openPermisos(rolId) {
    const rol = DB.get("roles", rolId);
    const permisos = DB.list("permisos");
    const asignados = new Set(DB.list("roles_permisos", { rol_id: rolId }).map(x => x.permiso_id));
    const modulos = [...new Set(permisos.map(p => p.modulo))];

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <form class="modal lg" id="frm" style="max-height:85vh;overflow:auto">
          <h3>Permisos — ${U.escape(rol.nombre)}</h3>
          ${rolId === 1 ? '<p class="muted">El rol Administrador tiene acceso total. Esta configuración es informativa.</p>' : ""}
          <table class="data-table">
            <thead><tr><th>Módulo</th><th class="center">Ver</th><th class="center">Crear</th><th class="center">Editar</th><th class="center">Anular</th></tr></thead>
            <tbody>
              ${modulos.map(m => `
                <tr>
                  <td><strong>${U.escape(m)}</strong></td>
                  ${["ver","crear","editar","anular"].map(a => {
                    const p = permisos.find(x => x.modulo === m && x.accion === a);
                    if (!p) return "<td></td>";
                    return `<td class="center"><input type="checkbox" name="perm" value="${p.id}" ${asignados.has(p.id) ? "checked" : ""} ${rolId === 1 ? "disabled checked" : ""}></td>`;
                  }).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cerrar</button>
            ${rolId !== 1 ? '<button type="submit" class="btn btn-primary">Guardar permisos</button>' : ""}
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl");
    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) mdl.remove(); });
    mdl.querySelector("#frm").addEventListener("submit", e => {
      e.preventDefault();
      const checked = [...e.target.querySelectorAll("[name=perm]:checked")].map(c => Number(c.value));
      const db = DB.getDB();
      db.roles_permisos = db.roles_permisos.filter(x => x.rol_id !== rolId);
      checked.forEach(pid => db.roles_permisos.push({ rol_id: rolId, permiso_id: pid }));
      DB.setDB(db);
      DB.audit("usuarios", "editar", rolId, { rol_permisos: checked });
      U.toast("Permisos guardados", "success");
      mdl.remove();
    });
  }
}, { module: "usuarios" });
