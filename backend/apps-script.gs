/**
 * Isaac Papelería — Backend (Google Apps Script)
 * ----------------------------------------------
 * • API REST sobre Google Sheets (doGet/doPost).
 * • Webhook del bot de Telegram (OCR de facturas + consultas).
 * • Pegar en Apps Script vinculado a un Spreadsheet.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   - SPREADSHEET_ID   : ID del Google Sheet
 *   - TELEGRAM_TOKEN   : 8980738836:AAGQfL9n7jzPDWJtALIpD4XCq0vrpzbxcp4
 *   - DRIVE_FOLDER_ID  : (opcional) id carpeta para guardar imágenes de facturas
 *   - OCR_PROVIDER     : "vision" | "drive" | "none"
 *   - VISION_API_KEY   : (si OCR_PROVIDER=vision) clave de Google Cloud Vision
 */

// ============= Tablas =============
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

const HEADERS = {
  usuarios: ["id","username","password_hash","salt","nombre","email","rol_id","telegram_id","activo","created_at"],
  roles: ["id","nombre","descripcion","activo"],
  permisos: ["id","modulo","accion"],
  roles_permisos: ["id","rol_id","permiso_id"],
  sesiones: ["token","usuario_id","created_at","expires_at","ip"],
  clientes: ["id","tipo_doc","num_doc","nombre","telefono","email","direccion","activo","created_at","created_by"],
  proveedores: ["id","tipo_doc","num_doc","nombre","telefono","email","direccion","activo","created_at","created_by"],
  categorias: ["id","nombre","descripcion","activo"],
  productos: ["id","sku","nombre","categoria_id","unidad","precio_venta","costo_promedio","stock_minimo","activo","created_at","created_by"],
  metodos_pago: ["id","nombre","tipo","activo"],
  cajas: ["id","nombre","activo"],
  compras: ["id","numero","proveedor_id","fecha","metodo_pago_id","caja_id","subtotal","iva","total","estado","observaciones","origen_telegram","factura_telegram_id","created_at","created_by","anulada_motivo","anulada_by","anulada_at"],
  compras_detalle: ["id","compra_id","producto_id","cantidad","costo_unitario","subtotal"],
  historial_costos: ["id","producto_id","fecha","costo_unitario","proveedor_id","compra_id"],
  ventas: ["id","numero","cliente_id","vendedor_id","fecha","metodo_pago_id","caja_id","subtotal","descuento","total","costo_total","utilidad","estado","observaciones","created_at","created_by","anulada_motivo","anulada_by","anulada_at"],
  ventas_detalle: ["id","venta_id","producto_id","cantidad","precio_unitario","descuento","subtotal","costo_unitario","utilidad"],
  caja_movimientos: ["id","caja_id","fecha","tipo","concepto","referencia_tipo","referencia_id","metodo_pago_id","monto","usuario_id"],
  caja_sesiones: ["id","caja_id","usuario_id","fecha_apertura","saldo_inicial","fecha_cierre","saldo_esperado","saldo_real","diferencia","estado","observaciones"],
  comprobantes_egreso: ["id","numero","fecha","beneficiario","concepto","metodo_pago_id","caja_id","valor","soporte_url","estado","created_at","created_by","anulada_motivo","anulada_by","anulada_at"],
  inventario_movimientos: ["id","fecha","producto_id","tipo","cantidad","costo_unitario","valor","saldo_cantidad","saldo_valor","costo_promedio","referencia_tipo","referencia_id","motivo","usuario_id"],
  ajustes_inventario: ["id","fecha","producto_id","cantidad_anterior","cantidad_nueva","motivo","usuario_id"],
  facturas_telegram: ["id","telegram_user_id","telegram_username","fecha","imagen_drive_id","imagen_url","ocr_texto","datos_extraidos_json","estado","compra_id","confirmada_at","confirmada_by"],
  telegram_logs: ["id","fecha","telegram_user_id","tipo","comando","payload","respuesta"],
  telegram_usuarios_autorizados: ["telegram_id","usuario_id","autorizado_at","autorizado_by","activo"],
  config: ["id","clave","valor","descripcion"],
  auditoria: ["id","fecha","usuario_id","modulo","accion","entidad","entidad_id","detalle_json"]
};

// ============= Helpers =============
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("SPREADSHEET_ID no configurado");
  return SpreadsheetApp.openById(id);
}
function sheet_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error("Hoja no encontrada: " + name);
  return s;
}
function ok_(data) { return ContentService.createTextOutput(JSON.stringify({ ok: true, data })).setMimeType(ContentService.MimeType.JSON); }
function err_(msg) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(msg) })).setMimeType(ContentService.MimeType.JSON); }

