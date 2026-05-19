// Capa de base de datos. Modo demo (localStorage) o producción (Apps Script).

// ============= Catálogo inicial KAM Papelería (Ecuador / USD) =============
const KAM_CATEGORIAS = ["Útiles escolares", "Oficina", "Papelería", "Arte y manualidades"];

const KAM_PRODUCTOS = [
  { sku: "BOR001", nombre: "Borradores artesco", categoria: "Útiles escolares", costo: 0.13, precio: 0.50, stock: 20, min: 3 },
  { sku: "CAR001", nombre: "Carpeta de colores con membrete creativ", categoria: "Oficina", costo: 0.34, precio: 1.00, stock: 12, min: 2 },
  { sku: "CAR002", nombre: "Carpetas escribe tapa transparente", categoria: "Oficina", costo: 0.39, precio: 1.00, stock: 8, min: 2 },
  { sku: "CRT001", nombre: "Cartulina lancer bristol A3 blanca", categoria: "Arte y manualidades", costo: 0.05, precio: 0.25, stock: 75, min: 11 },
  { sku: "CRT002", nombre: "Cartulina lancer bristol A4 colores", categoria: "Arte y manualidades", costo: 0.03, precio: 0.15, stock: 75, min: 11 },
  { sku: "CRT003", nombre: "Cartulina lancer de hilo A4", categoria: "Arte y manualidades", costo: 0.08, precio: 0.25, stock: 25, min: 3 },
  { sku: "CRT004", nombre: "Cartulina lancer iris block A4 surtido", categoria: "Arte y manualidades", costo: 0.04, precio: 0.20, stock: 120, min: 18 },
  { sku: "CRT005", nombre: "Cartulina lancer marfil blanca A4", categoria: "Arte y manualidades", costo: 0.03, precio: 0.20, stock: 75, min: 11 },
  { sku: "CRT006", nombre: "Cartulina sucre A4 dibujo técnico", categoria: "Arte y manualidades", costo: 0.03, precio: 0.15, stock: 150, min: 22 },
  { sku: "CIN001", nombre: "Cinta Scoth jeff 18 MMx36 yds", categoria: "Oficina", costo: 0.17, precio: 1.00, stock: 4, min: 2 },
  { sku: "CMP001", nombre: "Compás lancer", categoria: "Útiles escolares", costo: 1.04, precio: 2.50, stock: 6, min: 2 },
  { sku: "COR001", nombre: "Corrector Bester 7 ml", categoria: "Oficina", costo: 0.36, precio: 1.00, stock: 12, min: 2 },
  { sku: "CRM001", nombre: "Cromos COPA MUNDIAL 2026", categoria: "Arte y manualidades", costo: 1.20, precio: 1.50, stock: 208, min: 31 },
  { sku: "CUA001", nombre: "Cuaderno estilo 100 hojas", categoria: "Papelería", costo: 1.10, precio: 2.00, stock: 6, min: 2 },
  { sku: "ESL001", nombre: "Escalímetro lancer 30 cm", categoria: "Útiles escolares", costo: 0.99, precio: 2.00, stock: 12, min: 2 },
  { sku: "ESR001", nombre: "Escarcha creative", categoria: "Arte y manualidades", costo: 0.05, precio: 0.25, stock: 40, min: 6 },
  { sku: "ESF001", nombre: "Esfero BIG BL/NG/RJ", categoria: "Útiles escolares", costo: 0.28, precio: 0.75, stock: 144, min: 21 },
  { sku: "ESF002", nombre: "Esfero vanyla colores", categoria: "Útiles escolares", costo: 0.32, precio: 0.75, stock: 12, min: 2 },
  { sku: "FOL001", nombre: "Folder cartón ideal surtida", categoria: "Oficina", costo: 0.20, precio: 0.50, stock: 20, min: 3 },
  { sku: "FOL002", nombre: "Folder cartón sucre manila crema", categoria: "Oficina", costo: 0.07, precio: 0.25, stock: 10, min: 2 },
  { sku: "FMX001", nombre: "Fómix arcoíris surtido lancer A4", categoria: "Arte y manualidades", costo: 0.24, precio: 0.75, stock: 10, min: 2 },
  { sku: "FMX002", nombre: "Fómix creativ normal amarillo A4", categoria: "Arte y manualidades", costo: 0.05, precio: 0.25, stock: 10, min: 2 },
  { sku: "FMX003", nombre: "Fómix creativ normal azul A4", categoria: "Arte y manualidades", costo: 0.05, precio: 0.25, stock: 10, min: 2 },
  { sku: "FMX004", nombre: "Fómix creativ normal fucsia A4", categoria: "Arte y manualidades", costo: 0.05, precio: 0.25, stock: 10, min: 2 },
  { sku: "FMX005", nombre: "Fómix creativ normal negro A4", categoria: "Arte y manualidades", costo: 0.05, precio: 0.25, stock: 10, min: 2 },
  { sku: "FMX006", nombre: "Fómix láncer A4 toalla", categoria: "Arte y manualidades", costo: 0.11, precio: 0.40, stock: 30, min: 4 },
  { sku: "FMX007", nombre: "Fómix lancer normal blanco A4", categoria: "Arte y manualidades", costo: 0.05, precio: 0.25, stock: 10, min: 2 },
  { sku: "FMX008", nombre: "Fómix lancer normal rojo A4", categoria: "Arte y manualidades", costo: 0.05, precio: 0.25, stock: 10, min: 2 },
  { sku: "FMX009", nombre: "Fómix lancer normal verde agua A4", categoria: "Arte y manualidades", costo: 0.05, precio: 0.25, stock: 10, min: 2 },
  { sku: "FMX010", nombre: "Fómix passola escarchado A4 surtido", categoria: "Arte y manualidades", costo: 0.09, precio: 0.40, stock: 20, min: 3 },
  { sku: "GLB001", nombre: "Globos surtidos sempertex N9", categoria: "Arte y manualidades", costo: 0.05, precio: 0.15, stock: 100, min: 15 },
  { sku: "GOM001", nombre: "Goma passola barra 36 gr", categoria: "Oficina", costo: 0.29, precio: 1.00, stock: 12, min: 2 },
  { sku: "GRD001", nombre: "Graduador jeff de círculos 12 cm", categoria: "Útiles escolares", costo: 0.19, precio: 0.75, stock: 12, min: 2 },
  { sku: "HOJ001", nombre: "Hoja lancer milimetrada A4", categoria: "Papelería", costo: 0.01, precio: 0.10, stock: 150, min: 22 },
  { sku: "HOJ002", nombre: "Hojas a cuadro ESCRIBE A4", categoria: "Papelería", costo: 0.38, precio: 1.00, stock: 10, min: 2 },
  { sku: "HOJ003", nombre: "Hojas lancer ministro", categoria: "Papelería", costo: 0.03, precio: 0.20, stock: 80, min: 12 },
  { sku: "JGM001", nombre: "Juego geométrico jeff flexible color 30 cm", categoria: "Útiles escolares", costo: 0.80, precio: 2.00, stock: 12, min: 2 },
  { sku: "LAP001", nombre: "Lápiz passola grafito amarillo", categoria: "Útiles escolares", costo: 0.08, precio: 0.25, stock: 40, min: 6 },
  { sku: "MAR001", nombre: "Marcador lancer disney avengers", categoria: "Útiles escolares", costo: 1.94, precio: 3.50, stock: 3, min: 2 },
  { sku: "MAR002", nombre: "Marcador lancer disney moana", categoria: "Útiles escolares", costo: 1.94, precio: 3.50, stock: 3, min: 2 },
  { sku: "NOT001", nombre: "Notitas adhesivas creativ colores", categoria: "Oficina", costo: 0.40, precio: 1.00, stock: 3, min: 2 },
  { sku: "OJO001", nombre: "Ojos movibles estilo", categoria: "Arte y manualidades", costo: 0.01, precio: 0.10, stock: 60, min: 9 },
  { sku: "PAP001", nombre: "Papel fotográfico", categoria: "Papelería", costo: 0.09, precio: 0.50, stock: 10, min: 2 },
  { sku: "PAP002", nombre: "Papelógrafo de cuadros", categoria: "Arte y manualidades", costo: 0.09, precio: 0.50, stock: 50, min: 7 },
  { sku: "PEL001", nombre: "Pelotas ping pong", categoria: "Arte y manualidades", costo: 0.16, precio: 0.50, stock: 18, min: 2 },
  { sku: "REG001", nombre: "Regla nataraj 621 plástica 30cm", categoria: "Útiles escolares", costo: 0.31, precio: 0.75, stock: 10, min: 2 },
  { sku: "SAC001", nombre: "Sacapunta passola 1 servicio", categoria: "Útiles escolares", costo: 0.08, precio: 0.25, stock: 20, min: 3 },
  { sku: "SIL001", nombre: "Silicón líquido passola 60ml", categoria: "Oficina", costo: 0.34, precio: 1.00, stock: 6, min: 2 },
  { sku: "STK001", nombre: "Sticker fómix aprendo letras grande", categoria: "Arte y manualidades", costo: 1.02, precio: 2.00, stock: 2, min: 2 },
  { sku: "STK002", nombre: "Sticker fómix aprendo letras pequeño", categoria: "Arte y manualidades", costo: 0.68, precio: 1.50, stock: 2, min: 2 },
  { sku: "STK003", nombre: "Sticker fómix lancer caritas", categoria: "Arte y manualidades", costo: 0.70, precio: 1.50, stock: 2, min: 2 },
  { sku: "STK004", nombre: "Sticker fómix lancer caritas 3D", categoria: "Arte y manualidades", costo: 0.60, precio: 1.25, stock: 2, min: 2 },
  { sku: "STK005", nombre: "Sticker fómix lancer corazones", categoria: "Arte y manualidades", costo: 0.68, precio: 1.25, stock: 2, min: 2 },
  { sku: "STK006", nombre: "Sticker fómix lancer dinosaurios", categoria: "Arte y manualidades", costo: 0.60, precio: 1.25, stock: 2, min: 2 },
  { sku: "STK007", nombre: "Sticker fómix lancer Fiesta 01", categoria: "Arte y manualidades", costo: 0.60, precio: 1.25, stock: 2, min: 2 },
  { sku: "STK008", nombre: "Sticker fómix lancer Fiesta 02", categoria: "Arte y manualidades", costo: 0.60, precio: 1.25, stock: 2, min: 2 },
  { sku: "STK009", nombre: "Sticker fómix lancer flores surtidas", categoria: "Arte y manualidades", costo: 0.64, precio: 1.50, stock: 2, min: 2 },
  { sku: "STK010", nombre: "Sticker fómix lancer princesas", categoria: "Arte y manualidades", costo: 0.60, precio: 1.25, stock: 2, min: 2 },
  { sku: "STK011", nombre: "Sticker perlas en botellas", categoria: "Arte y manualidades", costo: 0.35, precio: 1.00, stock: 2, min: 2 },
  { sku: "TLA001", nombre: "Tela fieltro lancer A4 surtido", categoria: "Arte y manualidades", costo: 0.13, precio: 0.50, stock: 10, min: 2 },
  { sku: "TMP001", nombre: "Témperas estilo kids", categoria: "Arte y manualidades", costo: 0.82, precio: 2.50, stock: 3, min: 2 },
  { sku: "TIJ001", nombre: "Tijeras lancer escolares", categoria: "Útiles escolares", costo: 0.25, precio: 0.75, stock: 12, min: 2 }
];

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
    // vendedor
    d.permisos.filter(p =>
      (p.modulo === "dashboard" && p.accion === "ver") ||
      (p.modulo === "ventas" && ["ver","crear","anular"].includes(p.accion)) ||
      (p.modulo === "caja" && p.accion === "ver") ||
      (p.modulo === "productos" && p.accion === "ver") ||
      (p.modulo === "clientes" && ["ver","crear","editar"].includes(p.accion)) ||
      (p.modulo === "reportes" && p.accion === "ver")
    ).forEach(p => d.roles_permisos.push({ rol_id: 2, permiso_id: p.id }));
    // bodega
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
      email: "admin@kampapeleria.local", rol_id: 1, telegram_id: "", activo: true,
      created_at: U.nowISO()
    });

    // métodos de pago
    d.metodos_pago.push({ id: 1, nombre: "Efectivo", tipo: "efectivo", activo: true });
    d.metodos_pago.push({ id: 2, nombre: "Transferencia", tipo: "transferencia", activo: true });
    d.metodos_pago.push({ id: 3, nombre: "Tarjeta débito", tipo: "tarjeta", activo: true });
    d.metodos_pago.push({ id: 4, nombre: "Tarjeta crédito", tipo: "tarjeta", activo: true });

    // caja principal
    d.cajas.push({ id: 1, nombre: "Caja Principal", activo: true });

    // categorías + productos KAM
    seedCatalog(d);

    // config — Ecuador / USD
    [
      { clave: "empresa_nombre", valor: "KAM Papelería", descripcion: "Nombre del negocio" },
      { clave: "empresa_ruc", valor: "", descripcion: "RUC / Cédula" },
      { clave: "empresa_direccion", valor: "", descripcion: "Dirección" },
      { clave: "empresa_telefono", valor: "", descripcion: "Teléfono" },
      { clave: "empresa_ciudad", valor: "", descripcion: "Ciudad" },
      { clave: "iva_default", valor: "0.15", descripcion: "IVA Ecuador (15%)" },
      { clave: "moneda", valor: "$", descripcion: "Símbolo moneda (USD)" },
      { clave: "moneda_codigo", valor: "USD", descripcion: "Código moneda" },
      { clave: "pais", valor: "Ecuador", descripcion: "País" }
    ].forEach((c, i) => d.config.push({ id: i + 1, ...c }));

    // secuencias
    d._seq = {
      usuarios: 1, roles: 3, permisos: pid - 1, clientes: 0, proveedores: 0,
      categorias: KAM_CATEGORIAS.length, productos: KAM_PRODUCTOS.length,
      metodos_pago: 4, cajas: 1,
      compras: 0, compras_detalle: 0, historial_costos: 0,
      ventas: 0, ventas_detalle: 0,
      caja_movimientos: 0, caja_sesiones: 0, comprobantes_egreso: 0,
      inventario_movimientos: KAM_PRODUCTOS.length, ajustes_inventario: 0,
      facturas_telegram: 0, telegram_logs: 0, config: 9, auditoria: 0
    };

    save(d);
    return d;
  }

  // Carga categorías + productos KAM + entradas iniciales. Reutilizable desde Configuración.
  function seedCatalog(d) {
    KAM_CATEGORIAS.forEach((n, i) => {
      d.categorias.push({ id: i + 1, nombre: n, descripcion: "", activo: true });
    });
    const catId = (nombre) => KAM_CATEGORIAS.indexOf(nombre) + 1;

    KAM_PRODUCTOS.forEach((p, i) => {
      const id = i + 1;
      d.productos.push({
        id,
        sku: p.sku,
        nombre: p.nombre,
        categoria_id: catId(p.categoria),
        unidad: "und",
        precio_venta: p.precio,
        costo_promedio: p.costo,
        stock_minimo: p.min,
        activo: true,
        created_at: U.nowISO(),
        created_by: 1
      });
      if (p.stock > 0) {
        d.inventario_movimientos.push({
          id: d.inventario_movimientos.length + 1,
          fecha: U.nowISO(),
          producto_id: id,
          tipo: "entrada",
          cantidad: p.stock,
          costo_unitario: p.costo,
          valor: p.stock * p.costo,
          saldo_cantidad: p.stock,
          saldo_valor: p.stock * p.costo,
          costo_promedio: p.costo,
          referencia_tipo: "apertura",
          referencia_id: 0,
          motivo: "Carga inicial de inventario",
          usuario_id: 1
        });
      }
    });
  }

  // Carga sólo el catálogo (sin tocar usuarios/ventas/compras/caja).
  function loadKamCatalog() {
    const d = getDB();
    d.productos = [];
    d.categorias = [];
    d.inventario_movimientos = [];
    d.ajustes_inventario = [];
    seedCatalog(d);
    d._seq = d._seq || {};
    d._seq.categorias = KAM_CATEGORIAS.length;
    d._seq.productos = KAM_PRODUCTOS.length;
    d._seq.inventario_movimientos = KAM_PRODUCTOS.length;
    d._seq.ajustes_inventario = 0;
    setDB(d);
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
    pushAsync("create", { table, row });
    return row;
  }

  function update(table, id, patch) {
    const d = getDB();
    const i = (d[table] || []).findIndex(r => String(r.id) === String(id));
    if (i < 0) throw new Error("Registro no encontrado: " + table + "#" + id);
    d[table][i] = { ...d[table][i], ...patch, updated_at: U.nowISO() };
    setDB(d);
    audit(table, "editar", id, patch);
    pushAsync("update", { table, id, patch });
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
    pushAsync("void", { table, id, motivo, userId });
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
      saldoQty = qty;
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
    const pi = d.productos.findIndex(p => p.id === producto_id);
    if (pi >= 0) d.productos[pi].costo_promedio = costoPromedio;
    setDB(d);
    pushAsync("create", { table: "inventario_movimientos", row: mov });
    if (pi >= 0) pushAsync("update", { table: "productos", id: producto_id, patch: { costo_promedio: costoPromedio } });
    return mov;
  }

  // Caja
  function activeCajaSession(cajaId) {
    return list("caja_sesiones", { caja_id: cajaId, estado: "abierta" }).slice(-1)[0] || null;
  }

  function pushCajaMov({ caja_id, fecha, tipo, concepto, referencia_tipo, referencia_id, metodo_pago_id, monto, usuario_id }) {
    return insert("caja_movimientos", {
      caja_id, fecha: fecha || U.nowISO(), tipo, concepto,
      referencia_tipo: referencia_tipo || "", referencia_id: referencia_id || 0,
      metodo_pago_id: metodo_pago_id || 0, monto: U.num(monto),
      usuario_id: usuario_id || Auth.currentUser()?.id || 0
    });
  }

  function cajaBalance(cajaId, untilISO) {
    let rows = list("caja_movimientos", { caja_id: cajaId });
    if (untilISO) rows = rows.filter(r => new Date(r.fecha) <= new Date(untilISO));
    let saldo = 0;
    rows.forEach(r => {
      if (["apertura","ingreso","ajuste"].includes(r.tipo) && U.num(r.monto) > 0) saldo += U.num(r.monto);
      else if (r.tipo === "egreso") saldo -= U.num(r.monto);
      else if (r.tipo === "ajuste") saldo += U.num(r.monto);
    });
    return saldo;
  }

  // ============= API remota (Apps Script / Google Sheets) =============
  const QUEUE_KEY = "kam_sync_queue_v1";
  const STATUS = { online: null, lastSync: null, pending: 0 };

  async function remote(action, payload, timeoutMs = 15000) {
    if (!APP_CONFIG.apiUrl) throw new Error("API no configurada (modo demo).");
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(APP_CONFIG.apiUrl + "?action=" + encodeURIComponent(action), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...payload, token: Auth.token?.() }),
        signal: ctrl.signal
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch (e) { throw new Error("Respuesta no JSON: " + text.slice(0, 100)); }
      if (!data.ok) throw new Error(data.error || "Error remoto");
      return data.data;
    } finally {
      clearTimeout(tid);
    }
  }

  const _sleep = ms => new Promise(r => setTimeout(r, ms));

  function isOnline() { return APP_CONFIG.mode === "production" && !!APP_CONFIG.apiUrl; }

  function loadQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch (e) { return []; } }
  function saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); STATUS.pending = q.length; broadcastStatus(); }

  function broadcastStatus() {
    window.dispatchEvent(new CustomEvent("kam:sync-status", { detail: { ...STATUS } }));
  }

  // Push fire-and-forget. Si falla, se guarda en cola para reintento.
  function pushAsync(action, payload) {
    if (!isOnline()) return;
    const q = loadQueue();
    q.push({ action, payload, ts: Date.now() });
    saveQueue(q);
    drainQueue();
  }

  let _draining = false;
  async function drainQueue() {
    if (_draining || !isOnline()) return;
    _draining = true;
    try {
      let q = loadQueue();
      while (q.length) {
        const job = q[0];
        try {
          await remote(job.action, job.payload);
          q.shift();
          saveQueue(q);
        } catch (e) {
          console.warn("Sync push error:", e.message);
          // Reintentar más tarde
          if (Date.now() - job.ts > 60000 && q.length > 1) {
            // job antiguo bloqueando: lo mandamos al final
            q.push(q.shift());
            saveQueue(q);
          } else {
            break;
          }
        }
      }
      STATUS.lastSync = Date.now();
      broadcastStatus();
    } finally {
      _draining = false;
    }
  }

  // Reintenta periódicamente
  if (typeof window !== "undefined") {
    setInterval(() => { if (loadQueue().length) drainQueue(); }, 15000);
    window.addEventListener("online", drainQueue);
  }

  // === Sync masivo (botones manuales) ===
  // Tablas que se sincronizan. Excluye 'auditoria' (log) y 'sesiones' (volátil).
  const SYNC_TABLES = TABLES.filter(t => !["auditoria","sesiones","telegram_logs"].includes(t));

  async function syncUpAll(onProgress) {
    if (!isOnline()) throw new Error("Modo demo, configura la URL primero");
    const db = getDB();
    let total = 0, done = 0, errors = 0;
    SYNC_TABLES.forEach(t => total += (db[t] || []).length);

    for (const table of SYNC_TABLES) {
      const rows = db[table] || [];
      if (!rows.length) continue;

      let serverIds = new Set();
      try {
        const serverRows = await remote("list", { table });
        serverIds = new Set((serverRows || []).map(r => String(r.id)));
      } catch (e) {
        console.warn("syncUp list " + table + ":", e.message);
        await _sleep(2000); // retroceso ante error
      }

      for (const row of rows) {
        let attempt = 0;
        const maxAttempts = 3;
        while (attempt < maxAttempts) {
          try {
            if (row.id != null && serverIds.has(String(row.id))) {
              await remote("update", { table, id: row.id, patch: row });
            } else {
              await remote("create", { table, row });
            }
            break; // éxito
          } catch (e) {
            attempt++;
            console.warn(`syncUp ${table}#${row.id} intento ${attempt}:`, e.message);
            if (attempt >= maxAttempts) {
              errors++;
              break;
            }
            await _sleep(1500 * attempt); // backoff exponencial
          }
        }
        done++;
        onProgress?.(done, total, table, errors);
        await _sleep(120); // delay entre requests para evitar rate limit
      }
    }
    STATUS.lastSync = Date.now();
    STATUS.online = true;
    broadcastStatus();
    return { total, done, errors };
  }

  // GET list — más confiable que POST (sin problemas de redirect/CORS)
  async function listRemote(table) {
    const url = APP_CONFIG.apiUrl + "?action=list&table=" + encodeURIComponent(table);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(url, { method: "GET", signal: ctrl.signal });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch (e) { throw new Error("Respuesta no JSON: " + text.slice(0, 100)); }
      if (!data.ok) throw new Error(data.error || "Error remoto");
      return data.data || [];
    } finally { clearTimeout(tid); }
  }

  async function syncDownAll(onProgress) {
    if (!isOnline()) throw new Error("Modo demo, configura la URL primero");
    const db = getDB();
    let done = 0, errors = 0;
    for (const table of TABLES) {
      try {
        const rows = await listRemote(table);
        db[table] = Array.isArray(rows) ? rows : [];
      } catch (e) {
        console.warn("syncDown " + table + ":", e.message);
        errors++;
      }
      done++;
      onProgress?.(done, TABLES.length, table, errors);
      await _sleep(50);
    }
    db._seq = db._seq || {};
    TABLES.forEach(t => {
      const ids = (db[t] || []).map(r => Number(r.id) || 0);
      if (ids.length) db._seq[t] = Math.max(...ids);
    });
    setDB(db);
    STATUS.lastSync = Date.now();
    STATUS.online = errors === 0;
    broadcastStatus();
    if (errors > TABLES.length / 2) {
      throw new Error(`Sync con muchos errores (${errors} tablas fallaron)`);
    }
  }

  async function pingServer() {
    if (!isOnline()) { STATUS.online = false; broadcastStatus(); return false; }
    try {
      const res = await fetch(APP_CONFIG.apiUrl + "?action=ping", { method: "GET" });
      const data = await res.json();
      const ok = !!data && data.ok !== false;
      STATUS.online = ok;
      broadcastStatus();
      return ok;
    } catch (e) {
      console.warn("Ping fallido:", e.message);
      STATUS.online = false;
      broadcastStatus();
      return false;
    }
  }

  // Verifica salud completa: ping + acceso al spreadsheet
  async function healthCheck() {
    if (!isOnline()) return { ok: false, code: "demo_mode", message: "Modo demo (sin servidor)" };
    try {
      // 1. Ping
      const pingRes = await fetch(APP_CONFIG.apiUrl + "?action=ping", { method: "GET" });
      if (!pingRes.ok) return { ok: false, code: "ping_fail", message: "El servidor no responde" };
      try { await pingRes.json(); }
      catch (e) { return { ok: false, code: "bad_url", message: "URL de Apps Script inválida o no implementada" }; }

      // 2. Acceso a hoja (requiere SPREADSHEET_ID)
      const listRes = await fetch(APP_CONFIG.apiUrl + "?action=list&table=usuarios", { method: "GET" });
      const text = await listRes.text();
      if (text.includes("SPREADSHEET_ID no configurado")) {
        return { ok: false, code: "no_spreadsheet_id", message: "Falta configurar SPREADSHEET_ID en Apps Script" };
      }
      let data;
      try { data = JSON.parse(text); }
      catch (e) { return { ok: false, code: "bad_response", message: "Respuesta inesperada del servidor" }; }
      if (!data.ok) return { ok: false, code: "server_error", message: data.error || "Error del servidor" };
      if (!Array.isArray(data.data) || data.data.length === 0) {
        return { ok: false, code: "no_init", message: "La base de datos está vacía. Ejecuta initDatabase en Apps Script." };
      }
      return { ok: true, code: "ok", message: "Conexión OK", users: data.data.length };
    } catch (e) {
      return { ok: false, code: "network", message: "Error de red: " + e.message };
    }
  }

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
    remote, resetDemo, loadKamCatalog, seedCatalog,
    syncUpAll, syncDownAll, pingServer, healthCheck, isOnline,
    getStatus: () => ({ ...STATUS, queueSize: loadQueue().length }),
    drainQueue,
    KAM_PRODUCTOS, KAM_CATEGORIAS, TABLES
  };
})();

window.DB = DB;
