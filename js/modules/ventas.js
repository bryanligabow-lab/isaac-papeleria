// Módulo de ventas.
Router.register("/ventas", async (host) => {
  document.getElementById("page-title").textContent = "Ventas";

  function refresh(filters = {}) {
    let ventas = DB.list("ventas");
    ventas = U.applyFilters(ventas, filters);
    ventas = [...ventas].reverse();
    const html = U.table([
      { key: "id", label: "#" },
      { key: "fecha", label: "Fecha", render: r => U.fmtDate(r.fecha || r.created_at) },
      { key: "cliente", label: "Cliente", render: r => U.escape(DB.get("clientes", r.cliente_id)?.nombre || "Mostrador") },
      { key: "vendedor", label: "Vendedor", render: r => U.escape(DB.get("usuarios", r.vendedor_id)?.nombre || "—") },
      { key: "total", label: "Total", render: r => U.money(r.total) },
      { key: "utilidad", label: "Utilidad", render: r => U.money(r.utilidad) },
      { key: "margen", label: "%", render: r => r.total ? U.pct(U.num(r.utilidad)/U.num(r.total)) : "—" },
      { key: "estado", label: "Estado", render: r => `<span class="tag tag-${r.estado}">${U.escape(r.estado)}</span>` },
      { key: "act", label: "", render: r => `
        <div class="flex" style="gap:4px">
          <button class="btn btn-sm" data-view="${r.id}">Ver</button>
          ${r.estado !== "anulada" && Auth.can("ventas","anular") ? `<button class="btn btn-sm btn-danger" data-void="${r.id}">Anular</button>` : ""}
        </div>
      ` }
    ], ventas);
    host.querySelector("#vt-list").innerHTML = html;
    host.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => viewVenta(Number(b.dataset.view))));
    host.querySelectorAll("[data-void]").forEach(b => b.addEventListener("click", () => voidVenta(Number(b.dataset.void))));
  }

  host.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h2>Ventas</h2>
        <div class="actions">
          ${Auth.can("ventas","crear") ? '<button class="btn btn-primary" id="btn-new">+ Nueva venta</button>' : ""}
          <button class="btn" id="btn-export">⬇ Excel</button>
        </div>
      </div>
      <div class="filters">
        <label class="lbl">Desde<input type="date" class="inp" id="f-from"></label>
        <label class="lbl">Hasta<input type="date" class="inp" id="f-to"></label>
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
      <div id="vt-list"></div>
    </div>
  `;

  function currentFilters() {
    return {
      _from: host.querySelector("#f-from").value,
      _to: host.querySelector("#f-to").value,
      estado: host.querySelector("#f-est").value,
      _search: host.querySelector("#f-search").value
    };
  }
  ["#f-from","#f-to","#f-est","#f-search"].forEach(s => host.querySelector(s).addEventListener("input", () => refresh(currentFilters())));

  host.querySelector("#btn-new")?.addEventListener("click", () => openVenta());
  host.querySelector("#btn-export").addEventListener("click", () => {
    const rows = U.applyFilters(DB.list("ventas"), currentFilters());
    U.exportCSV("ventas.csv", rows, [
      { key: "id", label: "ID" },
      { key: "fecha", label: "Fecha", export: r => r.fecha || r.created_at },
      { key: "cliente_id", label: "Cliente", export: r => DB.get("clientes", r.cliente_id)?.nombre || "Mostrador" },
      { key: "subtotal", label: "Subtotal" },
      { key: "descuento", label: "Descuento" },
      { key: "total", label: "Total" },
      { key: "utilidad", label: "Utilidad" },
      { key: "estado", label: "Estado" }
    ]);
  });

  refresh();

  function openVenta() {
    const div = document.createElement("div");
    const clientes = DB.list("clientes", { activo: true });
    const productos = DB.list("productos", { activo: true });
    const metodos = DB.list("metodos_pago", { activo: true });
    const cajas = DB.list("cajas", { activo: true });

    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <form class="modal lg" id="frm" style="max-width:900px">
          <h3>Nueva venta</h3>
          <div class="grid grid-3">
            <label class="lbl">Cliente
              <select class="sel" name="cliente_id">
                <option value="">Mostrador</option>
                ${clientes.map(c => `<option value="${c.id}">${U.escape(c.nombre)}</option>`).join("")}
              </select>
            </label>
            <label class="lbl">Método de pago
              <select class="sel" name="metodo_pago_id" required>
                ${metodos.map(m => `<option value="${m.id}">${U.escape(m.nombre)}</option>`).join("")}
              </select>
            </label>
            <label class="lbl">Caja
              <select class="sel" name="caja_id" required>
                ${cajas.map(c => `<option value="${c.id}">${U.escape(c.nombre)}</option>`).join("")}
              </select>
            </label>
          </div>

          <h4 style="margin-top:16px">Productos</h4>
          <table class="data-table line-table" id="lines">
            <thead><tr>
              <th style="min-width:240px">Producto</th>
              <th>Stock</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Costo unit.</th>
              <th>Subtotal</th>
              <th>Utilidad</th>
              <th></th>
            </tr></thead>
            <tbody></tbody>
          </table>
          <button type="button" class="btn btn-sm" id="btn-add-line">+ Agregar producto</button>

          <div class="grid grid-2" style="margin-top:16px">
            <label class="lbl">Observaciones
              <textarea class="inp" name="observaciones" rows="2"></textarea>
            </label>
            <div class="totals">
              <div class="row"><span>Subtotal</span><span id="t-sub">${U.money(0)}</span></div>
              <div class="row">
                <span>Descuento</span>
                <span><input class="inp" type="number" name="descuento" value="0" id="t-desc" style="width:90px;text-align:right"></span>
              </div>
              <div class="row"><span>Costo total</span><span id="t-cost">${U.money(0)}</span></div>
              <div class="row total"><span>Total</span><span id="t-total">${U.money(0)}</span></div>
              <div class="row" style="color:var(--success)"><span>Utilidad</span><span id="t-util">${U.money(0)}</span></div>
            </div>
          </div>

          <label class="lbl"><input type="checkbox" name="pagada" checked> Marcar como PAGADA e ingresar a caja</label>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar venta</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl");
    const tbody = mdl.querySelector("#lines tbody");
    let counter = 0;
    const lines = [];

    function addLine() {
      const lid = ++counter;
      const line = { _id: lid, producto_id: "", cantidad: 1, precio_unitario: 0, costo_unitario: 0 };
      lines.push(line);
      const tr = document.createElement("tr");
      tr.dataset.id = lid;
      tr.innerHTML = `
        <td><select class="sel l-prod">
          <option value="">Seleccionar...</option>
          ${productos.map(p => `<option value="${p.id}">${U.escape(p.sku)} — ${U.escape(p.nombre)}</option>`).join("")}
        </select></td>
        <td class="l-stock">—</td>
        <td><input class="inp l-qty" type="number" min="1" value="1" style="width:80px"></td>
        <td><input class="inp l-price" type="number" min="0" step="0.01" value="0" style="width:110px"></td>
        <td class="l-cost right">${U.money(0)}</td>
        <td class="l-sub right">${U.money(0)}</td>
        <td class="l-util right" style="color:var(--success)">${U.money(0)}</td>
        <td><button type="button" class="btn btn-sm btn-danger l-del">✕</button></td>
      `;
      tbody.appendChild(tr);
      tr.querySelector(".l-del").addEventListener("click", () => { tr.remove(); const i = lines.findIndex(x => x._id === lid); if (i >= 0) lines.splice(i, 1); recalc(); });
      tr.querySelector(".l-prod").addEventListener("change", e => {
        const p = DB.get("productos", Number(e.target.value));
        if (p) {
          line.producto_id = p.id;
          line.precio_unitario = U.num(p.precio_venta);
          line.costo_unitario = DB.avgCostOf(p.id);
          tr.querySelector(".l-price").value = line.precio_unitario;
          tr.querySelector(".l-stock").textContent = DB.stockOf(p.id);
        } else { line.producto_id = ""; }
        recalc();
      });
      tr.querySelector(".l-qty").addEventListener("input", e => { line.cantidad = U.num(e.target.value); recalc(); });
      tr.querySelector(".l-price").addEventListener("input", e => { line.precio_unitario = U.num(e.target.value); recalc(); });
    }

    function recalc() {
      let sub = 0, cost = 0;
      lines.forEach(l => {
        const lSub = l.cantidad * l.precio_unitario;
        const lCost = l.cantidad * l.costo_unitario;
        sub += lSub; cost += lCost;
        const tr = tbody.querySelector(`tr[data-id="${l._id}"]`);
        if (tr) {
          tr.querySelector(".l-cost").textContent = U.money(l.costo_unitario);
          tr.querySelector(".l-sub").textContent = U.money(lSub);
          tr.querySelector(".l-util").textContent = U.money(lSub - lCost);
        }
      });
      const desc = U.num(mdl.querySelector("#t-desc").value);
      const total = Math.max(0, sub - desc);
      const util = total - cost;
      mdl.querySelector("#t-sub").textContent = U.money(sub);
      mdl.querySelector("#t-cost").textContent = U.money(cost);
      mdl.querySelector("#t-total").textContent = U.money(total);
      mdl.querySelector("#t-util").textContent = U.money(util);
    }

    mdl.querySelector("#btn-add-line").addEventListener("click", () => { addLine(); recalc(); });
    mdl.querySelector("#t-desc").addEventListener("input", recalc);
    addLine();

    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) mdl.remove(); });

    mdl.querySelector("#frm").addEventListener("submit", e => {
      e.preventDefault();
      const data = U.formData(e.target);
      // validar líneas
      const validLines = lines.filter(l => l.producto_id && l.cantidad > 0);
      if (!validLines.length) return U.toast("Agrega al menos un producto", "danger");
      // validar stock
      for (const l of validLines) {
        const stock = DB.stockOf(l.producto_id);
        if (l.cantidad > stock) {
          const p = DB.get("productos", l.producto_id);
          return U.toast(`Sin stock suficiente de ${p.nombre} (stock: ${stock})`, "danger");
        }
      }
      const sub = validLines.reduce((a, l) => a + l.cantidad * l.precio_unitario, 0);
      const cost = validLines.reduce((a, l) => a + l.cantidad * l.costo_unitario, 0);
      const desc = U.num(data.descuento);
      const total = Math.max(0, sub - desc);
      const util = total - cost;
      const pagada = e.target.querySelector("[name=pagada]").checked;

      const venta = DB.insert("ventas", {
        numero: "V-" + Date.now().toString(36).toUpperCase(),
        cliente_id: U.num(data.cliente_id) || 0,
        vendedor_id: Auth.currentUser().id,
        fecha: U.nowISO(),
        metodo_pago_id: U.num(data.metodo_pago_id),
        subtotal: sub, descuento: desc, total, costo_total: cost, utilidad: util,
        estado: pagada ? "pagada" : "pendiente",
        observaciones: data.observaciones || "",
        caja_id: U.num(data.caja_id)
      });

      validLines.forEach(l => {
        DB.insert("ventas_detalle", {
          venta_id: venta.id, producto_id: l.producto_id,
          cantidad: l.cantidad, precio_unitario: l.precio_unitario, descuento: 0,
          subtotal: l.cantidad * l.precio_unitario,
          costo_unitario: l.costo_unitario,
          utilidad: l.cantidad * (l.precio_unitario - l.costo_unitario)
        });
        DB.pushInvMovement({
          producto_id: l.producto_id, tipo: "salida",
          cantidad: l.cantidad, costo_unitario: l.costo_unitario,
          referencia_tipo: "venta", referencia_id: venta.id,
          motivo: "Venta " + venta.numero
        });
      });

      if (pagada) {
        DB.pushCajaMov({
          caja_id: U.num(data.caja_id), fecha: venta.fecha,
          tipo: "ingreso", concepto: "Venta " + venta.numero,
          referencia_tipo: "venta", referencia_id: venta.id,
          metodo_pago_id: U.num(data.metodo_pago_id), monto: total
        });
      }

      U.toast(`Venta ${venta.numero} registrada · Utilidad ${U.money(util)}`, "success");
      mdl.remove();
      refresh(currentFilters());
    });
  }

  function viewVenta(id) {
    const v = DB.get("ventas", id);
    const det = DB.list("ventas_detalle", { venta_id: id });
    const cliente = DB.get("clientes", v.cliente_id);
    const vendedor = DB.get("usuarios", v.vendedor_id);
    const mp = DB.get("metodos_pago", v.metodo_pago_id);

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <div class="modal lg">
          <h3>Venta ${U.escape(v.numero)} <span class="tag tag-${v.estado}">${v.estado}</span></h3>
          <div class="grid grid-3">
            <div><div class="muted">Fecha</div><div>${U.fmtDate(v.fecha)}</div></div>
            <div><div class="muted">Cliente</div><div>${U.escape(cliente?.nombre || "Mostrador")}</div></div>
            <div><div class="muted">Vendedor</div><div>${U.escape(vendedor?.nombre || "—")}</div></div>
            <div><div class="muted">Método pago</div><div>${U.escape(mp?.nombre || "—")}</div></div>
            <div><div class="muted">Subtotal</div><div>${U.money(v.subtotal)}</div></div>
            <div><div class="muted">Descuento</div><div>${U.money(v.descuento)}</div></div>
            <div><div class="muted">Total</div><div><strong>${U.money(v.total)}</strong></div></div>
            <div><div class="muted">Costo</div><div>${U.money(v.costo_total)}</div></div>
            <div><div class="muted">Utilidad</div><div style="color:var(--success)"><strong>${U.money(v.utilidad)} (${v.total ? U.pct(v.utilidad/v.total) : "—"})</strong></div></div>
          </div>
          <h4 style="margin-top:14px">Detalle</h4>
          ${U.table([
            { key: "producto", label: "Producto", render: r => U.escape(DB.get("productos", r.producto_id)?.nombre || "—") },
            { key: "cantidad", label: "Cant." },
            { key: "precio_unitario", label: "Precio", render: r => U.money(r.precio_unitario) },
            { key: "costo_unitario", label: "Costo", render: r => U.money(r.costo_unitario) },
            { key: "subtotal", label: "Subtotal", render: r => U.money(r.subtotal) },
            { key: "utilidad", label: "Utilidad", render: r => U.money(r.utilidad) }
          ], det)}
          ${v.observaciones ? `<p><strong>Obs:</strong> ${U.escape(v.observaciones)}</p>` : ""}
          ${v.estado === "anulada" ? `<p class="muted">Anulada el ${U.fmtDate(v.anulada_at)} por usuario #${v.anulada_by}. Motivo: ${U.escape(v.anulada_motivo || "")}</p>` : ""}
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
    mdl.querySelector("#btn-pdf").addEventListener("click", () => {
      U.exportPDF(`Venta ${v.numero}`, mdl.querySelector(".modal").innerHTML);
    });
  }

  async function voidVenta(id) {
    const motivo = await U.prompt("Anular venta", "Motivo de la anulación");
    if (!motivo) return;
    const v = DB.get("ventas", id);
    if (v.estado === "anulada") return;
    // revertir inventario
    DB.list("ventas_detalle", { venta_id: id }).forEach(d => {
      DB.pushInvMovement({
        producto_id: d.producto_id, tipo: "entrada",
        cantidad: d.cantidad, costo_unitario: d.costo_unitario,
        referencia_tipo: "venta_anulacion", referencia_id: id,
        motivo: "Anulación venta " + v.numero
      });
    });
    // revertir caja si estaba pagada
    if (v.estado === "pagada" && v.caja_id) {
      DB.pushCajaMov({
        caja_id: v.caja_id, fecha: U.nowISO(),
        tipo: "egreso", concepto: "Anulación venta " + v.numero,
        referencia_tipo: "venta_anulacion", referencia_id: id,
        metodo_pago_id: v.metodo_pago_id, monto: v.total
      });
    }
    DB.voidRow("ventas", id, motivo, Auth.currentUser().id);
    U.toast("Venta anulada", "warning");
    refresh(currentFilters());
  }
}, { module: "ventas" });