function readAll_(name) {
  const sh = sheet_(name);
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const head = v[0];
  return v.slice(1).filter(r => r.some(c => c !== "")).map(r => {
    const o = {}; head.forEach((h, i) => o[h] = r[i]); return o;
  });
}
function appendRow_(name, row) {
  const sh = sheet_(name);
  const head = HEADERS[name] || sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  if (!row.id && head.includes("id")) row.id = nextId_(name);
  sh.appendRow(head.map(h => row[h] === undefined ? "" : row[h]));
  return row;
}
function updateRow_(name, id, patch) {
  const sh = sheet_(name);
  const v = sh.getDataRange().getValues();
  const head = v[0];
  const idIdx = head.indexOf("id");
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][idIdx]) === String(id)) {
      head.forEach((h, j) => { if (patch[h] !== undefined) v[i][j] = patch[h]; });
      sh.getRange(i + 1, 1, 1, v[i].length).setValues([v[i]]);
      const o = {}; head.forEach((h, j) => o[h] = v[i][j]); return o;
    }
  }
  throw new Error("No encontrado " + name + "#" + id);
}
function nextId_(name) {
  const key = "SEQ_" + name;
  const lock = LockService.getScriptLock(); lock.waitLock(8000);
  try {
    const props = PropertiesService.getScriptProperties();
    let n = Number(props.getProperty(key) || 0);
    if (!n) {
      // calcular desde la hoja
      const sh = sheet_(name);
      const head = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
      const idIdx = head.indexOf("id");
      const last = sh.getLastRow();
      if (last > 1 && idIdx >= 0) {
        const ids = sh.getRange(2,idIdx+1,last-1,1).getValues().flat().filter(Boolean).map(Number);
        n = ids.length ? Math.max.apply(null, ids) : 0;
      }
    }
    n++;
    props.setProperty(key, String(n));
    return n;
  } finally { lock.releaseLock(); }
}

// ============= Init =============
function initDatabase() {
  const ss = ss_();
  TABLES.forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS[name]);
      sh.getRange(1,1,1,HEADERS[name].length).setFontWeight("bold").setBackground("#e0e7ff");
      sh.setFrozenRows(1);
    }
  });
  // semilla admin si no existe
  if (!readAll_("usuarios").length) {
    const salt = Utilities.getUuid();
    const hash = sha256_("admin123" + salt);
    appendRow_("usuarios", { id: 1, username: "admin", password_hash: hash, salt, nombre: "Administrador", email: "admin@papeleria.local", rol_id: 1, telegram_id: "", activo: true, created_at: new Date().toISOString() });
    appendRow_("roles", { id: 1, nombre: "Administrador", descripcion: "Acceso total", activo: true });
    appendRow_("metodos_pago", { id: 1, nombre: "Efectivo", tipo: "efectivo", activo: true });
    appendRow_("metodos_pago", { id: 2, nombre: "Transferencia", tipo: "transferencia", activo: true });
    appendRow_("cajas", { id: 1, nombre: "Caja Principal", activo: true });
    appendRow_("config", { id: 1, clave: "empresa_nombre", valor: "Isaac Papelería", descripcion: "" });
    appendRow_("config", { id: 2, clave: "iva_default", valor: "0.19", descripcion: "" });
  }
  return "Base de datos inicializada";
}

function sha256_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytes.map(b => ("0" + ((b < 0 ? b + 256 : b)).toString(16)).slice(-2)).join("");
}

// ============= Web endpoints =============
function doGet(e) {
  // Permitir también GET con action para tests rápidos sin CORS
  const action = (e && e.parameter && e.parameter.action) || "";
  if (action === "ping") return ok_({ pong: true, time: new Date().toISOString() });
  if (action === "list" && e.parameter.table) return ok_(readAll_(e.parameter.table));
  return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "KAM Papelería API", time: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    e = e || {};
    const action = (e.parameter && e.parameter.action) || "";
    let body = {};
    try {
      const raw = (e.postData && e.postData.contents) || "{}";
      body = JSON.parse(raw);
    } catch (er) { body = {}; }

    // Webhook Telegram (Telegram envía como POST sin action)
    if (!action && body.update_id) return handleTelegram_(body);

    switch (action) {
      case "ping": return ok_({ pong: true, time: new Date().toISOString() });
      case "login": return ok_(login_(body));
      case "list": return ok_(readAll_(body.table));
      case "get": return ok_((readAll_(body.table) || []).find(function(r) { return String(r.id) === String(body.id); }));
      case "create": return ok_(appendRow_(body.table, body.row));
      case "update": return ok_(updateRow_(body.table, body.id, body.patch));
      case "void": return ok_(voidRow_(body.table, body.id, body.motivo, body.userId));
      case "createSale": return ok_(createSale_(body));
      case "createPurchase": return ok_(createPurchase_(body));
      case "createEgreso": return ok_(createEgreso_(body));
      case "openCashbox": return ok_(openCashbox_(body));
      case "closeCashbox": return ok_(closeCashbox_(body));
      case "kardex": return ok_(readAll_("inventario_movimientos").filter(function(m) { return String(m.producto_id) === String(body.producto_id); }));
      case "report": return ok_(report_(body));
      case "telegramWebhook": return handleTelegram_(body);
      default: return err_("Acción no válida: " + action);
    }
  } catch (ex) {
    return err_((ex && ex.message) || ex || "Error desconocido");
  }
}

// ============= Auth =============
function login_(body) {
  const u = readAll_("usuarios").find(x => x.username === body.username && x.activo);
  if (!u) throw new Error("Usuario no encontrado");
  if (sha256_(body.password + u.salt) !== u.password_hash) throw new Error("Contraseña incorrecta");
  const token = Utilities.getUuid();
  appendRow_("sesiones", { token, usuario_id: u.id, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 8 * 3600000).toISOString(), ip: "" });
  delete u.password_hash; delete u.salt;
  return { token, user: u };
}

// ============= Lógica negocio =============
function voidRow_(table, id, motivo, userId) {
  const patch = { estado: "anulada", anulada_motivo: motivo, anulada_by: userId, anulada_at: new Date().toISOString() };
  return updateRow_(table, id, patch);
}

