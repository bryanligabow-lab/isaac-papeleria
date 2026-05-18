// Módulo de compras.
Router.register("/compras", async (host) => {
  document.getElementById("page-title").textContent = "Compras";

  function refresh(filters = {}) {
    let compras = U.applyFilters(DB.list("compras"), filters);
    compras = [...compras].reverse();
    host.querySelector("#cp-list").innerHTML = U.table([
      { key: "id", label: "#" },
      { key: "numero", label: "N° factura" },
      { key: "fecha", label: "Fecha", render: r => U.fmtDate(r.fecha || r.created_at) },
      { key: "prov", label: "Proveedor", render: r => U.escape(DB.get("proveedores", r.proveedor_id)?.nombre || "—") },
      { key: "total", label: "Total", render: r => U.money(r.total) },
      { key: "estado", label: "Estado", render: r => `<span class="tag tag-${r.estado}">${U.escape(r.estado)}</span>` },
      { key: "origen", label: "Origen", render: r => r.origen_telegram ? "🤖 Telegram" : "Manual" },
      { key: "act", label: "", render: r => `
        <div class="flex" style="gap:4px">
          <button class="btn btn-sm" data-view="${r.id}">Ver</button>
          ${r.estado !== "anulada" && Auth.can("compras","anular") ? `<button class="btn btn-sm btn-danger" data-void="${r.id}">Anular</button>` : ""}
        </div>` }
    ], compras);
    host.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => viewCompra(Number(b.dataset.view))));
    host.querySelectorAll("[data-void]").forEach(b => b.addEventListener("click", () => voidCompra(Number(b.dataset.void))));
  }

  host.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h2>Compras</h2>
        <div class="actions">
          ${Auth.can("compras","crear") ? '<button class="btn btn-primary" id="btn-new">+ Nueva compra</button>' : ""}
          <button class="btn" id="btn-export">⬇ Excel</button>
        </div>
      </div>
      <div class="filters">
        <label class="lbl">Desde<input type="date" class="inp" id="f-from"></label>
        <label class="lbl">Hasta<input type="date" class="inp" id="f-to"></label>
        <label class="lbl">Proveedor
          <select class="sel" id="f-prov">
            <option value="">Todos</option>
            ${DB.list("proveedores").map(p => `<option value="${p.id}">${U.escape(p.nombre)}</option>`).join("")}
          </select>
        </label>
        <label class="lbl">Estado
          <select class="sel" id="f-est">
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
            <option value="anulada">Anulada</option>
          </select>
        </label>
        <label class="lbl">Buscar<input class="inp" id="f-search"></label>
      </div>
      <div id="cp-list"></div>
    </div>
  `;

  function currentFilters() {
    return {
      _from: host.querySelector("#f-from").value,
      _to: host.querySelector("#f-to").value,
      proveedor_id: host.querySelector("#f-prov").value,
      estado: host.querySelector("#f-est").value,
      _search: host.querySelector("#f-search").value
    };
  }
  ["#f-from","#f-to","#f-prov","#f-est","#f-search"].forEach(s => host.querySelector(s).addEventListener("input", () => refresh(currentFilters())));
  host.querySelector("#btn-new")?.addEventListener("click", () => openCompra());
  host.querySelector("#btn-export").addEventListener("click", () => {
    const rows = U.applyFilters(DB.list("compras"), currentFilters());
    U.exportCSV("compras.csv", rows, [
      { key: "id", label: "ID" },
      { key: "numero", label: "Número" },
      { key: "fecha", label: "Fecha" },
      { key: "proveedor_id", label: "Proveedor", export: r => DB.get("proveedores", r.proveedor_id)?.nombre || "" },
      { key: "subtotal", label: "Subtotal" },
      { key: "iva", label: "IVA" },
      { key: "total", label: "Total" },
      { key: "estado", label: "Estado" }
    ]);
  });

  refresh();

  function openCompra(prefill = null) {
    const proveedores = DB.list("proveedores", { activo: true });
    const productos = DB.list("productos", { activo: true });
    const metodos = DB.list("metodos_pago", { activo: true });
    const cajas = DB.list("cajas", { activo: true });

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <form class="modal lg" id="frm" style="max-width:900px">
          <h3>Nueva compra</h3>
          <div class="grid grid-3">
            <label class="lbl">Proveedor
              <select class="sel" name="proveedor_id" required>
                <option value="">Selecciona...</option>
                ${proveedores.map(p => `<option value="${p.id}" ${prefill?.proveedor_id === p.id ? "selected" : ""}>${U.escape(p.nombre)}</option>`).join("")}
              </select>
            </label>
            <label class="lbl">N° factura
              <input class="inp" name="numero" value="${U.escape(prefill?.numero || ("F-" + Date.now().toString(36).toUpperCase()))}" required>
            </label>
            <label class="lbl">Fecha
              <input class="inp" type="date" name="fecha" value="${prefill?.fecha?.slice(0,10) || U.todayStr()}" required>
            </label>
            <label class="lbl">Método de pago
              <select class="sel" name="metodo_pago_id" required>
                ${metodos.map(m => `<option value="${m.id}">${U.escape(m.nombre)}</option>`).join("")}
              </select>
            </label>
            <label class="lbl">Caja (si pagada)
              <select class="sel" name="caja_id">
                ${cajas.map(c => `<option value="${c.id}">${U.escape(c.nombre)}</option>`).join("")}
              </select>
            </label>
            <label class="lbl">Estado
              <select class="sel" name="estado">
                <option value="pendiente">Pendiente</option>
                <option value="pagada" selected>Pagada (egreso caja)</option>
              </select>
            </label>
          </div>

          <h4 style="margin-top:16px">Productos</h4>
          <table class="data-table line-table" id="lines">
            <thead><tr>
              <th style="min-width:240px">Producto</th>
              <th>Cantidad</th>
              <th>Costo unit.</th>
              <th>Subtotal</th>
              <th></th>
            </tr></thead><tbody></tbody>
          </table>
          <button type="button" class="btn btn-sm" id="btn-add-line">+ Agregar producto</button>

          <div class="grid grid-2" style="margin-top:16px">
            <label class="lbl">Observaciones
              <textarea class="inp" name="observaciones" rows="2">${U.escape(prefill?.observaciones || "")}</textarea>
            </label>
            <div class="totals">
              <div class="row"><span>Subtotal</span><span id="t-sub">${U.money(0)}</span></div>
              <div class="row">
                <span>IVA (${(APP_CONFIG.ivaDefault*100).toFixed(0)}%)</span>
                <span><input class="inp" type="number" name="iva" value="0" id="t-iva" style="width:90px;text-align:right" step="0.01"></span>
              </div>
              <div class="row total"><span>Total</span><span id="t-total">${U.money(0)}</span></div>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar compra</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl");
    const tbody = mdl.querySelector("#lines tbody");
    const lines = [];
    let counter = 0;

    function addLine(prefillLine) {
      const lid = ++counter;
      const line = { _id: lid, producto_id: prefillLine?.producto_id || "", cantidad: prefillLine?.cantidad || 1, costo_unitario: prefillLine?.costo_unitario || 0 };
      lines.push(line);
      const tr = document.createElement("tr");
      tr.dataset.id = lid;
      tr.innerHTML = `
        <td><select class="sel l-prod">
          <option value="">Seleccionar...</option>
          ${productos.map(p => `<option value="${p.id}" ${p.id === line.producto_id ? "selected" : ""}>${U.escape(p.sku)} — ${U.escape(p.nombre)}</option>`).join("")}
        </select></td>
        <td><input class="inp l-qty" type="number" min="1" value="${line.cantidad}" style="width:80px"></td>
        <td><input class="inp l-cost" type="number" min="0" step="0.01" value="${line.costo_unitario}" style="width:110px"></td>
        <td class="l-sub right">${U.money(line.cantidad * line.costo_unitario)}</td>
        <td><button type="button" class="btn btn-sm btn-danger l-del">✕</button></td>
      `;
      tbody.appendChild(tr);
      tr.querySelector(".l-prod").addEventListener("change", e => {
        line.producto_id = Number(e.target.value);
        const p = DB.get("productos", line.producto_id);
        if (p && !line.costo_unitario) {
          line.costo_unitario = U.num(p.costo_promedio);
          tr.querySelector(".l-cost").value = line.costo_unitario;
        }
        recalc();
      });
      tr.querySelector(".l-qty").addEventListener("input", e => { line.cantidad = U.num(e.target.value); recalc(); });
      tr.querySelector(".l-cost").addEventListener("input", e => { line.costo_unitario = U.num(e.target.value); recalc(); });
      tr.querySelector(".l-del").addEventListener("click", () => {
        tr.remove(); const i = lines.findIndex(x => x._id === lid); if (i >= 0) lines.splice(i, 1); recalc();
      });
    }

    function recalc() {
      let sub = 0;
      lines.forEach(l => {
        const s = l.cantidad * l.costo_unitario;
        sub += s;
        const tr = tbody.querySelector(`tr[data-id="${l._id}"]`);
        if (tr) tr.querySelector(".l-sub").textContent = U.money(s);
      });
      const iva = U.num(mdl.querySelector("#t-iva").value);
      mdl.querySelector("#t-sub").textContent = U.money(sub);
      mdl.querySelector("#t-total").textContent = U.money(sub + iva);
    }

    mdl.querySelector("#btn-add-line").addEventListener("click", () => { addLine(); recalc(); });
    mdl.querySelector("#t-iva").addEventListener("input", recalc);
    if (prefill?.lineas?.length) { prefill.lineas.forEach(l => addLine(l)); } else { addLine(); }
    recalc();

    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) mdl.remove(); });

    mdl.querySelector("#frm").addEventListener("submit", e => {
      e.preventDefault();
      const data = U.formData(e.target);
      const validLines = lines.filter(l => l.producto_id && l.cantidad > 0 && l.costo_unitario > 0);
      if (!validLines.length) return U.toast("Agrega al menos un producto", "danger");
      const sub = validLines.reduce((a, l) => a + l.cantidad * l.costo_unitario, 0);
      const iva = U.num(data.iva);
      const total = sub + iva;

      const compra = DB.insert("compras", {
        numero: data.numero,
        proveedor_id: U.num(data.proveedor_id),
        fecha: data.fecha + "T" + new Date().toTimeString().slice(0,8),
        metodo_pago_id: U.num(data.metodo_pago_id),
        subtotal: sub, iva, total,
        estado: data.estado,
        observaciones: data.observaciones || "",
        caja_id: U.num(data.caja_id) || null,
        origen_telegram: prefill?.origen_telegram || false,
        factura_telegram_id: prefill?.factura_telegram_id || null
      });

      validLines.forEach(l => {
        DB.insert("compras_detalle", {
          compra_id: compra.id, producto_id: l.producto_id,
          cantidad: l.cantidad, costo_unitario: l.costo_unitario,
          subtotal: l.cantidad * l.costo_unitario
        });
        DB.insert("historial_costos", {
          producto_id: l.producto_id, fecha: compra.fecha,
          costo_unitario: l.costo_unitario,
          proveedor_id: compra.proveedor_id, compra_id: compra.id
        });
        DB.pushInvMovement({
          producto_id: l.producto_id, tipo: "entrada",
          cantidad: l.cantidad, costo_unitario: l.costo_unitario,
          referencia_tipo: "compra", referencia_id: compra.id,
          motivo: "Compra " + compra.numero
        });
      });

      if (data.estado === "pagada" && data.caja_id) {
        DB.pushCajaMov({
          caja_id: U.num(data.caja_id), fecha: compra.fecha,
          tipo: "egreso", concepto: "Compra " + compra.numero,
          referencia_tipo: "compra", referencia_id: compra.id,
          metodo_pago_id: U.num(data.metodo_pago_id), monto: total
        });
      }

      U.toast(`Compra ${compra.numero} registrada · Total ${U.money(total)}`, "success");
      mdl.remove();
      refresh(currentFilters());
    });
  }

  function viewCompra(id) {
    const c = DB.get("compras", id);
    const det = DB.list("compras_detalle", { compra_id: id });
    const prov = DB.get("proveedores", c.proveedor_id);
    const mp = DB.get("metodos_pago", c.metodo_pago_id);

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <div class="modal lg">
          <h3>Compra ${U.escape(c.numero)} <span class="tag tag-${c.estado}">${c.estado}</span></h3>
          <div class="grid grid-3">
            <div><div class="muted">Fecha</div><div>${U.fmtDate(c.fecha)}</div></div>
            <div><div class="muted">Proveedor</div><div>${U.escape(prov?.nombre || "—")}</div></div>
            <div><div class="muted">Método pago</div><div>${U.escape(mp?.nombre || "—")}</div></div>
            <div><div class="muted">Subtotal</div><div>${U.money(c.subtotal)}</div></div>
            <div><div class="muted">IVA</div><div>${U.money(c.iva)}</div></div>
            <div><div class="muted">Total</div><div><strong>${U.money(c.total)}</strong></div></div>
          </div>
          <h4 style="margin-top:14px">Detalle</h4>
          ${U.table([
            { key: "producto", label: "Producto", render: r => U.escape(DB.get("productos", r.producto_id)?.nombre || "—") },
            { key: "cantidad", label: "Cantidad" },
            { key: "costo_unitario", label: "Costo unit.", render: r => U.money(r.costo_unitario) },
            { key: "subtotal", label: "Subtotal", render: r => U.money(r.subtotal) }
          ], det)}
          ${c.estado === "anulada" ? `<p class="muted">Anulada — motivo: ${U.escape(c.anulada_motivo)}</p>` : ""}
          <div class="modal-actions">
            <button class="btn btn-ghost" data-close>Cerrar</button>
            <button class="btn" id="btn-pdf">PDF</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl");
    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) mdl.remove(); });
    mdl.querySelector("#btn-pdf").addEventListener("click", () => U.exportPDF(`Compra ${c.numero}`, mdl.querySelector(".modal").innerHTML));
  }

  async function voidCompra(id) {
    const motivo = await U.prompt("Anular compra", "Motivo");
    if (!motivo) return;
    const c = DB.get("compras", id);
    if (c.estado === "anulada") return;
    // revertir inventario
    DB.list("compras_detalle", { compra_id: id }).forEach(d => {
      DB.pushInvMovement({
        producto_id: d.producto_id, tipo: "salida",
        cantidad: d.cantidad, costo_unitario: d.costo_unitario,
        referencia_tipo: "compra_anulacion", referencia_id: id,
        motivo: "Anulación compra " + c.numero
      });
    });
    if (c.estado === "pagada" && c.caja_id) {
      DB.pushCajaMov({
        caja_id: c.caja_id, fecha: U.nowISO(),
        tipo: "ingreso", concepto: "Anulación compra " + c.numero,
        referencia_tipo: "compra_anulacion", referencia_id: id,
        metodo_pago_id: c.metodo_pago_id, monto: c.total
      });
    }
    DB.voidRow("compras", id, motivo, Auth.currentUser().id);
    U.toast("Compra anulada", "warning");
    refresh(currentFilters());
  }

  // exponer para uso desde Telegram simulado
  window.Compras = { openCompra };
}, { module: "compras" });
