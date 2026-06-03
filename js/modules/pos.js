// Punto de Venta (POS) — diseño limpio.
// Atajos: F2 buscar · F9 limpiar · F12 cobrar · Esc cerrar · ↑↓ navegar · Enter agregar
Router.register("/pos", async (host) => {
  document.getElementById("page-title").textContent = "Punto de venta";

  const cart = [];
  let resultsFocus = 0;
  let activeCat = null;
  let lastResults = [];

  // Iconos según categoría/nombre
  const ICONS = {
    "Útiles escolares": "✏️", "Oficina": "📎", "Arte": "🎨",
    "Tecnología": "💻", "Otros": "📦"
  };

  function productIcon(p) {
    const cat = DB.get("categorias", p.categoria_id);
    return ICONS[cat?.nombre] || (p.sku || "?").slice(0, 2).toUpperCase();
  }

  function render() {
    const productos = DB.list("productos", { activo: true });
    const categorias = DB.list("categorias", { activo: true });
    const metodos = DB.list("metodos_pago", { activo: true });
    const cajas = DB.list("cajas", { activo: true });
    const clientes = DB.list("clientes", { activo: true });

    host.innerHTML = `
      <div class="pos-wrap">
        <!-- IZQUIERDA -->
        <div class="pos-left">
          <div class="pos-search">
            <input id="pos-search-inp" placeholder="Buscar producto por nombre o SKU…" autocomplete="off">
          </div>
          <div class="pos-cats" id="pos-cats">
            <div class="pos-cat-chip active" data-cat="">Todos</div>
            ${categorias.map(c => `<div class="pos-cat-chip" data-cat="${c.id}">${ICONS[c.nombre] || "•"} ${U.escape(c.nombre)}</div>`).join("")}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
            <div class="pos-list-header">
              <span>Producto</span>
              <span style="text-align:center">SKU</span>
              <span style="text-align:center">Stock</span>
              <span style="text-align:right">Precio</span>
            </div>
            <div class="pos-results" id="pos-results" style="border-radius:0 0 12px 12px"></div>
          </div>
        </div>

        <!-- DERECHA -->
        <div class="pos-right">
          <div class="pos-cart-head">
            <h3>Pedido <span class="count" id="pos-cart-count">0</span></h3>
            <button class="clear" id="pos-clear">Vaciar</button>
          </div>
          <div class="pos-cart" id="pos-cart"></div>
          <div class="pos-bottom">
            <div class="line"><span>Subtotal</span><span id="pos-subtotal">${U.money(0)}</span></div>
            <div class="line">
              <span>Descuento</span>
              <input id="pos-desc" type="number" min="0" value="0" placeholder="0">
            </div>
            <div class="total">
              <span>Total a pagar</span>
              <span class="value" id="pos-total">${U.money(0)}</span>
            </div>
            <div class="selectors">
              <select id="pos-cliente">
                <option value="">👤 Mostrador</option>
                ${clientes.map(c => `<option value="${c.id}">👤 ${U.escape(c.nombre)}</option>`).join("")}
              </select>
              <select id="pos-vendedor">
                ${DB.list("usuarios", { activo: true }).map(u => `<option value="${u.id}" ${u.id === Auth.currentUser().id ? "selected" : ""}>${U.escape(u.username)}</option>`).join("")}
              </select>
            </div>
            <button class="btn-cobrar" id="pos-pay" disabled>
              Cobrar <kbd>F12</kbd>
            </button>
            <div class="pos-shortcuts">
              <kbd class="hint">F2</kbd> buscar
              · <kbd class="hint">↑↓</kbd> navegar
              · <kbd class="hint">Enter</kbd> agregar
              · <kbd class="hint">F9</kbd> vaciar
            </div>
          </div>
        </div>
      </div>
    `;

    const inp = host.querySelector("#pos-search-inp");
    const results = host.querySelector("#pos-results");

    function showResults() {
      const q = inp.value.trim().toLowerCase();
      let rows = productos;
      if (activeCat) rows = rows.filter(p => String(p.categoria_id) === String(activeCat));
      if (q) rows = rows.filter(p =>
        (p.nombre || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
      );
      rows = rows.slice(0, 60);
      lastResults = rows;
      resultsFocus = 0;
      if (!rows.length) {
        results.innerHTML = `<div class="pos-empty">
          <div style="font-size:36px;opacity:.4;margin-bottom:8px">🔍</div>
          <div>Sin resultados${q ? ` para "${U.escape(q)}"` : ""}</div>
        </div>`;
        return;
      }
      results.innerHTML = rows.map((p, i) => {
        const stock = DB.stockOf(p.id);
        let stockCls = "";
        if (stock <= 0) stockCls = "zero";
        else if (stock < U.num(p.stock_minimo)) stockCls = "low";
        const stockTxt = stock <= 0 ? "Sin stock" : `<strong>${stock}</strong>`;
        return `
          <div class="pos-card ${stock <= 0 ? "no-stock" : ""} ${i === 0 ? "focused" : ""}" data-id="${p.id}" data-i="${i}">
            <div class="name">${U.escape(p.nombre)}</div>
            <div class="sku">${U.escape(p.sku)}</div>
            <div class="stock ${stockCls}">${stockTxt}</div>
            <div class="price">${U.money(p.precio_venta)}</div>
          </div>
        `;
      }).join("");
      results.querySelectorAll(".pos-card").forEach(card => {
        card.addEventListener("click", () => addToCart(Number(card.dataset.id)));
      });
    }

    function moveFocus(delta) {
      const cards = results.querySelectorAll(".pos-card");
      if (!cards.length) return;
      cards[resultsFocus]?.classList.remove("focused");
      resultsFocus = Math.max(0, Math.min(cards.length - 1, resultsFocus + delta));
      cards[resultsFocus]?.classList.add("focused");
      cards[resultsFocus]?.scrollIntoView({ block: "nearest" });
    }

    function addToCart(productoId) {
      const p = DB.get("productos", productoId);
      if (!p) return;
      const stock = DB.stockOf(productoId);
      if (stock <= 0) { U.toast("Sin stock disponible", "danger"); return; }
      const existing = cart.find(x => x.producto_id === productoId);
      if (existing) {
        if (existing.cantidad + 1 > stock) { U.toast(`Stock máximo: ${stock}`, "warning"); return; }
        existing.cantidad++;
      } else {
        cart.push({
          producto_id: productoId,
          nombre: p.nombre, sku: p.sku,
          precio: U.num(p.precio_venta),
          costo: DB.avgCostOf(productoId),
          cantidad: 1, stock,
          icon: productIcon(p)
        });
      }
      renderCart();
      inp.value = "";
      showResults();
      inp.focus();
    }

    function renderCart() {
      const cartEl = host.querySelector("#pos-cart");
      const payBtn = host.querySelector("#pos-pay");
      if (!cart.length) {
        cartEl.innerHTML = `<div class="pos-cart-empty">
          <div class="icon">🛍️</div>
          <div style="font-weight:600;color:var(--text)">El pedido está vacío</div>
          <div style="font-size:12px;margin-top:6px">Busca un producto y haz clic para agregarlo</div>
        </div>`;
        payBtn.disabled = true;
      } else {
        cartEl.innerHTML = cart.map((it, idx) => `
          <div class="pos-cart-item">
            <div class="ci-thumb">${it.icon}</div>
            <div>
              <div class="ci-name">${U.escape(it.nombre)}</div>
              <div class="ci-meta">
                <span class="qty-ctrl">
                  <button data-act="dec" data-i="${idx}">−</button>
                  <span class="q">${it.cantidad}</span>
                  <button data-act="inc" data-i="${idx}">+</button>
                </span>
                <span>×&nbsp;${U.money(it.precio)}</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <div class="ci-sub">${U.money(it.precio * it.cantidad)}</div>
              <button class="ci-del" data-act="del" data-i="${idx}" title="Eliminar">✕</button>
            </div>
          </div>
        `).join("");
        cartEl.querySelectorAll("button[data-act]").forEach(b => b.addEventListener("click", () => {
          const i = Number(b.dataset.i);
          const it = cart[i];
          if (b.dataset.act === "inc") {
            if (it.cantidad + 1 > it.stock) { U.toast(`Stock máximo: ${it.stock}`, "warning"); return; }
            it.cantidad++;
          } else if (b.dataset.act === "dec") {
            it.cantidad--;
            if (it.cantidad <= 0) cart.splice(i, 1);
          } else if (b.dataset.act === "del") {
            cart.splice(i, 1);
          }
          renderCart();
        }));
        payBtn.disabled = false;
      }
      const sub = cart.reduce((a, b) => a + b.precio * b.cantidad, 0);
      const desc = U.num(host.querySelector("#pos-desc").value);
      const total = Math.max(0, sub - desc);
      host.querySelector("#pos-subtotal").textContent = U.money(sub);
      host.querySelector("#pos-total").textContent = U.money(total);
      host.querySelector("#pos-cart-count").textContent = cart.length;
    }

    function clearCart() {
      if (!cart.length) return;
      cart.length = 0;
      renderCart();
      inp.focus();
    }

    // Eventos
    inp.addEventListener("input", showResults);
    inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); moveFocus(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveFocus(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const card = results.querySelector(".pos-card.focused");
        if (card) addToCart(Number(card.dataset.id));
      }
    });
    host.querySelectorAll(".pos-cat-chip").forEach(c => c.addEventListener("click", () => {
      host.querySelectorAll(".pos-cat-chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      activeCat = c.dataset.cat || null;
      showResults();
    }));
    host.querySelector("#pos-desc").addEventListener("input", renderCart);
    host.querySelector("#pos-clear").addEventListener("click", clearCart);
    host.querySelector("#pos-pay").addEventListener("click", openCobro);

    showResults();
    renderCart();
    inp.focus();

    // Atajos
    function onKey(e) {
      if (e.key === "F2") { e.preventDefault(); inp.focus(); inp.select(); }
      else if (e.key === "F9") { e.preventDefault(); clearCart(); }
      else if (e.key === "F12") { e.preventDefault(); openCobro(); }
    }
    document.addEventListener("keydown", onKey);
    host._posCleanup = () => document.removeEventListener("keydown", onKey);

    function openCobro() {
      if (!cart.length) return U.toast("Agrega productos al carrito", "warning");
      const sub = cart.reduce((a, b) => a + b.precio * b.cantidad, 0);
      const desc = U.num(host.querySelector("#pos-desc").value);
      const total = Math.max(0, sub - desc);
      const clienteId = U.num(host.querySelector("#pos-cliente").value);
      const vendedorId = U.num(host.querySelector("#pos-vendedor").value) || Auth.currentUser().id;

      // botones de método de pago
      const methodIcons = { efectivo: "💵", transferencia: "🏦", tarjeta: "💳", credito: "📝", otro: "•" };

      // sugerencias de billetes
      const sugerencias = [...new Set([
        total,
        Math.ceil(total / 1000) * 1000,
        Math.ceil(total / 5000) * 5000,
        Math.ceil(total / 10000) * 10000,
        Math.ceil(total / 20000) * 20000,
        Math.ceil(total / 50000) * 50000,
        Math.ceil(total / 100000) * 100000
      ].filter(v => v >= total))].slice(0, 8);

      const div = document.createElement("div");
      div.innerHTML = `
        <div class="modal-backdrop" id="mdl-cobro">
          <form class="modal cobro-modal" id="frm-cobro">
            <h3>Cobrar</h3>
            <div class="cobro-total">
              <div class="label">Total a pagar</div>
              <div class="amount">${U.money(total)}</div>
            </div>
            <div class="cobro-body">
              <div class="cobro-method" id="cobro-method">
                ${metodos.map((m, i) => `
                  <button type="button" data-mp="${m.id}" data-tipo="${m.tipo}" class="${i === 0 ? "active" : ""}">
                    <span class="ico">${methodIcons[m.tipo] || "•"}</span>
                    <span>${U.escape(m.nombre)}</span>
                  </button>
                `).join("")}
              </div>

              <div id="cobro-efectivo-block">
                <div class="cobro-quickcash">
                  ${sugerencias.map(v => `<button type="button" data-cash="${v}">${U.money(v)}</button>`).join("")}
                </div>
                <div class="cobro-cash-row">
                  <div class="cobro-cash recibido">
                    <div class="label">Recibido</div>
                    <input type="number" id="cobro-recibido" min="0" step="0.01" inputmode="decimal">
                  </div>
                  <div class="cobro-cash">
                    <div class="label">Cambio</div>
                    <div class="value zero" id="cobro-cambio">${U.money(0)}</div>
                  </div>
                </div>
              </div>

              <select class="sel" id="cobro-caja" style="margin-top:8px">
                ${cajas.map(c => `<option value="${c.id}">📦 ${U.escape(c.nombre)}</option>`).join("")}
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-close>Cancelar (Esc)</button>
              <button type="submit" class="btn btn-primary">Confirmar venta · ${U.money(total)}</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(div);
      const mdl = div.querySelector("#mdl-cobro");
      const recInp = mdl.querySelector("#cobro-recibido");
      const cambioEl = mdl.querySelector("#cobro-cambio");
      const efBlock = mdl.querySelector("#cobro-efectivo-block");
      let selectedMP = metodos[0];
      let selectedTipo = metodos[0]?.tipo;

      function recalcCambio() {
        const r = U.num(recInp.value);
        const c = r - total;
        cambioEl.textContent = U.money(c);
        cambioEl.classList.remove("negative", "zero");
        if (c < 0) cambioEl.classList.add("negative");
        else if (c === 0) cambioEl.classList.add("zero");
      }
      recInp.addEventListener("input", recalcCambio);
      mdl.querySelectorAll("[data-cash]").forEach(b => b.addEventListener("click", () => {
        recInp.value = b.dataset.cash;
        recalcCambio();
        recInp.focus();
      }));
      mdl.querySelectorAll("#cobro-method button").forEach(b => b.addEventListener("click", () => {
        mdl.querySelectorAll("#cobro-method button").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        selectedMP = metodos.find(m => m.id === Number(b.dataset.mp));
        selectedTipo = b.dataset.tipo;
        efBlock.style.display = selectedTipo === "efectivo" ? "block" : "none";
      }));

      recInp.value = total;
      recalcCambio();
      setTimeout(() => { recInp.focus(); recInp.select(); }, 50);

      function close() { mdl.remove(); document.removeEventListener("keydown", onCobroKey); }
      function onCobroKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
      document.addEventListener("keydown", onCobroKey);
      mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) close(); });

      mdl.querySelector("#frm-cobro").addEventListener("submit", async e => {
        e.preventDefault();
        const recibido = U.num(recInp.value);
        if (selectedTipo === "efectivo" && recibido < total) {
          return U.toast("El monto recibido es menor al total", "danger");
        }
        for (const it of cart) {
          if (it.cantidad > DB.stockOf(it.producto_id)) {
            return U.toast(`Sin stock suficiente de ${it.nombre}`, "danger");
          }
        }
        const cajaId = U.num(mdl.querySelector("#cobro-caja").value);

        const observaciones = selectedTipo === "efectivo" ? `Recibido ${U.money(recibido)} · Cambio ${U.money(recibido - total)}` : "";

        // ===== MODO ONLINE: crear venta atómicamente en el servidor =====
        if (DB.isOnline()) {
          const btn = e.target.querySelector('button[type="submit"]');
          if (btn) { btn.disabled = true; btn.textContent = "Procesando…"; }
          try {
            const venta = await DB.remote("createSale", {
              cliente_id: clienteId, vendedor_id: vendedorId,
              metodo_pago_id: selectedMP.id, caja_id: cajaId,
              descuento: desc, observaciones, pagada: true,
              lineas: cart.map(it => ({
                producto_id: it.producto_id,
                cantidad: it.cantidad,
                precio_unitario: it.precio
              }))
            });
            // Insertar al cache local con los IDs reales del servidor
            DB.cacheInsert("ventas", venta);
            cart.forEach(it => {
              DB.cacheInsert("ventas_detalle", {
                venta_id: venta.id, producto_id: it.producto_id,
                cantidad: it.cantidad, precio_unitario: it.precio, descuento: 0,
                subtotal: it.precio * it.cantidad,
                costo_unitario: it.costo, utilidad: it.cantidad * (it.precio - it.costo)
              });
            });
            close();
            cart.length = 0;
            renderCart();
            showReceipt(venta.id, recibido, selectedTipo === "efectivo");
            U.toast(`Venta ${venta.numero} · ${U.money(total)}`, "success");
            // Sincronizar abajo en background para tener detalles/movs con IDs del server
            setTimeout(() => { DB.syncDownAll().catch(() => {}); }, 500);
          } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = "Confirmar"; }
            U.toast("Error al registrar venta: " + (err.message || "intenta de nuevo"), "danger");
          }
          return;
        }

        // ===== MODO DEMO/OFFLINE: fallback local =====
        const venta = DB.insert("ventas", {
          numero: "V-" + Date.now().toString(36).toUpperCase(),
          cliente_id: clienteId, vendedor_id: vendedorId,
          fecha: U.nowISO(),
          metodo_pago_id: selectedMP.id, caja_id: cajaId,
          subtotal: sub, descuento: desc, total,
          costo_total: cart.reduce((a, b) => a + b.costo * b.cantidad, 0),
          utilidad: total - cart.reduce((a, b) => a + b.costo * b.cantidad, 0),
          estado: "pagada",
          observaciones
        });
        cart.forEach(it => {
          DB.insert("ventas_detalle", {
            venta_id: venta.id, producto_id: it.producto_id,
            cantidad: it.cantidad, precio_unitario: it.precio, descuento: 0,
            subtotal: it.precio * it.cantidad,
            costo_unitario: it.costo, utilidad: it.cantidad * (it.precio - it.costo)
          });
          DB.pushInvMovement({
            producto_id: it.producto_id, tipo: "salida",
            cantidad: it.cantidad, costo_unitario: it.costo,
            referencia_tipo: "venta", referencia_id: venta.id,
            motivo: "POS " + venta.numero
          });
        });
        DB.pushCajaMov({
          caja_id: cajaId, fecha: venta.fecha,
          tipo: "ingreso", concepto: "Venta POS " + venta.numero,
          referencia_tipo: "venta", referencia_id: venta.id,
          metodo_pago_id: selectedMP.id, monto: total
        });

        close();
        cart.length = 0;
        renderCart();
        showReceipt(venta.id, recibido, selectedTipo === "efectivo");
        U.toast(`Venta ${venta.numero} · ${U.money(total)}`, "success");
      });
    }
  }

  function showReceipt(ventaId, recibido, esEfectivo) {
    const v = DB.get("ventas", ventaId);
    const det = DB.list("ventas_detalle", { venta_id: ventaId });
    const cliente = DB.get("clientes", v.cliente_id);
    const empresa = DB.list("config").find(c => c.clave === "empresa_nombre")?.valor || "KAM Papelería";
    const cambio = (recibido || 0) - v.total;

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="mdl-rec">
        <div class="modal" style="max-width:380px">
          <div style="text-align:center;padding-bottom:8px">
            <img src="assets/logo.svg" style="width:140px;margin:0 auto;display:block"><br>
            <div style="font-size:11px;color:var(--text-muted);letter-spacing:.05em;text-transform:uppercase;margin-top:-8px">Recibo de venta</div>
            <hr style="margin:14px 0;border:none;border-top:1px dashed var(--border)">
            <div style="font-weight:700">${U.escape(v.numero)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${U.fmtDate(v.fecha)}</div>
            <div style="font-size:12px;color:var(--text-muted)">Cliente: ${U.escape(cliente?.nombre || "Mostrador")}</div>
          </div>
          <hr style="margin:12px 0;border:none;border-top:1px dashed var(--border)">
          <table style="width:100%;font-size:12px">
            ${det.map(d => {
              const p = DB.get("productos", d.producto_id);
              return `<tr>
                <td>${d.cantidad}× ${U.escape(p?.nombre || "")}</td>
                <td style="text-align:right">${U.money(d.subtotal)}</td>
              </tr>`;
            }).join("")}
          </table>
          <hr style="margin:12px 0;border:none;border-top:1px dashed var(--border)">
          <div style="font-size:13px">
            <div class="flex between"><span>Subtotal</span><span>${U.money(v.subtotal)}</span></div>
            ${v.descuento ? `<div class="flex between"><span>Descuento</span><span>-${U.money(v.descuento)}</span></div>` : ""}
            <div class="flex between" style="font-size:20px;font-weight:800;padding-top:8px;margin-top:4px;border-top:2px solid var(--text)"><span>TOTAL</span><span>${U.money(v.total)}</span></div>
            ${esEfectivo ? `
              <div class="flex between" style="margin-top:10px;font-size:12px;color:var(--text-muted)"><span>Recibido</span><span>${U.money(recibido)}</span></div>
              <div class="flex between" style="font-weight:700;color:var(--success);font-size:14px"><span>Cambio</span><span>${U.money(cambio)}</span></div>
            ` : ""}
          </div>
          <hr style="margin:14px 0 8px;border:none;border-top:1px dashed var(--border)">
          <div style="text-align:center;font-size:11px;color:var(--text-muted)">¡Gracias por tu compra!</div>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-close>Cerrar (Enter)</button>
            <button class="btn btn-primary" id="rec-print">🖨️ Imprimir</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    const mdl = div.querySelector("#mdl-rec");
    const close = () => { mdl.remove(); document.removeEventListener("keydown", onK); host.querySelector("#pos-search-inp")?.focus(); };
    function onK(e) { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); close(); } }
    document.addEventListener("keydown", onK);
    mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) close(); });
    mdl.querySelector("#rec-print").addEventListener("click", () => U.exportPDF(`Recibo ${v.numero}`, mdl.querySelector(".modal").innerHTML));
  }

  window.addEventListener("hashchange", () => { if (host._posCleanup) host._posCleanup(); }, { once: true });

  render();
}, { module: "ventas" });