function lastInvMovement_(productoId) {
  const movs = readAll_("inventario_movimientos").filter(m => String(m.producto_id) === String(productoId));
  return movs.length ? movs[movs.length - 1] : null;
}
function stockOf_(productoId) { const m = lastInvMovement_(productoId); return m ? Number(m.saldo_cantidad) || 0 : 0; }
function avgCostOf_(productoId) {
  const m = lastInvMovement_(productoId);
  if (m) return Number(m.costo_promedio) || 0;
  const p = readAll_("productos").find(x => String(x.id) === String(productoId));
  return p ? Number(p.costo_promedio) || 0 : 0;
}
function pushInvMovement_(d) {
  const prev = lastInvMovement_(d.producto_id);
  const prevQty = prev ? Number(prev.saldo_cantidad) : 0;
  const prevValor = prev ? Number(prev.saldo_valor) : 0;
  const qty = Number(d.cantidad), cu = Number(d.costo_unitario);
  let saldoQty, saldoValor, cp;
  if (d.tipo === "entrada") {
    saldoQty = prevQty + qty;
    saldoValor = prevValor + qty * cu;
    cp = saldoQty > 0 ? saldoValor / saldoQty : cu;
  } else if (d.tipo === "salida") {
    saldoQty = prevQty - qty;
    cp = prev ? Number(prev.costo_promedio) : cu;
    saldoValor = saldoQty * cp;
  } else {
    saldoQty = qty;
    cp = prev ? Number(prev.costo_promedio) : (cu || avgCostOf_(d.producto_id));
    saldoValor = saldoQty * cp;
  }
  const mov = appendRow_("inventario_movimientos", {
    fecha: d.fecha || new Date().toISOString(),
    producto_id: d.producto_id, tipo: d.tipo,
    cantidad: qty, costo_unitario: cu, valor: qty * cu,
    saldo_cantidad: saldoQty, saldo_valor: saldoValor, costo_promedio: cp,
    referencia_tipo: d.referencia_tipo || "", referencia_id: d.referencia_id || 0,
    motivo: d.motivo || "", usuario_id: d.usuario_id || 0
  });
  // refrescar costo_promedio en producto
  updateRow_("productos", d.producto_id, { costo_promedio: cp });
  return mov;
}
function pushCajaMov_(d) {
  return appendRow_("caja_movimientos", {
    caja_id: d.caja_id, fecha: d.fecha || new Date().toISOString(),
    tipo: d.tipo, concepto: d.concepto || "",
    referencia_tipo: d.referencia_tipo || "", referencia_id: d.referencia_id || 0,
    metodo_pago_id: d.metodo_pago_id || 0, monto: Number(d.monto) || 0,
    usuario_id: d.usuario_id || 0
  });
}

function createSale_(body) {
  // body: { cliente_id, vendedor_id, metodo_pago_id, caja_id, descuento, observaciones, pagada, lineas: [{ producto_id, cantidad, precio_unitario }] }
  const lineas = body.lineas || [];
  if (!lineas.length) throw new Error("Sin productos");
  // validar stock
  lineas.forEach(l => {
    if (Number(l.cantidad) > stockOf_(l.producto_id)) throw new Error("Sin stock suficiente: producto #" + l.producto_id);
  });
  let sub = 0, cost = 0;
  const enriched = lineas.map(l => {
    const cu = avgCostOf_(l.producto_id);
    sub += l.cantidad * l.precio_unitario;
    cost += l.cantidad * cu;
    return { ...l, costo_unitario: cu };
  });
  const desc = Number(body.descuento) || 0;
  const total = Math.max(0, sub - desc);
  const util = total - cost;
  const venta = appendRow_("ventas", {
    numero: "V-" + Date.now().toString(36).toUpperCase(),
    cliente_id: body.cliente_id || 0, vendedor_id: body.vendedor_id || 0,
    fecha: new Date().toISOString(), metodo_pago_id: body.metodo_pago_id, caja_id: body.caja_id,
    subtotal: sub, descuento: desc, total, costo_total: cost, utilidad: util,
    estado: body.pagada ? "pagada" : "pendiente",
    observaciones: body.observaciones || "",
    created_at: new Date().toISOString(), created_by: body.vendedor_id || 0
  });
  enriched.forEach(l => {
    appendRow_("ventas_detalle", {
      venta_id: venta.id, producto_id: l.producto_id,
      cantidad: l.cantidad, precio_unitario: l.precio_unitario, descuento: 0,
      subtotal: l.cantidad * l.precio_unitario,
      costo_unitario: l.costo_unitario, utilidad: l.cantidad * (l.precio_unitario - l.costo_unitario)
    });
    pushInvMovement_({
      producto_id: l.producto_id, tipo: "salida",
      cantidad: l.cantidad, costo_unitario: l.costo_unitario,
      referencia_tipo: "venta", referencia_id: venta.id, motivo: "Venta " + venta.numero,
      usuario_id: body.vendedor_id
    });
  });
  if (body.pagada) {
    pushCajaMov_({ caja_id: body.caja_id, tipo: "ingreso", concepto: "Venta " + venta.numero, referencia_tipo: "venta", referencia_id: venta.id, metodo_pago_id: body.metodo_pago_id, monto: total, usuario_id: body.vendedor_id });
  }
  return venta;
}

