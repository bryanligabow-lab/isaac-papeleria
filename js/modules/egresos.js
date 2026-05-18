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
              <select class="sel" name="caja_id" required>${cajas.map(c => `<option value="${c.id}">${U.escape(c.nombre)}</option>`).join("")}</select>
            </label>
            <label class="lbl">Valor<input class="inp" type="number" name="valor" min="0" step="0.01" required></label>
            <label class="lbl">Soporte (URL imagen)<input class="inp" name="soporte_url" placeholder="https://..."></label>
            <label class="lbl">Subir soporte (imagen)<input class="inp" type="file" id="soporte-file" accept="image/*"></label>
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

    mdl.querySelector("#frm").addEventListener("submit", e => {
      e.preventDefault();
      const data = U.formData(e.target);
      const eg = DB.insert("comprobantes_egreso", {
        ...data,
        fecha: data.fecha + "T" + new Date().toTimeString().slice(0,8),
        metodo_pago_id: U.num(data.metodo_pago_id),
        caja_id: U.num(data.caja_id),
        valor: U.num(data.valor),
        estado: "emitido",
        created_by: Auth.currentUser().id
      });
      DB.pushCajaMov({
        caja_id: U.num(data.caja_id), fecha: eg.fecha,
        tipo: "egreso", concepto: `${data.concepto} (${eg.numero})`,
        referencia_tipo: "egreso", referencia_id: eg.id,
        metodo_pago_id: U.num(data.metodo_pago_id), monto: U.num(data.valor)
      });
      U.toast(`Egreso ${eg.numero} registrado`, "success");
      mdl.remove();
      refresh(currentFilters());
    });
  }

  async function voidEgreso(id) {
    const motivo = await U.prompt("Anular egreso", "Motivo");
    if (!motivo) return;
    const eg = DB.get("comprobantes_egreso", id);
    if (eg.estado === "anulada") return;
    DB.pushCajaMov({
      caja_id: eg.caja_id, fecha: U.nowISO(),
      tipo: "ingreso", concepto: `Anulación egreso ${eg.numero}`,
      referencia_tipo: "egreso_anulacion", referencia_id: id,
      metodo_pago_id: eg.metodo_pago_id, monto: eg.valor
    });
    DB.voidRow("comprobantes_egreso", id, motivo, Auth.currentUser().id);
    U.toast("Egreso anulado", "warning");
    refresh(currentFilters());
  }
}, { module: "egresos" });
