// Capa de base de datos. Modo demo (localStorage) o producción (Apps Script).
const DB = (() => {
  const KEY = APP_CONFIG.storageKey;

  const TABLES = [
    "usuarios","roles","permisos","roles_permisos","sesiones",
    "clientes","proveedores","categorias","productos","metodos_pago","cajas",
    "compras","compras_detalle","historial_costos",
    "ventas","ventas_detalle",
    "caja_movimientos","caja_sesiones",
    "comprobantes_egreso",
    "inventario_movimientos","ajustes_inventario",
    "facturas_telegram","telegram_logs","telegram_usuarios_autorizados",
    "config","auditoria"
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

  function emptyDB() {
    const d = {};
    TABLES.forEach(t => d[t] = []);
    d._seq = {};
    return d;
  }

  async function seed() {
    const d = emptyDB();

    // roles
    d.roles.push({ id: 1, nombre: "Administrador", descripcion: "Acceso total", activo: true });
    d.roles.push({ id: 2, nombre: "Vendedor", descripcion: "Ventas y caja", activo: true });
    d.roles.push({ id: 3, nombre: "Bodega", descripcion: "Inventario", activo: true });

    // permisos
    const modulos = ["dashboard","usuarios","clientes","proveedores","productos","categorias","metodos_pago","cajas","compras","ventas","caja","egresos","inventario","reportes","costos","telegram","config"];
    const acciones = ["ver","crear","editar","anular"];
    let pid = 1;
    modulos.forEach(m => acciones.forEach(a => d.permisos.push({ id: pid++, modulo: m, accion: a })));

    // admin tiene todo
    d.permisos.forEach(p => d.roles_permisos.push({ rol_id: 1, permiso_id: p.id }));
    // vendedor: ver dashboard, ver/crear ventas, ver caja, ver productos/clientes, crear cliente
    d.permisos.filter(p =>
      (p.modulo === "dashboard" && p.accion === "ver") ||
      (p.modulo === "ventas" && ["ver","crear","anular"].includes(p.accion)) ||
      (p.modulo === "caja" && p.accion === "ver") ||
      (p.modulo === "productos" && p.accion === "ver") ||
      (p.modulo === "clientes" && ["ver","crear","editar"].includes(p.accion)) ||
      (p.modulo === "reportes" && p.accion === "ver")
    ).forEach(p => d.roles_permisos.push({ rol_id: 2, permiso_id: p.id }));
    // bodega: ver dashboard, ver/crear inventario, ver productos, ver compras
    d.permisos.filter(p =>
      (p.modulo === "dashboard" && p.accion === "ver") ||
      (p.modulo === "inventario") ||
      (p.modulo === "productos" && ["ver","crear","editar"].includes(p.accion)) ||
      (p.modulo === "compras" && ["ver","crear"].includes(p.accion))
    ).forEach(p => d.roles_permisos.push({ rol_id: 3, permiso_id: p.id }));

    // usuario admin
    const salt = U.uid();
    const hash = await U.sha256("admin123" + salt);
    d.usuarios.push({
      id: 1, username: "admin", password_hash: hash, salt, nombre: "Administrador",
      email: "admin@papeleria.local", rol_id: 1, telegram_id: "", activo: true,
      created_at: U.nowISO()
    });

    // métodos de pago
    d.metodos_pago.push({ id: 1, nombre: "Efectivo", tipo: "efectivo", activo: true });
    d.metodos_pago.push({ id: 2, nombre: "Transferencia", tipo: "transferencia", activo: true });
    d.metodos_pago.push({ id: 3, nombre: "Tarjeta débito", tipo: "tarjeta", activo: true });
    d.metodos_pago.push({ id: 4, nombre: "Tarjeta crédito", tipo: "tarjeta", activo: true });

    // caja principal
    d.cajas.push({ id: 1, nombre: "Caja Principal", activo: true });

    // categorías ejemplo
    ["Útiles escolares","Oficina","Arte","Tecnología","Otros"].forEach((n, i) => {
      d.categorias.push({ id: i + 1, nombre: n, descripcion: "", activo: true });
    });

    // productos ejemplo
    [
      { sku: "LAP001", nombre: "Lapicero negro BIC", categoria_id: 1, precio_venta: 1500, costo_promedio: 800, stock_minimo: 20 },
      { sku: "CUA001", nombre: "Cuaderno argollado 100h", categoria_id: 1, precio_venta: 9500, costo_promedio: 5500, stock_minimo: 10 },
      { sku: "REG001", nombre: "Regla 30cm", categoria_id: 1, precio_venta: 2500, costo_promedio: 1200, stock_minimo: 15 },
      { sku: "TIN001", nombre: "Tinta para impresora", categoria_id: 4, precio_venta: 35000, costo_promedio: 22000, stock_minimo: 5 }
    ].forEach((p, i) => {
      d.productos.push({
        id: i + 1, ...p, unidad: "und",
        activo: true, created_at: U.nowISO(), created_by: 1
      });
    });

    // config
    [
      { clave: "empresa_nombre", valor: "Isaac Papelería", descripcion: "Nombre del negocio" },
      { clave: "empresa_nit", valor: "", descripcion: "NIT / RUC" },
      { clave: "empresa_direccion", valor: "", descripcion: "Dirección" },
      { clave: "empresa_telefono", valor: "", descripcion: "Teléfono" },
      { clave: "iva_default", valor: "0.19", descripcion: "IVA por defecto" },
      { clave: "moneda", valor: "$", descripcion: "Símbolo moneda" }
    ].forEach((c, i) => d.config.push({ id: i + 1, ...c }));

    // secuencias
    d._seq = {
      usuarios: 1, roles: 3, permisos: pid - 1, clientes: 0, proveedores: 0,
      categorias: 5, productos: 4, metodos_pago: 4, cajas: 1,
      compras: 0, compras_detalle: 0, historial_costos: 0,
      ventas: 0, ventas_detalle: 0,
      caja_movimientos: 0, caja_sesiones: 0, comprobantes_egreso: 0,
      inventario_movimientos: 0, ajustes_inventario: 0,
      facturas_telegram: 0, telegram_logs: 0, config: 6, auditoria: 0
    };

    save(d);
    return d;
  }

  async function init() {
    let d = load();
    if (!d) d = await seed();
    return d;
  }

  function getDB() { return load() || emptyDB(); }
  function setDB(d) { save(d); }

  function nextId(table) {
    const d = getDB();
    d._seq = d._seq || {};
    d._seq[table] = (d._seq[table] || 0) + 1;
    setDB(d);
    return d._seq[table];
  }

  // CRUD genérico
  function list(table, filter = {}) {
    const d = getDB();
    let rows = d[table] || [];
    if (filter && Object.keys(filter).length) {
      rows = rows.filter(r => Object.entries(filter).every(([k, v]) => String(r[k] ?? "") === String(v)));
    }
    return rows;
  }

  function get(table, id) {
    return (getDB()[table] || []).find(r => String(r.id) === String(id));
  }

  function insert(table, row) {
    const d = getDB();
    d[table] = d[table] || [];
    if (!row.id) row.id = nextId(table);
    if (!row.created_at) row.created_at = U.nowISO();
    d[table].push(row);
    setDB(d);
    audit(table, "crear", row.id, row);
    return row;
  }

  function update(table, id, patch) {
    const d = getDB();
    const i = (d[table] || []).findIndex(r => String(r.id) === String(id));
    if (i < 0) throw new Error("Registro no encontrado: " + table + "#" + id);
    d[table][i] = { ...d[table][i], ...patch, updated_at: U.nowISO() };
    setDB(d);
    audit(table, "editar", id, patch);
    return d[table][i];
  }

  function voidRow(table, id, motivo, userId) {
    const d = getDB();
    const i = (d[table] || []).findIndex(r => String(r.id) === String(id));
    if (i < 0) throw new Error("Registro no encontrado");
    d[table][i] = {
      ...d[table][i],
      estado: "anulada",
      anulada_motivo: motivo,
      anulada_by: userId,
      anulada_at: U.nowISO()
    };
    setDB(d);
    audit(table, "anular", id, { motivo });
    return d[table][i];
  }

  function audit(modulo, accion, entidadId, detalle) {
    const d = getDB();
    const user = Auth.currentUser();
    d.auditoria = d.auditoria || [];
    d.auditoria.push({
      id: nextId("auditoria"),
      fecha: U.nowISO(),
      usuario_id: user?.id || 0,
      modulo, accion, entidad: modulo, entidad_id: entidadId,
      detalle_json: typeof detalle === "string" ? detalle : JSON.stringify(detalle ?? {})
    });
    setDB(d);
  }

  // Helpers de inventario
  function lastInvMovement(productoId) {
    const movs = list("inventario_movimientos", {}).filter(m => String(m.producto_id) === String(productoId));
    return movs.length ? movs[movs.length - 1] : null;
  }

  function stockOf(productoId) {
    const m = lastInvMovement(productoId);
    return m ? U.num(m.saldo_cantidad) : 0;
  }

  function avgCostOf(productoId) {
    const m = lastInvMovement(productoId);
    if (m) return U.num(m.costo_promedio);
    const p = get("productos", productoId);
    return p ? U.num(p.costo_promedio) : 0;
  }

  function pushInvMovement({ producto_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, motivo, fecha }) {
    const d = getDB();
    const prev = lastInvMovement(producto_id);
    const prevQty = prev ? U.num(prev.saldo_cantidad) : 0;
    const prevValor = prev ? U.num(prev.saldo_valor) : 0;
    const qty = U.num(cantidad);
    const cu = U.num(costo_unitario);
    let saldoQty, saldoValor, costoPromedio;

    if (tipo === "entrada") {
      saldoQty = prevQty + qty;
      saldoValor = prevValor + qty * cu;
      costoPromedio = saldoQty > 0 ? saldoValor / saldoQty : cu;
    } else if (tipo === "salida") {
      saldoQty = prevQty - qty;
      const cp = prev ? U.num(prev.costo_promedio) : cu;
      saldoValor = saldoQty * cp;
      costoPromedio = cp;
    } else { // ajuste
      saldoQty = qty; // ajuste a cantidad final
      const cp = prev ? U.num(prev.costo_promedio) : cu || avgCostOf(producto_id);
      saldoValor = saldoQty * cp;
      costoPromedio = cp;
    }

    const mov = {
      id: nextId("inventario_movimientos"),
      fecha: fecha || U.nowISO(),
      producto_id, tipo,
      cantidad: qty,
      costo_unitario: cu,
      valor: qty * cu,
      saldo_cantidad: saldoQty,
      saldo_valor: saldoValor,
      costo_promedio: costoPromedio,
      referencia_tipo: referencia_tipo || "",
      referencia_id: referencia_id || 0,
      motivo: motivo || "",
      usuario_id: Auth.currentUser()?.id || 0
    };
    d.inventario_movimientos.push(mov);
    // refrescar costo_promedio en producto
    const pi = d.productos.findIndex(p => p.id === producto_id);
    if (pi >= 0) d.productos[pi].costo_promedio = costoPromedio;
    setDB(d);
    return mov;
  }

  // Caja
  function activeCajaSession(cajaId) {
    return list("caja_sesiones", { caja_id: cajaId, estado: "abierta" }).slice(-1)[0] || null;
  }

  function pushCajaMov({ caja_id, fecha, tipo, concepto, referencia_tipo, referencia_id, metodo_pago_id, monto }) {
    return insert("caja_movimientos", {
      caja_id, fecha: fecha || U.nowISO(), tipo, concepto,
      referencia_tipo: referencia_tipo || "", referencia_id: referencia_id || 0,
      metodo_pago_id: metodo_pago_id || 0, monto: U.num(monto),
      usuario_id: Auth.currentUser()?.id || 0
    });
  }

  function cajaBalance(cajaId, untilISO) {
    let rows = list("caja_movimientos", { caja_id: cajaId });
    if (untilISO) rows = rows.filter(r => new Date(r.fecha) <= new Date(untilISO));
    let saldo = 0;
    rows.forEach(r => {
      if (["apertura","ingreso","ajuste"].includes(r.tipo) && U.num(r.monto) > 0) saldo += U.num(r.monto);
      else if (r.tipo === "egreso") saldo -= U.num(r.monto);
      else if (r.tipo === "cierre") {/* informativo */}
      else if (r.tipo === "ajuste") saldo += U.num(r.monto); // monto puede ser negativo
    });
    return saldo;
  }

  // API remota (apps script)
  async function remote(action, payload) {
    if (!APP_CONFIG.apiUrl) throw new Error("API no configurada (modo demo).");
    const res = await fetch(APP_CONFIG.apiUrl + "?action=" + encodeURIComponent(action), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, token: Auth.token() })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Error remoto");
    return data.data;
  }

  // Restablecer demo
  async function resetDemo() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(APP_CONFIG.sessionKey);
    await seed();
  }

  return {
    init, getDB, setDB, nextId,
    list, get, insert, update, voidRow, audit,
    stockOf, avgCostOf, lastInvMovement, pushInvMovement,
    activeCajaSession, pushCajaMov, cajaBalance,
    remote, resetDemo, TABLES
  };
})();

window.DB = DB;