function createPurchase_(body) {
  const lineas = body.lineas || [];
  if (!lineas.length) throw new Error("Sin productos");
  let sub = 0;
  lineas.forEach(l => sub += Number(l.cantidad) * Number(l.costo_unitario));
  const iva = Number(body.iva) || 0;
  const total = sub + iva;
  const compra = appendRow_("compras", {
    numero: body.numero, proveedor_id: body.proveedor_id,
    fecha: body.fecha || new Date().toISOString(),
    metodo_pago_id: body.metodo_pago_id, caja_id: body.caja_id || 0,
    subtotal: sub, iva, total, estado: body.estado || "pendiente",
    observaciones: body.observaciones || "",
    origen_telegram: !!body.origen_telegram, factura_telegram_id: body.factura_telegram_id || 0,
    created_at: new Date().toISOString(), created_by: body.user_id || 0
  });
  lineas.forEach(l => {
    appendRow_("compras_detalle", {
      compra_id: compra.id, producto_id: l.producto_id,
      cantidad: l.cantidad, costo_unitario: l.costo_unitario,
      subtotal: l.cantidad * l.costo_unitario
    });
    appendRow_("historial_costos", {
      producto_id: l.producto_id, fecha: compra.fecha,
      costo_unitario: l.costo_unitario, proveedor_id: compra.proveedor_id, compra_id: compra.id
    });
    pushInvMovement_({
      producto_id: l.producto_id, tipo: "entrada",
      cantidad: l.cantidad, costo_unitario: l.costo_unitario,
      referencia_tipo: "compra", referencia_id: compra.id, motivo: "Compra " + compra.numero,
      usuario_id: body.user_id
    });
  });
  if (body.estado === "pagada" && body.caja_id) {
    pushCajaMov_({ caja_id: body.caja_id, tipo: "egreso", concepto: "Compra " + compra.numero, referencia_tipo: "compra", referencia_id: compra.id, metodo_pago_id: body.metodo_pago_id, monto: total, usuario_id: body.user_id });
  }
  return compra;
}

function createEgreso_(body) {
  const eg = appendRow_("comprobantes_egreso", {
    numero: body.numero, fecha: body.fecha, beneficiario: body.beneficiario,
    concepto: body.concepto, metodo_pago_id: body.metodo_pago_id, caja_id: body.caja_id,
    valor: body.valor, soporte_url: body.soporte_url || "",
    estado: "emitido", created_at: new Date().toISOString(), created_by: body.user_id || 0
  });
  pushCajaMov_({
    caja_id: body.caja_id, fecha: body.fecha, tipo: "egreso",
    concepto: body.concepto + " (" + eg.numero + ")",
    referencia_tipo: "egreso", referencia_id: eg.id,
    metodo_pago_id: body.metodo_pago_id, monto: body.valor, usuario_id: body.user_id
  });
  return eg;
}

function openCashbox_(body) {
  const ses = appendRow_("caja_sesiones", {
    caja_id: body.caja_id, usuario_id: body.user_id, fecha_apertura: new Date().toISOString(),
    saldo_inicial: body.saldo_inicial, estado: "abierta"
  });
  pushCajaMov_({ caja_id: body.caja_id, tipo: "apertura", concepto: "Apertura sesión #" + ses.id, monto: body.saldo_inicial, referencia_tipo: "sesion", referencia_id: ses.id, usuario_id: body.user_id });
  return ses;
}
function closeCashbox_(body) {
  const movs = readAll_("caja_movimientos").filter(m => String(m.caja_id) === String(body.caja_id));
  let saldo = 0;
  movs.forEach(m => {
    if (["apertura","ingreso","ajuste"].indexOf(m.tipo) >= 0) saldo += Number(m.monto) || 0;
    else if (m.tipo === "egreso") saldo -= Number(m.monto) || 0;
  });
  const diff = Number(body.saldo_real) - saldo;
  const ses = updateRow_("caja_sesiones", body.sesion_id, {
    fecha_cierre: new Date().toISOString(),
    saldo_esperado: saldo, saldo_real: body.saldo_real,
    diferencia: diff, estado: "cerrada"
  });
  return ses;
}

function report_(body) {
  const from = body.from || "1970-01-01";
  const to = body.to || "2999-12-31";
  const type = body.type;
  if (type === "ventas" || type === "utilidad") {
    return readAll_("ventas").filter(v => v.estado !== "anulada" && String(v.fecha).slice(0,10) >= from && String(v.fecha).slice(0,10) <= to);
  }
  if (type === "compras") {
    return readAll_("compras").filter(c => c.estado !== "anulada" && String(c.fecha).slice(0,10) >= from && String(c.fecha).slice(0,10) <= to);
  }
  if (type === "inventario") {
    return readAll_("productos").filter(p => p.activo).map(p => ({ ...p, stock: stockOf_(p.id), costo_promedio: avgCostOf_(p.id) }));
  }
  return [];
}

