// Comprobantes de egreso / pagos.
Router.register("/egresos", async (host) => {
  document.getElementById("page-title").textContent = "Comprobantes de egreso";

  function refresh(filters = {}) {
    let rows = U.applyFilters(DB.list("comprobantes_egreso"), filters);
    rows = [...rows].reverse();
    host.querySelector("#eg-list").innerHTML = U.table([
      { key: "id", label: "#" },
      { key: "numero", label: "N° comp." },
      { key: "fecha", label: "Fecha", render: r => U.fmtDate(r.fecha) },
      { key: "beneficiario", label: "Beneficiario" },
      { key: "concepto", label: "Concepto" },
      { key: "metodo", label: "Método", render: r => U.escape(DB.get("metodos_pago", r.metodo_pago_id)?.nombre || "—") },
      { key: "valor", label: "Valor", render: r => U.money(r.valor) },
      { key: "afecta", label: "Afecta caja", render: r => r.afecta_caja === false ? '<span class="tag tag-anulada">No</span>' : `<span class="tag tag-pagada">Sí</span>` },
      { key: "usuario_caja", label: "Usuario caja", render: r => U.escape(DB.get("usuarios", r.usuario_caja_id)?.username || DB.get("usuarios", r.created_by)?.username || "—") },
      { key: "estado", label: "Estado", render: r => `<span class="tag tag-${r.estado}">${U.escape(r.estado)}</span>` },
      { key: "soporte", label: "Soporte", render: r => r.soporte_url ? `<a href="${U.escape(r.soporte_url)}" target="_blank">ver</a>` : "—" },
      { key: "act", label: "", render: r => `
        <div class="flex" style="gap:4px">
          ${r.estado !== "anulada" && Auth.can("egresos","anular") ? `<button class="btn btn-sm btn-danger" data-void="${r.id}">Anular</button>` : ""}
        </div>` }
    ], rows);
    host.querySelectorAll("[data-void]").forEach(b => b.addEventListener("click", () => voidEgreso(Number(b.dataset.void))));
  }

  host.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h2>Comprobantes de egreso</h2>
        <div class="actions">
          ${Auth.can("egresos","crear") ? '<button class="btn btn-primary" id="btn-new">+ Nuevo egreso</button>' : ""}
          <button class="btn" id="btn-export">⬇ Excel</button>
        </div>
      </div>
      <div class="filters">
        <label class="lbl">Desde<input type="date" class="inp" id="f-from"></label>
        <label class="lbl">Hasta<input type="date" class="inp" id="f-to"></label>
        <label class="lbl">Buscar<input class="inp" id="f-search"></label>
      </div>
      <div id="eg-list"></div>
    </div>
  `;

  function currentFilters() {
    return { _from: host.querySelector("#f-from").value, _to: host.querySelector("#f-to").value, _search: host.querySelector("#f-search").value };
  }
  ["#f-from","#f-to","#f-search"].forEach(s => host.querySelector(s).addEventListener("input", () => refresh(currentFilters())));
  host.querySelector("#btn-new")?.addEventListener("click", openEgreso);
  host.querySelector("#btn-export").addEventListener("click", () => {
    const rows = U.applyFilters(DB.list("comprobantes_egreso"), currentFilters());
    U.exportCSV("egresos.csv", rows, [
      { key: "id", label: "ID" }, { key: "numero", label: "N°" }, { key: "fecha", label: "Fecha" },
      { key: "beneficiario", label: "Beneficiario" }, { key: "concepto", label: "Concepto" },
      { key: "valor", label: "Valor" }, { key: "estado", label: "Estado" }
    ]);
  });

  refresh();

  function openEgreso() {
    const metodos = DB.list("metodos_pago", { activo: true });
    const cajas = DB.list("cajas", { activo: true });
    const usuarios = DB.list("usuarios", { activo: true });
    const cajaDefault = cajas[0]?.id;

    // Si hay sesión abierta en la caja por defecto, sugerir su usuario
    function sugerirUsuarioCaja(cajaId) {
      const ses = DB.activeCajaSession(cajaId);
      return ses ? ses.usuario_id : Auth.currentUser().id;
    }

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <form class="modal lg" id="frm">
          <h3>Nuevo comprobante de egreso</h3>
          <div class="grid grid-2">
            <label class="lbl">N° comprobante<input class="inp" name="numero" value="CE-${Date.now().toString(36).toUpperCase()}" required></label>
            <label class="lbl">Fecha<input class="inp" type="date" name="fecha" value="${U.todayStr()}" required></label>
            <label class="lbl">Beneficiario<input class="inp" name="beneficiario" required></label>
            <label class="lbl">Concepto<input class="inp" name="concepto" required></label>
            <label class="lbl">Método de pago
              <select class="sel" name="metodo_pago_id" required>${metodos.map(m => `<option value="${m.id}">${U.escape(m.nombre)}</option>`).join("")}</select>
            </label>
            <label class="lbl">Caja
              <select class="sel" name="caja_id" id="eg-caja" required>${cajas.map(c => `<option value="${c.id}">${U.escape(c.nombre)}</option>`).join("")}</select>
            </label>
            <label class="lbl">Valor<input class="inp" type="number" name="valor" min="0" step="0.01" required></label>
            <label class="lbl">Usuario responsable de la caja
              <select class="sel" name="usuario_caja_id" id="eg-user-caja" required>
                ${usuarios.map(u => `<option value="${u.id}" ${u.id === sugerirUsuarioCaja(cajaDefault) ? "selected" : ""}>${U.escape(u.nombre || u.username)}</option>`).join("")}
              </select>
            </label>
            <label class="lbl">Soporte (URL imagen)<input class="inp" name="soporte_url" placeholder="https://..."></label>
            <label class="lbl">Subir soporte (imagen)<input class="inp" type="file" id="soporte-file" accept="image/*"></label>
          </div>

          <div style="margin-top:8px;padding:12px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border)">
            <label class="flex" style="gap:8px;align-items:flex-start;cursor:pointer">
              <input type="checkbox" name="afecta_caja" id="eg-afecta" checked style="margin-top:2px">
              <div>
                <div><strong>Afecta el cierre de caja</strong></div>
                <div class="muted" style="font-size:12px">Si está marcado, este egreso descontará el saldo de la caja seleccionada y aparecerá en el cierre. Desmarca para registrar el egreso solo para contabilidad sin tocar la caja física.</div>
              </div>
            </label>
            <div id="eg-sesion-info" class="muted" style="font-size:12px;margin-top:6px;margin-left:26px"></div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar egreso</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl");
    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) mdl.remove(); });

    // archivo → base64 dataURL
    mdl.querySelector("#soporte-file").addEventListener("change", async e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { mdl.querySelector("[name=soporte_url]").value = reader.result; };
      reader.readAsDataURL(f);
    });

    // info dinámica: sesión abierta de la caja seleccionada
    function refreshSesionInfo() {
      const cajaId = U.num(mdl.querySelector("#eg-caja").value);
      const ses = DB.activeCajaSession(cajaId);
      const userSel = mdl.querySelector("#eg-user-caja");
      const info = mdl.querySelector("#eg-sesion-info");
      if (ses) {
        const u = DB.get("usuarios", ses.usuario_id);
        info.innerHTML = `🟢 Caja abierta por <strong>${U.escape(u?.nombre || u?.username || "—")}</strong> desde ${U.fmtDate(ses.fecha_apertura)}. Saldo actual: <strong>${U.money(DB.cajaBalance(cajaId))}</strong>`;
        userSel.value = ses.usuario_id;
      } else {
        info.innerHTML = `⚠️ No hay sesión abierta en esta caja. El egreso quedará registrado pero recuerda abrir la caja para el cierre del día.`;
      }
    }
    mdl.querySelector("#eg-caja").addEventListener("change", refreshSesionInfo);
    refreshSesionInfo();

    mdl.querySelector("#frm").addEventListener("submit", e => {
      e.preventDefault();
      const data = U.formData(e.target);
      const afecta = mdl.querySelector("#eg-afecta").checked;
      const cajaId = U.num(data.caja_id);
      const userCajaId = U.num(data.usuario_caja_id);

      const eg = DB.insert("comprobantes_egreso", {
        numero: data.numero,
        fecha: data.fecha + "T" + new Date().toTimeString().slice(0,8),
        beneficiario: data.beneficiario,
        concepto: data.concepto,
        metodo_pago_id: U.num(data.metodo_pago_id),
        caja_id: cajaId,
        valor: U.num(data.valor),
        soporte_url: data.soporte_url || "",
        afecta_caja: afecta,
        usuario_caja_id: userCajaId,
        estado: "emitido",
        created_by: Auth.currentUser().id
      });

      if (afecta) {
        DB.pushCajaMov({
          caja_id: cajaId, fecha: eg.fecha,
          tipo: "egreso", concepto: `${data.concepto} (${eg.numero})`,
          referencia_tipo: "egreso", referencia_id: eg.id,
          metodo_pago_id: U.num(data.metodo_pago_id), monto: U.num(data.valor),
          usuario_id: userCajaId
        });
        U.toast(`Egreso ${eg.numero} registrado · descuenta caja`, "success");
      } else {
        U.toast(`Egreso ${eg.numero} registrado (NO afecta caja)`, "success");
      }

      mdl.remove();
      refresh(currentFilters());
    });
  }

  async function voidEgreso(id) {
    const motivo = await U.prompt("Anular egreso", "Motivo");
    if (!motivo) return;
    const eg = DB.get("comprobantes_egreso", id);
    if (eg.estado === "anulada") return;
    // Solo revertir caja si el egreso original la afectó
    if (eg.afecta_caja !== false) {
      DB.pushCajaMov({
        caja_id: eg.caja_id, fecha: U.nowISO(),
        tipo: "ingreso", concepto: `Anulación egreso ${eg.numero}`,
        referencia_tipo: "egreso_anulacion", referencia_id: id,
        metodo_pago_id: eg.metodo_pago_id, monto: eg.valor,
        usuario_id: eg.usuario_caja_id || Auth.currentUser().id
      });
    }
    DB.voidRow("comprobantes_egreso", id, motivo, Auth.currentUser().id);
    U.toast("Egreso anulado", "warning");
    refresh(currentFilters());
  }
}, { module: "egresos" });
