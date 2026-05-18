// Panel del Bot de Telegram: facturas subidas, autorizados, logs.
Router.register("/telegram", async (host) => {
  document.getElementById("page-title").textContent = "Bot de Telegram";

  function render() {
    const facturas = DB.list("facturas_telegram");
    const autorizados = DB.list("telegram_usuarios_autorizados");
    const logs = DB.list("telegram_logs").slice(-30).reverse();

    host.innerHTML = `
      <div class="page">
        <div class="page-header">
          <h2>Bot de Telegram</h2>
          <div class="actions">
            <button class="btn btn-primary" id="btn-test">Probar OCR local (subir foto)</button>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi"><div class="label">Facturas recibidas</div><div class="value">${facturas.length}</div></div>
          <div class="kpi"><div class="label">Pendientes</div><div class="value">${facturas.filter(f => f.estado === "pendiente").length}</div></div>
          <div class="kpi"><div class="label">Confirmadas</div><div class="value">${facturas.filter(f => f.estado === "confirmada").length}</div></div>
          <div class="kpi"><div class="label">Usuarios autorizados</div><div class="value">${autorizados.length}</div></div>
        </div>

        <h3>Facturas subidas por Telegram</h3>
        <div id="fac-list"></div>

        <h3 style="margin-top:24px">Usuarios autorizados</h3>
        <p class="muted">Los usuarios del sistema con <code>telegram_id</code> configurado pueden usar el bot. También puedes autorizar IDs de Telegram puntuales aquí.</p>
        <form id="frm-auth" class="flex" style="margin-bottom:8px">
          <input class="inp" name="telegram_id" placeholder="Telegram ID" required>
          <select class="sel" name="usuario_id">
            <option value="">(sin usuario vinculado)</option>
            ${DB.list("usuarios", { activo: true }).map(u => `<option value="${u.id}">${U.escape(u.username)}</option>`).join("")}
          </select>
          <button class="btn btn-primary">Autorizar</button>
        </form>
        <div id="auth-list"></div>

        <h3 style="margin-top:24px">Logs del bot</h3>
        <div id="log-list"></div>

        <h3 style="margin-top:24px">Configurar webhook</h3>
        <p class="muted">Pega esto en tu navegador (una sola vez) tras desplegar tu Apps Script:</p>
        <code style="display:block;background:var(--surface-2);padding:8px;border-radius:6px;font-size:12px;word-break:break-all">
          https://api.telegram.org/bot8980738836:AAGQfL9n7jzPDWJtALIpD4XCq0vrpzbxcp4/setWebhook?url=&lt;TU_APPS_SCRIPT_EXEC_URL&gt;
        </code>
      </div>
    `;

    host.querySelector("#fac-list").innerHTML = U.table([
      { key: "id", label: "#" },
      { key: "fecha", label: "Fecha", render: r => U.fmtDate(r.fecha) },
      { key: "tg", label: "Telegram", render: r => `${U.escape(r.telegram_username || "")} (${r.telegram_user_id})` },
      { key: "estado", label: "Estado", render: r => `<span class="tag tag-${r.estado === "confirmada" ? "pagada" : r.estado === "pendiente" ? "pendiente" : "anulada"}">${r.estado}</span>` },
      { key: "compra", label: "Compra", render: r => r.compra_id ? `<a href="#/compras">#${r.compra_id}</a>` : "—" },
      { key: "act", label: "", render: r => `
        ${r.estado === "pendiente" ? `<button class="btn btn-sm btn-primary" data-confirm="${r.id}">Revisar y confirmar</button>` : ""}
        <button class="btn btn-sm" data-view="${r.id}">Ver</button>
      ` }
    ], [...facturas].reverse());

    host.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => viewFactura(Number(b.dataset.view))));
    host.querySelectorAll("[data-confirm]").forEach(b => b.addEventListener("click", () => confirmarFactura(Number(b.dataset.confirm))));

    host.querySelector("#auth-list").innerHTML = U.table([
      { key: "telegram_id", label: "Telegram ID" },
      { key: "usuario", label: "Usuario", render: r => U.escape(DB.get("usuarios", r.usuario_id)?.username || "(libre)") },
      { key: "activo", label: "Activo", render: r => r.activo !== false ? "Sí" : "No" },
      { key: "act", label: "", render: r => `<button class="btn btn-sm btn-danger" data-rem="${r.telegram_id}">Quitar</button>` }
    ], autorizados);
    host.querySelectorAll("[data-rem]").forEach(b => b.addEventListener("click", () => {
      const tgid = b.dataset.rem;
      const db = DB.getDB();
      db.telegram_usuarios_autorizados = db.telegram_usuarios_autorizados.filter(x => x.telegram_id !== tgid);
      DB.setDB(db);
      render();
    }));

    host.querySelector("#log-list").innerHTML = U.table([
      { key: "fecha", label: "Fecha", render: r => U.fmtDate(r.fecha) },
      { key: "telegram_user_id", label: "TG ID" },
      { key: "tipo", label: "Tipo" },
      { key: "comando", label: "Comando" },
      { key: "respuesta", label: "Respuesta", render: r => U.escape((r.respuesta || "").slice(0,80)) }
    ], logs);

    host.querySelector("#frm-auth").addEventListener("submit", e => {
      e.preventDefault();
      const d = U.formData(e.target);
      DB.insert("telegram_usuarios_autorizados", {
        telegram_id: d.telegram_id, usuario_id: U.num(d.usuario_id) || 0,
        autorizado_at: U.nowISO(), autorizado_by: Auth.currentUser().id, activo: true
      });
      U.toast("Autorizado", "success");
      render();
    });

    host.querySelector("#btn-test").addEventListener("click", testOCR);
  }

  async function testOCR() {
    // Simula recepción de factura sin Telegram. Usa la cámara/archivo del usuario.
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <form class="modal" id="frm">
          <h3>Probar OCR de factura (local)</h3>
          <p class="muted">En producción, esto lo hace el bot automáticamente. Aquí puedes pegar texto OCR para simular el flujo.</p>
          <label class="lbl">Imagen factura<input class="inp" type="file" accept="image/*" id="fimg"></label>
          <label class="lbl">Texto OCR (puedes pegar)
            <textarea class="inp" name="texto" rows="8" placeholder="Pega aquí el texto extraído de la factura...
Proveedor: Distribuidora XYZ
NIT: 900123456-7
Factura: F-001234
Fecha: 18/05/2026
2 Cuaderno argollado 100h 5500 11000
10 Lapicero negro BIC 800 8000
Subtotal: 19000
IVA: 3610
Total: 22610"></textarea>
          </label>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Procesar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl");
    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) mdl.remove(); });
    mdl.querySelector("#frm").addEventListener("submit", e => {
      e.preventDefault();
      const txt = e.target.querySelector("[name=texto]").value;
      const file = e.target.querySelector("#fimg").files[0];
      const reader = new FileReader();
      const done = (dataUrl) => {
        const data = parseInvoiceText(txt);
        const fac = DB.insert("facturas_telegram", {
          telegram_user_id: "local", telegram_username: Auth.currentUser().username,
          fecha: U.nowISO(), imagen_url: dataUrl || "",
          ocr_texto: txt, datos_extraidos_json: JSON.stringify(data),
          estado: "pendiente", compra_id: null
        });
        U.toast("Factura registrada como pendiente", "success");
        mdl.remove();
        render();
        confirmarFactura(fac.id);
      };
      if (file) { reader.onload = () => done(reader.result); reader.readAsDataURL(file); }
      else done(null);
    });
  }

  function viewFactura(id) {
    const f = DB.get("facturas_telegram", id);
    const datos = (() => { try { return JSON.parse(f.datos_extraidos_json); } catch (e) { return {}; } })();
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <div class="modal lg">
          <h3>Factura Telegram #${f.id}</h3>
          <div class="grid grid-2">
            <div>
              <div class="muted">Fecha recepción</div><div>${U.fmtDate(f.fecha)}</div>
              <div class="muted">Usuario Telegram</div><div>${U.escape(f.telegram_username || "")} (${f.telegram_user_id})</div>
              <div class="muted">Estado</div><div><span class="tag tag-${f.estado === "confirmada" ? "pagada" : f.estado === "pendiente" ? "pendiente" : "anulada"}">${f.estado}</span></div>
              <div class="muted mt-8">Datos extraídos (OCR)</div>
              <pre style="background:var(--surface-2);padding:8px;border-radius:6px;font-size:12px;max-height:280px;overflow:auto">${U.escape(JSON.stringify(datos, null, 2))}</pre>
            </div>
            <div>
              ${f.imagen_url ? `<img src="${U.escape(f.imagen_url)}" style="max-width:100%;border:1px solid var(--border);border-radius:6px">` : '<p class="muted">Sin imagen</p>'}
              <details style="margin-top:8px"><summary>Texto OCR crudo</summary><pre style="font-size:11px;max-height:200px;overflow:auto">${U.escape(f.ocr_texto || "")}</pre></details>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-close>Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    div.querySelector("#mdl").addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target.id === "mdl") div.remove(); });
  }

  function confirmarFactura(id) {
    const f = DB.get("facturas_telegram", id);
    if (!f) return;
    const datos = (() => { try { return JSON.parse(f.datos_extraidos_json); } catch (e) { return {}; } })();

    // sugerir proveedor por nombre
    let proveedorId = 0;
    if (datos.proveedor) {
      const provs = DB.list("proveedores");
      const found = provs.find(p => p.nombre.toLowerCase().includes((datos.proveedor || "").toLowerCase()));
      if (found) proveedorId = found.id;
    }

    // sugerir productos
    const productos = DB.list("productos");
    const lineas = (datos.lineas || []).map(l => {
      const p = productos.find(pr => pr.nombre.toLowerCase().includes((l.descripcion || "").toLowerCase().slice(0, 12)));
      return {
        producto_id: p?.id || "",
        descripcion: l.descripcion || "",
        cantidad: U.num(l.cantidad) || 1,
        costo_unitario: U.num(l.costo) || 0,
        sugerido: !!p
      };
    });

    // abrir modal de confirmación
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl">
        <form class="modal lg" id="frm" style="max-width:900px">
          <h3>Confirmar factura del bot #${f.id}</h3>
          <p class="muted">Revisa los datos extraídos y vincula productos. Al confirmar, se creará una compra y aumentará el inventario.</p>
          <div class="grid grid-3">
            <label class="lbl">Proveedor
              <select class="sel" name="proveedor_id" required>
                <option value="">Selecciona...</option>
                ${DB.list("proveedores", { activo: true }).map(p => `<option value="${p.id}" ${p.id === proveedorId ? "selected" : ""}>${U.escape(p.nombre)}</option>`).join("")}
              </select>
            </label>
            <label class="lbl">N° factura<input class="inp" name="numero" value="${U.escape(datos.numero || "")}" required></label>
            <label class="lbl">Fecha<input class="inp" type="date" name="fecha" value="${(datos.fecha || U.todayStr()).slice(0,10)}" required></label>
            <label class="lbl">Subtotal<input class="inp" type="number" name="subtotal" value="${U.num(datos.subtotal)}"></label>
            <label class="lbl">IVA<input class="inp" type="number" name="iva" value="${U.num(datos.iva)}"></label>
            <label class="lbl">Total<input class="inp" type="number" name="total" value="${U.num(datos.total)}"></label>
          </div>
          <h4 style="margin-top:14px">Productos detectados</h4>
          <table class="data-table line-table" id="lines"><thead><tr>
            <th>Descripción OCR</th><th style="min-width:240px">Vincular con</th><th>Cantidad</th><th>Costo unit.</th><th>Subtotal</th>
          </tr></thead><tbody>
            ${lineas.map((l, i) => `
              <tr data-i="${i}">
                <td>${U.escape(l.descripcion)}</td>
                <td><select class="sel l-prod">
                  <option value="">(crear/saltar)</option>
                  ${productos.map(p => `<option value="${p.id}" ${p.id === l.producto_id ? "selected" : ""}>${U.escape(p.sku)} — ${U.escape(p.nombre)}</option>`).join("")}
                </select></td>
                <td><input class="inp l-qty" type="number" min="0" value="${l.cantidad}" style="width:80px"></td>
                <td><input class="inp l-cost" type="number" min="0" step="0.01" value="${l.costo_unitario}" style="width:100px"></td>
                <td class="l-sub right">${U.money(l.cantidad * l.costo_unitario)}</td>
              </tr>`).join("")}
          </tbody></table>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="button" class="btn btn-warning" data-discard>Descartar factura</button>
            <button type="submit" class="btn btn-primary">Confirmar y crear compra</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl");
    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) mdl.remove(); });

    mdl.querySelectorAll("#lines tbody tr").forEach(tr => {
      const recalc = () => {
        const q = U.num(tr.querySelector(".l-qty").value);
        const c = U.num(tr.querySelector(".l-cost").value);
        tr.querySelector(".l-sub").textContent = U.money(q * c);
      };
      tr.querySelectorAll("input").forEach(i => i.addEventListener("input", recalc));
    });

    mdl.querySelector("[data-discard]").addEventListener("click", () => {
      DB.update("facturas_telegram", id, { estado: "descartada" });
      U.toast("Factura descartada", "warning");
      mdl.remove(); render();
    });

    mdl.querySelector("#frm").addEventListener("submit", e => {
      e.preventDefault();
      const data = U.formData(e.target);
      const lineRows = [...mdl.querySelectorAll("#lines tbody tr")].map(tr => ({
        producto_id: Number(tr.querySelector(".l-prod").value) || null,
        cantidad: U.num(tr.querySelector(".l-qty").value),
        costo_unitario: U.num(tr.querySelector(".l-cost").value)
      })).filter(l => l.producto_id && l.cantidad > 0);

      if (!lineRows.length) return U.toast("Vincula al menos un producto válido", "danger");

      const sub = lineRows.reduce((a, l) => a + l.cantidad * l.costo_unitario, 0);
      const compra = DB.insert("compras", {
        numero: data.numero,
        proveedor_id: U.num(data.proveedor_id),
        fecha: data.fecha + "T" + new Date().toTimeString().slice(0,8),
        metodo_pago_id: DB.list("metodos_pago")[0]?.id,
        subtotal: U.num(data.subtotal) || sub,
        iva: U.num(data.iva),
        total: U.num(data.total) || sub + U.num(data.iva),
        estado: "pendiente",
        observaciones: "Subida vía Telegram",
        origen_telegram: true,
        factura_telegram_id: id
      });

      lineRows.forEach(l => {
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
          referencia_tipo: "compra_telegram", referencia_id: compra.id,
          motivo: "Factura Telegram #" + id
        });
      });

      DB.update("facturas_telegram", id, {
        estado: "confirmada", compra_id: compra.id,
        confirmada_at: U.nowISO(), confirmada_by: Auth.currentUser().id
      });

      U.toast(`Compra ${compra.numero} creada desde Telegram`, "success");
      mdl.remove();
      render();
    });
  }

  // Parser heurístico de texto OCR (cliente). El backend tiene la versión completa.
  function parseInvoiceText(text) {
    if (!text) return {};
    const out = { lineas: [] };
    // proveedor
    let m = text.match(/proveedor\s*:?\s*(.+)/i); if (m) out.proveedor = m[1].split("\n")[0].trim();
    m = text.match(/(NIT|RUC|CC|RFC|Tax ID)[:\s]+([\d\.\-]+)/i); if (m) out.proveedor_doc = m[2];
    m = text.match(/factura[:\s#nº]+([A-Z0-9\-]+)/i); if (m) out.numero = m[1];
    m = text.match(/fecha\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (m) {
      const parts = m[1].split(/[\/\-]/);
      let [d,mo,y] = parts;
      if (y.length === 2) y = "20" + y;
      out.fecha = `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }
    m = text.match(/subtotal[:\s\$]*(\d[\d\.,]*)/i); if (m) out.subtotal = parseFloat(m[1].replace(/\./g,"").replace(",","."));
    m = text.match(/(iva|impuesto|tax)[:\s\$]*(\d[\d\.,]*)/i); if (m) out.iva = parseFloat(m[2].replace(/\./g,"").replace(",","."));
    m = text.match(/total\s*(?:a\s*pagar)?[:\s\$]*(\d[\d\.,]*)/i); if (m) out.total = parseFloat(m[1].replace(/\./g,"").replace(",","."));

    // líneas: heurística — busca filas con número al inicio (cant) + texto + 2 números (precio, total)
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    lines.forEach(l => {
      const lm = l.match(/^(\d+)\s+(.+?)\s+(\d[\d\.,]*)\s+(\d[\d\.,]*)$/);
      if (lm) {
        out.lineas.push({
          cantidad: parseInt(lm[1]),
          descripcion: lm[2].trim(),
          costo: parseFloat(lm[3].replace(/\./g,"").replace(",",".")),
          subtotal: parseFloat(lm[4].replace(/\./g,"").replace(",","."))
        });
      }
    });
    return out;
  }

  render();
}, { module: "telegram" });