// ============= Telegram Bot =============
function tg_(method, payload) {
  const token = PropertiesService.getScriptProperties().getProperty("TELEGRAM_TOKEN");
  if (!token) throw new Error("TELEGRAM_TOKEN no configurado");
  const url = "https://api.telegram.org/bot" + token + "/" + method;
  const res = UrlFetchApp.fetch(url, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  return JSON.parse(res.getContentText());
}

function tgGetFileUrl_(file_id) {
  const token = PropertiesService.getScriptProperties().getProperty("TELEGRAM_TOKEN");
  const res = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getFile?file_id=" + encodeURIComponent(file_id));
  const data = JSON.parse(res.getContentText());
  if (!data.ok) throw new Error("getFile fail");
  return "https://api.telegram.org/file/bot" + token + "/" + data.result.file_path;
}

function handleTelegram_(update) {
  try {
    const msg = update.message || update.callback_query?.message;
    if (!msg) return ok_("no message");
    const chat_id = msg.chat?.id || update.callback_query?.from?.id;
    const from = msg.from || update.callback_query?.from;
    const tg_id = String(from.id);
    const text = (msg.text || msg.caption || "").trim();

    // log
    appendRow_("telegram_logs", { fecha: new Date().toISOString(), telegram_user_id: tg_id, tipo: msg.photo ? "foto" : "mensaje", comando: text.slice(0, 200), payload: "", respuesta: "" });

    // autorización
    const user = findUserByTelegram_(tg_id);
    if (!user && text !== "/start") {
      tg_("sendMessage", { chat_id, text: "🚫 No estás autorizado. Pide a un administrador que vincule tu Telegram ID: *" + tg_id + "*", parse_mode: "Markdown" });
      return ok_("unauth");
    }

    if (text === "/start") return startCmd_(chat_id, from, user);
    if (text.startsWith("/ayuda") || text === "/help") return helpCmd_(chat_id);
    if (text.startsWith("/stock")) return stockCmd_(chat_id, text);
    if (text === "/ventas") return ventasHoyCmd_(chat_id);
    if (text === "/compras") return comprasHoyCmd_(chat_id);
    if (text === "/caja") return cajaCmd_(chat_id);
    if (text === "/bajostock") return bajoStockCmd_(chat_id);
    if (text.startsWith("/utilidad")) return utilidadCmd_(chat_id, text);
    if (text === "/ultimasventas") return ultimasVentasCmd_(chat_id);
    if (text === "/ultimascompras") return ultimasComprasCmd_(chat_id);
    if (text === "/inventario") return inventarioCmd_(chat_id);
    if (text.startsWith("/factura")) return facturaCmd_(chat_id, text);

    // callback de botones
    if (update.callback_query) {
      const cb = update.callback_query;
      if (cb.data.startsWith("conf_")) {
        const id = Number(cb.data.replace("conf_", ""));
        return confirmFactura_(chat_id, id, user);
      }
      if (cb.data.startsWith("desc_")) {
        const id = Number(cb.data.replace("desc_", ""));
        updateRow_("facturas_telegram", id, { estado: "descartada" });
        tg_("sendMessage", { chat_id, text: "❌ Factura descartada." });
        return ok_("descartada");
      }
    }

    if (msg.photo || msg.document) return receiveInvoice_(chat_id, msg, user);

    // frases libres → buscar por palabras clave
    if (/cuanto.*stock|hay.*de|stock.*de/i.test(text)) return stockCmd_(chat_id, text);
    if (/vendimos|venta.*hoy/i.test(text)) return ventasHoyCmd_(chat_id);
    if (/saldo.*caja|cuanto.*caja/i.test(text)) return cajaCmd_(chat_id);
    if (/bajo.*stock|productos.*falt/i.test(text)) return bajoStockCmd_(chat_id);
    if (/utilidad|ganancia/i.test(text)) return utilidadCmd_(chat_id, text);
    if (/subir.*factura|registrar.*factura/i.test(text)) {
      tg_("sendMessage", { chat_id, text: "📸 Envíame la *foto* de la factura y la procesaré con OCR.", parse_mode: "Markdown" });
      return ok_();
    }

    tg_("sendMessage", { chat_id, text: "No entendí. Escribe /ayuda para ver los comandos." });
    return ok_();
  } catch (e) {
    return err_("tg error: " + e.message);
  }
}

function findUserByTelegram_(tg_id) {
  const users = readAll_("usuarios").filter(u => u.activo);
  let u = users.find(x => String(x.telegram_id) === String(tg_id));
  if (u) return u;
  const auth = readAll_("telegram_usuarios_autorizados").find(x => String(x.telegram_id) === String(tg_id) && x.activo);
  if (auth && auth.usuario_id) return users.find(u => String(u.id) === String(auth.usuario_id));
  return null;
}

function startCmd_(chat_id, from, user) {
  if (!user) {
    tg_("sendMessage", { chat_id, text: `👋 Hola ${from.first_name || ""}.\nTu Telegram ID es: *${from.id}*\nDale este ID a un administrador para que lo vincule a tu usuario en Isaac Papelería.`, parse_mode: "Markdown" });
  } else {
    tg_("sendMessage", { chat_id, text: `✅ Bienvenido *${user.nombre || user.username}*.\nEnvíame la foto de una factura para registrarla.\nEscribe /ayuda para ver más comandos.`, parse_mode: "Markdown" });
  }
  return ok_();
}

function helpCmd_(chat_id) {
  tg_("sendMessage", { chat_id, parse_mode: "Markdown", text:
`*Comandos disponibles*

📸 Envía una *foto de factura* para registrarla.

📊 *Consultas*
/stock <producto>  — stock actual
/ventas — ventas del día
/compras — compras del día
/caja — saldo de caja
/bajostock — productos con bajo stock
/utilidad [dia|semana|mes] — utilidad del periodo
/ultimasventas — últimas 10 ventas
/ultimascompras — últimas 10 compras
/inventario — resumen rápido
/factura <id> — estado de una factura`
  });
  return ok_();
}

function fmtMoney_(n) { return "$" + (Number(n) || 0).toLocaleString("es-CO"); }

function stockCmd_(chat_id, text) {
  const q = text.replace(/^\/stock\s*/i, "").toLowerCase();
  if (!q) { tg_("sendMessage", { chat_id, text: "Uso: /stock <nombre o sku>" }); return ok_(); }
  const productos = readAll_("productos").filter(p => p.activo);
  const found = productos.filter(p => (p.nombre || "").toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q));
  if (!found.length) { tg_("sendMessage", { chat_id, text: "No encontré productos con \"" + q + "\"." }); return ok_(); }
  const lines = found.slice(0, 10).map(p => `• ${p.nombre} (${p.sku}) — Stock: *${stockOf_(p.id)}* / Mín: ${p.stock_minimo}`).join("\n");
  tg_("sendMessage", { chat_id, text: lines, parse_mode: "Markdown" });
  return ok_();
}

