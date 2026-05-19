// Dashboard principal con resumen de ventas, compras, caja, inventario, utilidades.
Router.register("/dashboard", async (host) => {
  document.getElementById("page-title").textContent = "Dashboard";

  const today = U.todayStr();
  const monthStart = today.slice(0, 7) + "-01";

  const ventas = DB.list("ventas").filter(v => v.estado !== "anulada");
  const compras = DB.list("compras").filter(c => c.estado !== "anulada");
  const productos = DB.list("productos", { activo: true });

  const ventasHoy = ventas.filter(v => (v.fecha || v.created_at || "").slice(0, 10) === today);
  const ventasMes = ventas.filter(v => (v.fecha || v.created_at || "") >= monthStart);
  const comprasHoy = compras.filter(c => (c.fecha || c.created_at || "").slice(0, 10) === today);
  const comprasMes = compras.filter(c => (c.fecha || c.created_at || "") >= monthStart);

  const sum = (arr, k) => arr.reduce((a, b) => a + U.num(b[k]), 0);

  const totalVentasHoy = sum(ventasHoy, "total");
  const utilidadHoy = sum(ventasHoy, "utilidad");
  const utilidadMes = sum(ventasMes, "utilidad");
  const totalComprasHoy = sum(comprasHoy, "total");

  // saldo caja principal
  const cajaPrincipal = DB.list("cajas")[0];
  const saldoCaja = cajaPrincipal ? DB.cajaBalance(cajaPrincipal.id) : 0;

  // inventario valorizado
  let invValor = 0, bajoStock = 0;
  productos.forEach(p => {
    const stock = DB.stockOf(p.id);
    const costo = DB.avgCostOf(p.id);
    invValor += stock * costo;
    if (stock < U.num(p.stock_minimo)) bajoStock++;
  });

  // top 5 productos vendidos del mes
  const detVentasMes = DB.list("ventas_detalle").filter(d => {
    const v = DB.get("ventas", d.venta_id);
    return v && v.estado !== "anulada" && (v.fecha || v.created_at) >= monthStart;
  });
  const topMap = {};
  detVentasMes.forEach(d => {
    topMap[d.producto_id] = (topMap[d.producto_id] || { qty: 0, util: 0 });
    topMap[d.producto_id].qty += U.num(d.cantidad);
    topMap[d.producto_id].util += U.num(d.utilidad);
  });
  const topProductos = Object.entries(topMap)
    .map(([pid, x]) => ({ producto: DB.get("productos", Number(pid)), ...x }))
    .filter(x => x.producto)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // últimas 5 ventas
  const ultVentas = [...ventas].slice(-5).reverse();
  // últimas 5 compras
  const ultCompras = [...compras].slice(-5).reverse();
  // productos con bajo stock
  const bajos = productos
    .map(p => ({ p, stock: DB.stockOf(p.id) }))
    .filter(x => x.stock < U.num(x.p.stock_minimo))
    .slice(0, 8);

  host.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h2>Resumen</h2>
        <div class="actions">
          <a href="#/pos" class="btn" style="background:var(--accent);color:#1a1a1a;font-weight:700">💳 Punto de venta <kbd class="hint" style="background:rgba(0,0,0,.15);color:#1a1a1a">F12</kbd></a>
          <span class="muted" style="font-size:12px;align-self:center">Hoy: ${new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><div class="label">Ventas hoy</div><div class="value">${U.money(totalVentasHoy)}</div><div class="delta muted">${ventasHoy.length} transacciones</div></div>
        <div class="kpi success"><div class="label">Utilidad hoy</div><div class="value">${U.money(utilidadHoy)}</div><div class="delta muted">Margen ${totalVentasHoy ? U.pct(utilidadHoy / totalVentasHoy) : "0%"}</div></div>
        <div class="kpi"><div class="label">Ventas del mes</div><div class="value">${U.money(sum(ventasMes, "total"))}</div><div class="delta muted">${ventasMes.length} transacciones</div></div>
        <div class="kpi success"><div class="label">Utilidad mes</div><div class="value">${U.money(utilidadMes)}</div></div>
        <div class="kpi"><div class="label">Compras hoy</div><div class="value">${U.money(totalComprasHoy)}</div><div class="delta muted">${comprasHoy.length} facturas</div></div>
        <div class="kpi"><div class="label">Saldo caja</div><div class="value">${U.money(saldoCaja)}</div><div class="delta muted">${cajaPrincipal?.nombre || "—"}</div></div>
        <div class="kpi"><div class="label">Inventario valorizado</div><div class="value">${U.money(invValor)}</div><div class="delta muted">${productos.length} productos</div></div>
        <div class="kpi ${bajoStock ? "danger" : ""}"><div class="label">Bajo stock</div><div class="value">${bajoStock}</div><div class="delta muted">productos &lt; mínimo</div></div>
      </div>

      <div class="grid grid-2">
        <div>
          <h3 style="margin:18px 0 10px">Top productos del mes</h3>
          ${U.table([
            { key: "n", label: "Producto", render: r => U.escape(r.producto.nombre) },
            { key: "qty", label: "Vendidos", render: r => r.qty },
            { key: "util", label: "Utilidad", render: r => U.money(r.util) }
          ], topProductos, { empty: "Sin ventas en el mes" })}
        </div>
        <div>
          <h3 style="margin:18px 0 10px">Productos con bajo stock</h3>
          ${U.table([
            { key: "n", label: "Producto", render: r => U.escape(r.p.nombre) },
            { key: "stock", label: "Stock", render: r => `<span class="tag tag-anulada">${r.stock}</span>` },
            { key: "min", label: "Mínimo", render: r => U.num(r.p.stock_minimo) }
          ], bajos, { empty: "Sin alertas" })}
        </div>
      </div>

      <div class="grid grid-2">
        <div>
          <h3 style="margin:18px 0 10px">Últimas ventas</h3>
          ${U.table([
            { key: "id", label: "#" },
            { key: "fecha", label: "Fecha", render: r => U.fmtDateShort(r.fecha || r.created_at) },
            { key: "total", label: "Total", render: r => U.money(r.total) },
            { key: "util", label: "Utilidad", render: r => U.money(r.utilidad) },
            { key: "estado", label: "Estado", render: r => `<span class="tag tag-${r.estado}">${U.escape(r.estado)}</span>` }
          ], ultVentas, { empty: "Sin ventas aún" })}
        </div>
        <div>
          <h3 style="margin:18px 0 10px">Últimas compras</h3>
          ${U.table([
            { key: "id", label: "#" },
            { key: "fecha", label: "Fecha", render: r => U.fmtDateShort(r.fecha || r.created_at) },
            { key: "proveedor", label: "Proveedor", render: r => U.escape(DB.get("proveedores", r.proveedor_id)?.nombre || "—") },
            { key: "total", label: "Total", render: r => U.money(r.total) },
            { key: "estado", label: "Estado", render: r => `<span class="tag tag-${r.estado}">${U.escape(r.estado)}</span>` }
          ], ultCompras, { empty: "Sin compras aún" })}
        </div>
      </div>
    </div>
  `;
}, { module: "dashboard" });
