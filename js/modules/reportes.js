// Reportes: ventas, compras, caja, inventario, utilidad, productos.
Router.register("/reportes", async (host) => {
  document.getElementById("page-title").textContent = "Reportes";
  const today = U.todayStr();
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0,10);

  host.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h2>Reportes</h2>
        <div class="actions">
          <button class="btn" id="btn-csv">⬇ Excel</button>
          <button class="btn" id="btn-pdf">📄 PDF</button>
        </div>
      </div>
      <div class="filters">
        <label class="lbl">Reporte
          <select class="sel" id="r-type">
            <option value="ventas">Ventas</option>
            <option value="compras">Compras</option>
            <option value="utilidad">Utilidad real</option>
            <option value="caja">Caja</option>
            <option value="inventario">Inventario</option>
            <option value="mas_vendidos">Productos más vendidos</option>
            <option value="bajo_stock">Productos con bajo stock</option>
            <option value="rentables">Productos más rentables</option>
            <option value="baja_utilidad">Productos con baja utilidad</option>
          </select>
        </label>
        <label class="lbl">Desde<input type="date" class="inp" id="r-from" value="${monthAgo}"></label>
        <label class="lbl">Hasta<input type="date" class="inp" id="r-to" value="${today}"></label>
        <label class="lbl">Agrupar
          <select class="sel" id="r-group">
            <option value="dia">Día</option>
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
          </select>
        </label>
      </div>
      <div id="r-out"></div>
    </div>
  `;

  function compute() {
    const type = host.querySelector("#r-type").value;
    const from = host.querySelector("#r-from").value;
    const to = host.querySelector("#r-to").value;
    const group = host.querySelector("#r-group").value;

    let html = "";
    let title = "";
    let csvRows = [];
    let csvCols = [];

    if (type === "ventas" || type === "utilidad") {
      const ventas = DB.list("ventas")
        .filter(v => v.estado !== "anulada")
        .filter(v => (v.fecha || "").slice(0,10) >= from && (v.fecha || "").slice(0,10) <= to);

      const groups = {};
      ventas.forEach(v => {
        const k = groupKey(v.fecha, group);
        groups[k] = groups[k] || { periodo: k, ventas: 0, total: 0, costo: 0, utilidad: 0 };
        groups[k].ventas++;
        groups[k].total += U.num(v.total);
        groups[k].costo += U.num(v.costo_total);
        groups[k].utilidad += U.num(v.utilidad);
      });
      const arr = Object.values(groups).sort((a,b) => a.periodo.localeCompare(b.periodo));
      const totT = arr.reduce((a,b) => a + b.total, 0);
      const totU = arr.reduce((a,b) => a + b.utilidad, 0);
      title = type === "utilidad" ? "Reporte de utilidad real" : "Reporte de ventas";
      html = `
        <div class="kpi-grid">
          <div class="kpi"><div class="label">Transacciones</div><div class="value">${ventas.length}</div></div>
          <div class="kpi"><div class="label">Total ventas</div><div class="value">${U.money(totT)}</div></div>
          <div class="kpi success"><div class="label">Utilidad</div><div class="value">${U.money(totU)}</div></div>
          <div class="kpi"><div class="label">Margen</div><div class="value">${totT ? U.pct(totU/totT) : "—"}</div></div>
        </div>
        ${U.table([
          { key: "periodo", label: "Periodo" },
          { key: "ventas", label: "# Ventas" },
          { key: "total", label: "Total", render: r => U.money(r.total) },
          { key: "costo", label: "Costo", render: r => U.money(r.costo) },
          { key: "utilidad", label: "Utilidad", render: r => U.money(r.utilidad) },
          { key: "margen", label: "Margen", render: r => r.total ? U.pct(r.utilidad/r.total) : "—" }
        ], arr)}
      `;
      csvRows = arr;
      csvCols = [
        { key: "periodo", label: "Periodo" }, { key: "ventas", label: "Ventas" },
        { key: "total", label: "Total" }, { key: "costo", label: "Costo" },
        { key: "utilidad", label: "Utilidad" }
      ];
    }
    else if (type === "compras") {
      const compras = DB.list("compras")
        .filter(c => c.estado !== "anulada")
        .filter(c => (c.fecha || "").slice(0,10) >= from && (c.fecha || "").slice(0,10) <= to);
      const byProv = {};
      compras.forEach(c => {
        const k = DB.get("proveedores", c.proveedor_id)?.nombre || "—";
        byProv[k] = byProv[k] || { proveedor: k, compras: 0, total: 0 };
        byProv[k].compras++;
        byProv[k].total += U.num(c.total);
      });
      const arr = Object.values(byProv).sort((a,b) => b.total - a.total);
      title = "Reporte de compras";
      html = `
        <div class="kpi-grid">
          <div class="kpi"><div class="label"># Compras</div><div class="value">${compras.length}</div></div>
          <div class="kpi"><div class="label">Total compras</div><div class="value">${U.money(arr.reduce((a,b)=>a+b.total,0))}</div></div>
        </div>
        ${U.table([
          { key: "proveedor", label: "Proveedor" },
          { key: "compras", label: "# Compras" },
          { key: "total", label: "Total", render: r => U.money(r.total) }
        ], arr)}
      `;
      csvRows = arr;
      csvCols = [{ key: "proveedor", label: "Proveedor" }, { key: "compras", label: "Compras" }, { key: "total", label: "Total" }];
    }
    else if (type === "caja") {
      const cajas = DB.list("cajas", { activo: true });
      const sections = cajas.map(c => {
        const movs = DB.list("caja_movimientos", { caja_id: c.id })
          .filter(m => (m.fecha || "").slice(0,10) >= from && (m.fecha || "").slice(0,10) <= to);
        const ingr = movs.filter(m => m.tipo === "ingreso").reduce((a,b) => a + U.num(b.monto), 0);
        const egr = movs.filter(m => m.tipo === "egreso").reduce((a,b) => a + U.num(b.monto), 0);
        return { caja: c.nombre, movimientos: movs.length, ingresos: ingr, egresos: egr, neto: ingr - egr, saldo: DB.cajaBalance(c.id) };
      });
      title = "Reporte de caja";
      html = U.table([
        { key: "caja", label: "Caja" },
        { key: "movimientos", label: "# Movs." },
        { key: "ingresos", label: "Ingresos", render: r => U.money(r.ingresos) },
        { key: "egresos", label: "Egresos", render: r => U.money(r.egresos) },
        { key: "neto", label: "Neto", render: r => U.money(r.neto) },
        { key: "saldo", label: "Saldo total", render: r => U.money(r.saldo) }
      ], sections);
      csvRows = sections;
      csvCols = [{ key: "caja", label: "Caja" }, { key: "movimientos", label: "Movs" }, { key: "ingresos", label: "Ingresos" }, { key: "egresos", label: "Egresos" }, { key: "neto", label: "Neto" }, { key: "saldo", label: "Saldo" }];
    }
    else if (type === "inventario") {
      const arr = DB.list("productos", { activo: true }).map(p => ({
        sku: p.sku, nombre: p.nombre, stock: DB.stockOf(p.id), minimo: p.stock_minimo,
        costo: DB.avgCostOf(p.id), valor: DB.stockOf(p.id) * DB.avgCostOf(p.id)
      }));
      title = "Reporte de inventario";
      html = `
        <div class="kpi-grid">
          <div class="kpi"><div class="label">Productos</div><div class="value">${arr.length}</div></div>
          <div class="kpi"><div class="label">Unidades</div><div class="value">${arr.reduce((a,b)=>a+b.stock,0)}</div></div>
          <div class="kpi success"><div class="label">Valor total</div><div class="value">${U.money(arr.reduce((a,b)=>a+b.valor,0))}</div></div>
        </div>
        ${U.table([
          { key: "sku", label: "SKU" }, { key: "nombre", label: "Producto" },
          { key: "stock", label: "Stock" }, { key: "minimo", label: "Mín." },
          { key: "costo", label: "Costo", render: r => U.money(r.costo) },
          { key: "valor", label: "Valor", render: r => U.money(r.valor) }
        ], arr)}
      `;
      csvRows = arr;
      csvCols = [{ key: "sku", label: "SKU" }, { key: "nombre", label: "Producto" }, { key: "stock", label: "Stock" }, { key: "minimo", label: "Min" }, { key: "costo", label: "Costo" }, { key: "valor", label: "Valor" }];
    }
    else if (type === "mas_vendidos" || type === "rentables" || type === "baja_utilidad") {
      const det = DB.list("ventas_detalle").filter(d => {
        const v = DB.get("ventas", d.venta_id);
        return v && v.estado !== "anulada" && (v.fecha || "").slice(0,10) >= from && (v.fecha || "").slice(0,10) <= to;
      });
      const map = {};
      det.forEach(d => {
        map[d.producto_id] = map[d.producto_id] || { cantidad: 0, ingresos: 0, utilidad: 0 };
        map[d.producto_id].cantidad += U.num(d.cantidad);
        map[d.producto_id].ingresos += U.num(d.subtotal);
        map[d.producto_id].utilidad += U.num(d.utilidad);
      });
      let arr = Object.entries(map).map(([pid, x]) => {
        const p = DB.get("productos", Number(pid));
        return { producto: p?.nombre || "—", sku: p?.sku || "", ...x, margen: x.ingresos ? x.utilidad / x.ingresos : 0 };
      });
      if (type === "mas_vendidos") arr.sort((a,b) => b.cantidad - a.cantidad);
      else if (type === "rentables") arr.sort((a,b) => b.utilidad - a.utilidad);
      else arr.sort((a,b) => a.margen - b.margen);
      title = type === "mas_vendidos" ? "Productos más vendidos" : type === "rentables" ? "Productos más rentables" : "Productos con baja utilidad";
      html = U.table([
        { key: "sku", label: "SKU" }, { key: "producto", label: "Producto" },
        { key: "cantidad", label: "Vendidos" },
        { key: "ingresos", label: "Ingresos", render: r => U.money(r.ingresos) },
        { key: "utilidad", label: "Utilidad", render: r => U.money(r.utilidad) },
        { key: "margen", label: "Margen", render: r => U.pct(r.margen) }
      ], arr);
      csvRows = arr;
      csvCols = [{ key: "sku", label: "SKU" }, { key: "producto", label: "Producto" }, { key: "cantidad", label: "Vendidos" }, { key: "ingresos", label: "Ingresos" }, { key: "utilidad", label: "Utilidad" }];
    }
    else if (type === "bajo_stock") {
      const arr = DB.list("productos", { activo: true })
        .map(p => ({ sku: p.sku, nombre: p.nombre, stock: DB.stockOf(p.id), minimo: U.num(p.stock_minimo) }))
        .filter(x => x.stock < x.minimo);
      title = "Productos con bajo stock";
      html = U.table([
        { key: "sku", label: "SKU" }, { key: "nombre", label: "Producto" },
        { key: "stock", label: "Stock" }, { key: "minimo", label: "Mínimo" },
        { key: "falta", label: "Faltan", render: r => Math.max(0, r.minimo - r.stock) }
      ], arr);
      csvRows = arr;
      csvCols = [{ key: "sku", label: "SKU" }, { key: "nombre", label: "Producto" }, { key: "stock", label: "Stock" }, { key: "minimo", label: "Mínimo" }];
    }

    host.querySelector("#r-out").innerHTML = `<h3>${U.escape(title)} <span class="muted" style="font-size:12px">(${from} → ${to})</span></h3>${html}`;
    host._currentReport = { title, csvRows, csvCols };
  }

  function groupKey(iso, mode) {
    const d = new Date(iso);
    if (mode === "dia") return iso.slice(0,10);
    if (mode === "mes") return iso.slice(0,7);
    // semana: año-semana
    const year = d.getFullYear();
    const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400_000) + new Date(year, 0, 1).getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2,"0")}`;
  }

  ["#r-type","#r-from","#r-to","#r-group"].forEach(s => host.querySelector(s).addEventListener("input", compute));

  host.querySelector("#btn-csv").addEventListener("click", () => {
    const r = host._currentReport;
    if (!r) return;
    U.exportCSV(`reporte_${r.title.toLowerCase().replace(/\s+/g,"_")}.csv`, r.csvRows, r.csvCols);
  });
  host.querySelector("#btn-pdf").addEventListener("click", () => {
    const r = host._currentReport;
    U.exportPDF(r?.title || "Reporte", host.querySelector("#r-out").innerHTML);
  });

  compute();
}, { module: "reportes" });