function ventasHoyCmd_(chat_id) {
  const today = new Date().toISOString().slice(0,10);
  const v = readAll_("ventas").filter(x => x.estado !== "anulada" && String(x.fecha).slice(0,10) === today);
  const total = v.reduce((a,b) => a + (Number(b.total) || 0), 0);
  const util = v.reduce((a,b) => a + (Number(b.utilidad) || 0), 0);
  tg_("sendMessage", { chat_id, parse_mode: "Markdown", text: `📊 *Ventas hoy*\nTransacciones: *${v.length}*\nTotal: *${fmtMoney_(total)}*\nUtilidad: *${fmtMoney_(util)}*` });
  return ok_();
}
function comprasHoyCmd_(chat_id) {
  const today = new Date().toISOString().slice(0,10);
  const c = readAll_("compras").filter(x => x.estado !== "anulada" && String(x.fecha).slice(0,10) === today);
  const total = c.reduce((a,b) => a + (Number(b.total) || 0), 0);
  tg_("sendMessage", { chat_id, parse_mode: "Markdown", text: `📦 *Compras hoy*\nFacturas: *${c.length}*\nTotal: *${fmtMoney_(total)}*` });
  return ok_();
}
function cajaCmd_(chat_id) {
  const cajas = readAll_("cajas").filter(c => c.activo);
  const movs = readAll_("caja_movimientos");
  let out = "💵 *Saldos de caja*\n";
  cajas.forEach(c => {
    const ms = movs.filter(m => String(m.caja_id) === String(c.id));
    let saldo = 0;
    ms.forEach(m => {
      if (["apertura","ingreso","ajuste"].indexOf(m.tipo) >= 0) saldo += Number(m.monto) || 0;
      else if (m.tipo === "egreso") saldo -= Number(m.monto) || 0;
    });
    out += `• ${c.nombre}: *${fmtMoney_(saldo)}*\n`;
  });
  tg_("sendMessage", { chat_id, text: out, parse_mode: "Markdown" });
  return ok_();
}
function bajoStockCmd_(chat_id) {
  const productos = readAll_("productos").filter(p => p.activo);
  const bajos = productos.filter(p => stockOf_(p.id) < (Number(p.stock_minimo) || 0));
  if (!bajos.length) { tg_("sendMessage", { chat_id, text: "✅ Todos los productos tienen stock OK." }); return ok_(); }
  const lines = bajos.slice(0, 20).map(p => `• ${p.nombre} — ${stockOf_(p.id)} / mín ${p.stock_minimo}`).join("\n");
  tg_("sendMessage", { chat_id, text: "⚠️ *Bajo stock*\n" + lines, parse_mode: "Markdown" });
  return ok_();
}
function utilidadCmd_(chat_id, text) {
  const arg = (text.split(/\s+/)[1] || "dia").toLowerCase();
  const now = new Date();
  let from;
  if (arg === "mes") from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  else if (arg === "semana") from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0,10);
  else from = now.toISOString().slice(0,10);
  const today = now.toISOString().slice(0,10);
  const v = readAll_("ventas").filter(x => x.estado !== "anulada" && String(x.fecha).slice(0,10) >= from && String(x.fecha).slice(0,10) <= today);
  const total = v.reduce((a,b) => a + (Number(b.total) || 0), 0);
  const util = v.reduce((a,b) => a + (Number(b.utilidad) || 0), 0);
  tg_("sendMessage", { chat_id, parse_mode: "Markdown", text: `💰 *Utilidad (${arg})*\nDesde: ${from}\nVentas: *${fmtMoney_(total)}*\nUtilidad: *${fmtMoney_(util)}*\nMargen: *${total ? ((util/total)*100).toFixed(1) + "%" : "—"}*` });
  return ok_();
}
function ultimasVentasCmd_(chat_id) {
  const v = readAll_("ventas").slice(-10).reverse();
  const lines = v.map(x => `• ${x.numero} — ${fmtMoney_(x.total)} (${x.estado})`).join("\n") || "Sin ventas";
  tg_("sendMessage", { chat_id, text: "🛒 *Últimas ventas*\n" + lines, parse_mode: "Markdown" });
  return ok_();
}
function ultimasComprasCmd_(chat_id) {
  const c = readAll_("compras").slice(-10).reverse();
  const lines = c.map(x => `• ${x.numero} — ${fmtMoney_(x.total)} (${x.estado})`).join("\n") || "Sin compras";
  tg_("sendMessage", { chat_id, text: "📦 *Últimas compras*\n" + lines, parse_mode: "Markdown" });
  return ok_();
}
function inventarioCmd_(chat_id) {
  const productos = readAll_("productos").filter(p => p.activo);
  let unidades = 0, valor = 0;
  productos.forEach(p => { const s = stockOf_(p.id); unidades += s; valor += s * avgCostOf_(p.id); });
  tg_("sendMessage", { chat_id, parse_mode: "Markdown", text: `📊 *Inventario*\nProductos: ${productos.length}\nUnidades: ${unidades}\nValorizado: *${fmtMoney_(valor)}*` });
  return ok_();
}
function facturaCmd_(chat_id, text) {
  const id = Number(text.replace(/\D/g, ""));
  if (!id) { tg_("sendMessage", { chat_id, text: "Uso: /factura <id>" }); return ok_(); }
  const f = readAll_("facturas_telegram").find(x => Number(x.id) === id);
  if (!f) { tg_("sendMessage", { chat_id, text: "No encontrada." }); return ok_(); }
  tg_("sendMessage", { chat_id, parse_mode: "Markdown", text: `📄 *Factura #${id}*\nEstado: *${f.estado}*\nFecha: ${f.fecha}\nCompra: ${f.compra_id || "—"}` });
  return ok_();
}

