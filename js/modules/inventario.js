// Inventario: stock global, Kardex por producto, ajustes.
Router.register("/inventario", async (host) => {
  document.getElementById("page-title").textContent = "Inventario";

  let viewKardex = null; // producto_id

  function renderGlobal() {
    const productos = DB.list("productos", { activo: true });
    const rows = productos.map(p => {
      const stock = DB.stockOf(p.id);
      const cp = DB.avgCostOf(p.id);
      const valor = stock * cp;
      const bajo = stock < U.num(p.stock_minimo);
      return { ...p, stock, cp, valor, bajo };
    });

    const total = rows.reduce((a, r) => a + r.valor, 0);
    const totalUnidades = rows.reduce((a, r) => a + r.stock, 0);
    const bajos = rows.filter(r => r.bajo).length;

    host.innerHTML = `
      <div class="page">
        <div class="page-header">
          <h2>Inventario</h2>
          <div class="actions">
            ${Auth.can("inventario","crear") ? '<button class="btn btn-primary" id="btn-adj">Ajuste de stock</button>' : ""}
            <button class="btn" id="btn-export">⬇ Excel</button>
          </div>
        </div>
        <div class="kpi-grid">
          <div class="kpi"><div class="label">Productos activos</div><div class="value">${rows.length}</div></div>
          <div class="kpi"><div class="label">Unidades en stock</div><div class="value">${totalUnidades}</div></div>
          <div class="kpi success"><div class="label">Inventario valorizado</div><div class="value">${U.money(total)}</div></div>
          <div class="kpi ${bajos ? "danger" : ""}"><div class="label">Bajo stock</div><div class="value">${bajos}</div></div>
        </div>
        <div class="filters">
          <label class="lbl">Buscar<input class="inp" id="f-search"></label>
          <label class="lbl">Estado
            <select class="sel" id="f-est">
              <option value="">Todos</option>
              <option value="bajo">Bajo stock</option>
              <option value="ok">Con stock OK</option>
              <option value="sin">Sin stock</option>
            </select>
          </label>
        </div>
        <div id="inv-list"></div>
      </div>
    `;

    function refresh() {
      const s = host.querySelector("#f-search").value.toLowerCase();
      const e = host.querySelector("#f-est").value;
      const filtered = rows.filter(r => {
        if (s && !(r.nombre.toLowerCase().includes(s) || r.sku.toLowerCase().includes(s))) return false;
        if (e === "bajo" && !r.bajo) return false;
        if (e === "ok" && (r.bajo || r.stock === 0)) return false;
        if (e === "sin" && r.stock !== 0) return false;
        return true;
      });
      host.querySelector("#inv-list").innerHTML = U.table([
        { key: "sku", label: "SKU" },
        { key: "nombre", label: "Producto" },
        { key: "stock", label: "Stock", render: r => r.bajo ? `<span class="tag tag-anulada">${r.stock}</span>` : r.stock },
        { key: "stock_minimo", label: "Mínimo" },
        { key: "cp", label: "Costo prom.", render: r => U.money(r.cp) },
        { key: "precio_venta", label: "Precio venta", render: r => U.money(r.precio_venta) },
        { key: "valor", label: "Valorizado", render: r => U.money(r.valor) },
        { key: "margen", label: "Margen", render: r => r.cp ? U.pct((r.precio_venta - r.cp) / r.precio_venta) : "—" },
        { key: "act", label: "", render: r => `<button class="btn btn-sm" data-kx="${r.id}">Kardex</button>` }
      ], filtered);
      host.querySelectorAll("[data-kx]").forEach(b => b.addEventListener("click", () => { viewKardex = Number(b.dataset.kx); render(); }));
    }
    host.querySelector("#f-search").addEventListener("input", refresh);
    host.querySelector("#f-est").addEventListener("change", refresh);
    host.querySelector("#btn-adj")?.addEventListener("click", openAjuste);
    host.querySelector("#btn-export").addEventListener("click", () => {
      U.exportCSV("inventario.csv", rows, [
        { key: "sku", label: "SKU" }, { key: "nombre", label: "Producto" },
        { key: "stock", label: "Stock" }, { key: "stock_minimo", label: "Mínimo" },
        { key: "cp", label: "Costo prom." }, { key: "precio_venta", label: "Precio" },
        { key: "valor", label: "Valor" }
      ]);
    });
    refresh();
  }

  function renderKardex() {
    const p = DB.get("productos", viewKardex);
    if (!p) { viewKardex = null; return render(); }
    const movs = DB.list("inventario_movimientos", { producto_id: viewKardex });
    const stock = DB.stockOf(p.id);
    const cp = DB.avgCostOf(p.id);

    host.innerHTML = `
      <div class="page">
        <div class="page-header">
          <h2>Kardex — ${U.escape(p.nombre)} <span class="muted" style="font-size:12px">(${U.escape(p.sku)})</span></h2>
          <div class="actions">
            <button class="btn btn-ghost" id="btn-back">← Volver</button>
            <button class="btn" id="btn-export">⬇ Excel</button>
          </div>
        </div>
        <div class="kpi-grid">
          <div class="kpi"><div class="label">Stock actual</div><div class="value">${stock}</div></div>
          <div class="kpi"><div class="label">Costo promedio</div><div class="value">${U.money(cp)}</div></div>
          <div class="kpi"><div class="label">Valor en bodega</div><div class="value">${U.money(stock * cp)}</div></div>
          <div class="kpi"><div class="label">Stock mínimo</div><div class="value">${p.stock_minimo}</div></div>
        </div>
        ${U.table([
          { key: "fecha", label: "Fecha", render: r => U.fmtDate(r.fecha) },
          { key: "tipo", label: "Tipo", render: r => `<span class="pill">${r.tipo}</span>` },
          { key: "ref", label: "Ref.", render: r => `${U.escape(r.referencia_tipo)}#${r.referencia_id}` },
          { key: "cantidad", label: "Cantidad", render: r => r.tipo === "salida" ? `-${r.cantidad}` : r.cantidad },
          { key: "costo_unitario", label: "Costo unit.", render: r => U.money(r.costo_unitario) },
          { key: "valor", label: "Valor mov.", render: r => U.money(r.valor) },
          { key: "saldo_cantidad", label: "Saldo cant." },
          { key: "saldo_valor", label: "Saldo valor", render: r => U.money(r.saldo_valor) },
          { key: "costo_promedio", label: "Costo prom.", render: r => U.money(r.costo_promedio) },
          { key: "motivo", label: "Motivo" }
        ], movs)}
      </div>
    `;
    host.querySelector("#btn-back").addEventListener("click", () => { viewKardex = null; render(); });
    host.querySelector("#btn-export").addEventListener("click", () => {
      U.exportCSV(`kardex_${p.sku}.csv`, movs, [
        { key: "fecha", label: "Fecha" }, { key: "tipo", label: "Tipo" },
        { key: "cantidad", label: "Cantidad" }, { key: "costo_unitario", label: "Costo" },
        { key: "saldo_cantidad", label: "Saldo cant." }, { key: "saldo_valor", label: "Saldo valor" },
        { key: "costo_promedio", label: "Costo prom." }, { key: "motivo", label: "Motivo" }
      ]);
    });
  }

  async function openAjuste() {
    const productos = DB.list("productos", { activo: true });
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <form class="modal" id="frm">
          <h3>Ajuste de inventario</h3>
          <label class="lbl">Producto
            <select class="sel" name="producto_id" required>
              <option value="">Selecciona...</option>
              ${productos.map(p => `<option value="${p.id}">${U.escape(p.sku)} — ${U.escape(p.nombre)} (stock: ${DB.stockOf(p.id)})</option>`).join("")}
            </select>
          </label>
          <label class="lbl">Cantidad final (nuevo stock)<input class="inp" type="number" name="cantidad_nueva" required></label>
          <label class="lbl">Motivo<input class="inp" name="motivo" required placeholder="Ej: conteo físico, daño, robo, donación..."></label>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Aplicar ajuste</button>
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
      const pid = U.num(data.producto_id);
      const nueva = U.num(data.cantidad_nueva);
      const actual = DB.stockOf(pid);
      const ajuste = DB.insert("ajustes_inventario", {
        fecha: U.nowISO(), producto_id: pid,
        cantidad_anterior: actual, cantidad_nueva: nueva,
        motivo: data.motivo, usuario_id: Auth.currentUser().id
      });
      DB.pushInvMovement({
        producto_id: pid, tipo: "ajuste",
        cantidad: nueva, costo_unitario: DB.avgCostOf(pid),
        referencia_tipo: "ajuste", referencia_id: ajuste.id,
        motivo: data.motivo
      });
      U.toast(`Ajuste aplicado (${actual} → ${nueva})`, "success");
      mdl.remove();
      render();
    });
  }

  function render() {
    if (viewKardex) renderKardex(); else renderGlobal();
  }
  render();
}, { module: "inventario" });