// Recepción de factura (foto o documento)
function receiveInvoice_(chat_id, msg, user) {
  tg_("sendMessage", { chat_id, text: "🔍 Procesando factura…" });
  let file_id = "";
  if (msg.photo) file_id = msg.photo[msg.photo.length - 1].file_id;
  else if (msg.document) file_id = msg.document.file_id;
  let imgUrl = "", driveId = "";
  try { imgUrl = tgGetFileUrl_(file_id); } catch (e) {}
  // intentar guardar en Drive
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
    if (folderId && imgUrl) {
      const blob = UrlFetchApp.fetch(imgUrl).getBlob().setName("factura_" + Date.now() + ".jpg");
      const file = DriveApp.getFolderById(folderId).createFile(blob);
      driveId = file.getId();
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      imgUrl = "https://drive.google.com/uc?id=" + driveId;
    }
  } catch (e) {}

  // OCR
  const ocrText = doOCR_(imgUrl, driveId);
  const data = parseInvoiceText_(ocrText);

  const fac = appendRow_("facturas_telegram", {
    telegram_user_id: String(msg.from.id),
    telegram_username: msg.from.username || msg.from.first_name || "",
    fecha: new Date().toISOString(),
    imagen_drive_id: driveId, imagen_url: imgUrl,
    ocr_texto: ocrText, datos_extraidos_json: JSON.stringify(data),
    estado: "pendiente", compra_id: 0
  });

  const resumen = renderInvoiceSummary_(data);
  tg_("sendMessage", {
    chat_id, parse_mode: "Markdown",
    text: "📋 *Factura recibida #" + fac.id + "*\n" + resumen + "\n\n¿Confirmar y registrar como compra?",
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Confirmar", callback_data: "conf_" + fac.id },
        { text: "❌ Descartar", callback_data: "desc_" + fac.id }
      ]]
    }
  });
  return ok_();
}

function renderInvoiceSummary_(data) {
  const lines = [];
  if (data.proveedor) lines.push("*Proveedor:* " + data.proveedor);
  if (data.proveedor_doc) lines.push("*NIT/RUC:* " + data.proveedor_doc);
  if (data.numero) lines.push("*N°:* " + data.numero);
  if (data.fecha) lines.push("*Fecha:* " + data.fecha);
  if (data.subtotal) lines.push("*Subtotal:* " + fmtMoney_(data.subtotal));
  if (data.iva) lines.push("*IVA:* " + fmtMoney_(data.iva));
  if (data.total) lines.push("*Total:* " + fmtMoney_(data.total));
  if (data.lineas && data.lineas.length) {
    lines.push("\n*Productos:*");
    data.lineas.slice(0, 10).forEach(l => lines.push(`• ${l.cantidad}x ${l.descripcion} @ ${fmtMoney_(l.costo)}`));
  }
  if (!lines.length) lines.push("_(OCR no pudo extraer datos confiables — revisa en el panel web)_");
  return lines.join("\n");
}

function confirmFactura_(chat_id, facturaId, user) {
  const fac = readAll_("facturas_telegram").find(f => Number(f.id) === facturaId);
  if (!fac) { tg_("sendMessage", { chat_id, text: "Factura no encontrada." }); return ok_(); }
  if (fac.estado === "confirmada") { tg_("sendMessage", { chat_id, text: "Ya estaba confirmada." }); return ok_(); }
  let data; try { data = JSON.parse(fac.datos_extraidos_json); } catch (e) { data = {}; }
  if (!data.lineas || !data.lineas.length) {
    tg_("sendMessage", { chat_id, text: "⚠️ La factura no tiene productos detectados. Ábrela en el panel web para vincularlos manualmente." });
    return ok_();
  }
  // emparejar productos por nombre
  const productos = readAll_("productos");
  const lineas = data.lineas.map(l => {
    const p = productos.find(pr => (pr.nombre || "").toLowerCase().indexOf((l.descripcion || "").toLowerCase().slice(0, 10)) >= 0);
    return { producto_id: p?.id, cantidad: Number(l.cantidad) || 1, costo_unitario: Number(l.costo) || 0, desc: l.descripcion };
  });
  const noEnc = lineas.filter(l => !l.producto_id);
  if (noEnc.length) {
    const ids = noEnc.map(l => "• " + l.desc).join("\n");
    tg_("sendMessage", { chat_id, parse_mode: "Markdown", text: "⚠️ No pude vincular estos productos:\n" + ids + "\n\nÁbrela en el panel web para asignarlos." });
    return ok_();
  }
  // proveedor: si no existe, crear borrador
  let proveedorId = 0;
  if (data.proveedor) {
    const provs = readAll_("proveedores");
    const found = provs.find(p => (p.nombre || "").toLowerCase().indexOf((data.proveedor || "").toLowerCase()) >= 0);
    if (found) proveedorId = found.id;
    else proveedorId = appendRow_("proveedores", { nombre: data.proveedor, num_doc: data.proveedor_doc || "", activo: true, created_at: new Date().toISOString(), created_by: user.id }).id;
  }
  const compra = createPurchase_({
    numero: data.numero || ("F-" + facturaId),
    proveedor_id: proveedorId,
    fecha: data.fecha || new Date().toISOString(),
    metodo_pago_id: 1, caja_id: 0, iva: data.iva || 0,
    estado: "pendiente", origen_telegram: true, factura_telegram_id: facturaId,
    observaciones: "Confirmada desde Telegram",
    lineas: lineas.map(l => ({ producto_id: l.producto_id, cantidad: l.cantidad, costo_unitario: l.costo_unitario })),
    user_id: user.id
  });
  updateRow_("facturas_telegram", facturaId, { estado: "confirmada", compra_id: compra.id, confirmada_at: new Date().toISOString(), confirmada_by: user.id });
  tg_("sendMessage", { chat_id, parse_mode: "Markdown", text: "✅ Compra creada: *" + compra.numero + "* — Total *" + fmtMoney_(compra.total) + "*" });
  return ok_();
}

// ============= OCR =============
function doOCR_(imageUrl, driveId) {
  const provider = PropertiesService.getScriptProperties().getProperty("OCR_PROVIDER") || "drive";
  try {
    if (provider === "vision") return ocrVision_(imageUrl);
    if (provider === "drive") return ocrDrive_(imageUrl, driveId);
  } catch (e) { /* fallback */ }
  return "";
}

function ocrVision_(imageUrl) {
  const key = PropertiesService.getScriptProperties().getProperty("VISION_API_KEY");
  if (!key) return "";
  const blob = UrlFetchApp.fetch(imageUrl).getBlob();
  const b64 = Utilities.base64Encode(blob.getBytes());
  const res = UrlFetchApp.fetch("https://vision.googleapis.com/v1/images:annotate?key=" + key, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify({ requests: [{ image: { content: b64 }, features: [{ type: "TEXT_DETECTION" }] }] }),
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText());
  return data.responses?.[0]?.fullTextAnnotation?.text || "";
}

function ocrDrive_(imageUrl, driveId) {
  // Crea un Google Doc desde la imagen — Drive lo OCRea automáticamente
  if (!driveId) {
    if (!imageUrl) return "";
    const blob = UrlFetchApp.fetch(imageUrl).getBlob().setName("ocr_" + Date.now() + ".jpg");
    const f = DriveApp.createFile(blob);
    driveId = f.getId();
  }
  const resource = { title: "ocr_" + Date.now(), mimeType: MimeType.GOOGLE_DOCS };
  const fileMeta = { title: resource.title, mimeType: resource.mimeType };
  const file = Drive.Files.copy(fileMeta, driveId, { ocr: true, ocrLanguage: "es" });
  const doc = DocumentApp.openById(file.id);
  const text = doc.getBody().getText();
  Drive.Files.remove(file.id);
  return text;
}

// Parser heurístico — espejo del cliente
function parseInvoiceText_(text) {
  if (!text) return {};
  const out = { lineas: [] };
  let m = text.match(/proveedor\s*:?\s*(.+)/i); if (m) out.proveedor = m[1].split("\n")[0].trim();
  m = text.match(/(NIT|RUC|CC|RFC|Tax ID)[:\s]+([\d\.\-]+)/i); if (m) out.proveedor_doc = m[2];
  m = text.match(/factura[:\s#nº]+([A-Z0-9\-]+)/i); if (m) out.numero = m[1];
  m = text.match(/fecha\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (m) {
    const parts = m[1].split(/[\/\-]/);
    let y = parts[2]; if (y.length === 2) y = "20" + y;
    out.fecha = y + "-" + (parts[1].length===1 ? "0"+parts[1] : parts[1]) + "-" + (parts[0].length===1 ? "0"+parts[0] : parts[0]);
  }
  m = text.match(/subtotal[:\s\$]*(\d[\d\.,]*)/i); if (m) out.subtotal = parseNum_(m[1]);
  m = text.match(/(iva|impuesto|tax)[:\s\$]*(\d[\d\.,]*)/i); if (m) out.iva = parseNum_(m[2]);
  m = text.match(/total\s*(?:a\s*pagar)?[:\s\$]*(\d[\d\.,]*)/i); if (m) out.total = parseNum_(m[1]);
  text.split("\n").map(l => l.trim()).filter(Boolean).forEach(l => {
    const lm = l.match(/^(\d+)\s+(.+?)\s+(\d[\d\.,]*)\s+(\d[\d\.,]*)$/);
    if (lm) out.lineas.push({ cantidad: parseInt(lm[1]), descripcion: lm[2].trim(), costo: parseNum_(lm[3]), subtotal: parseNum_(lm[4]) });
  });
  return out;
}
function parseNum_(s) { return parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0; }

// ============= Triggers (alertas diarias) =============
function dailyAlerts() {
  // Avisa a admins (tg vinculado) de bajo stock + facturas pendientes + caja sin cerrar
  const admins = readAll_("usuarios").filter(u => u.activo && u.rol_id === 1 && u.telegram_id);
  const productos = readAll_("productos").filter(p => p.activo);
  const bajos = productos.filter(p => stockOf_(p.id) < (Number(p.stock_minimo) || 0));
  const pendientes = readAll_("facturas_telegram").filter(f => f.estado === "pendiente");
  let msg = "🔔 *Resumen diario*\n";
  msg += `Bajo stock: ${bajos.length}\n`;
  msg += `Facturas pendientes: ${pendientes.length}\n`;
  admins.forEach(a => tg_("sendMessage", { chat_id: a.telegram_id, text: msg, parse_mode: "Markdown" }));
}
