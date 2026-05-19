// Punto de Venta (POS) — interfaz rápida para vender.
// Atajos:
//   F2  → enfocar buscador
//   F9  → limpiar carrito
//   F12 → cobrar (modal de pago con cálculo de cambio)
//   Esc → cerrar modales
//   ↑/↓ → navegar resultados de búsqueda
//   Enter → agregar producto al carrito
Router.register("/pos", async (host) => {
  document.getElementById("page-title").textContent = "Punto de venta";

  const cart = []; // [{ producto_id, nombre, sku, precio, costo, cantidad, stock }]
  let resultsFocus = 0;
  let lastResults = [];

  function render() {
    const productos = DB.list("productos", { activo: true });
    const clientes = DB.list("clientes", { activo: true });
    const metodos = DB.list("metodos_pago", { activo: true });
    const cajas = DB.list("cajas", { activo: true });

    host.innerHTML = `
      <div class="pos-wrap">
        <!-- IZQUIERDA: búsqueda y resultados -->
        <div class="pos-left">
          <div class="pos-search">
            <input id="pos-search-inp" placeholder="🔍 Buscar producto por nombre, SKU o código…  (F2 enfoca)" autocomplete="off">
          </div>
          <div class="pos-results" id="pos-results"></div>
        </div>

        <!-- DERECHA: carrito + totales -->
        <div class="pos-right">
          <div class="pos-cart-head">
            <div>
              <strong>Carrito</strong>
              <div class="muted" style="font-size:11px"><span id="pos-cart-count">0</span> producto(s)</div>
            </div>
            <button class="btn btn-sm btn-ghost" id="pos-clear" title="F9">Limpiar (F9)</button>
          </div>
          <div class="pos-cart" id="pos-cart"></div>
          <div class="pos-totals">
            <div class="line"><span>Subtotal</span><span id="pos-subtotal">${U.money(0)}</span></div>
            <div class="line"><span>Descuento</span><span><input id="pos-desc" type="number" min="0" value="0" style="width:90px;text-align:right;border:1px solid var(--border);border-radius:4px;padding:2px 6px"></span></div>
            <div class="line total"><span>TOTAL</span><span id="pos-total">${U.money(0)}</span></div>
          </div>
          <div class="pos-actions">
            <button class="btn-cobrar" id="pos-pay">COBRAR <kbd>F12</kbd></button>
            <div class="pos-quick-actions">
              <select class="sel" id="pos-cliente">
                <option value="">Cliente: Mostrador</option>
                ${clientes.map(c => `<option value="${c.id}">${U.escape(c.nombre)}</option>`).join("")}
              </select>
              <select class="sel" id="pos-vendedor">
                ${DB.list("usuarios", { activo: true }).map(u => `<option value="${u.id}" ${u.id === Auth.currentUser().id ? "selected" : ""}>👤 ${U.escape(u.username)}</option>`).join("")}
              </select>
            </div>
            <div class="muted" style="font-size:11px;text-align:center;padding:4px">
              <kbd class="hint">F2</kbd> buscar · <kbd class="hint">↑↓</kbd> navegar · <kbd class="hint">Enter</kbd> agregar · <kbd class="hint">F9</kbd> limpiar · <kbd class="hint">F12</kbd> cobrar
            </div>
          </div>
        </div>
      </div>
    `;

    const inp = host.querySelector("#pos-search-inp");
    const results = host.querySelector("#pos-results");

    function showResults(query = "") {
      const q = query.trim().toLowerCase();
      let rows = productos;
      if (q) {
        rows = productos.filter(p =>
          (p.nombre || "").toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q)
        );
      }
      rows = rows.slice(0, 50);
      lastResults = rows;
      resultsFocus = 0;
      if (!rows.length) {
        results.innerHTML = `<div class="pos-cart-empty">Sin resultados para "${U.escape(query)}"</div>`;
        return;
      }
      results.innerHTML = rows.map((p, i) => {
        const stock = DB.stockOf(p.id);
        return `
          <div class="pos-card ${stock <= 0 ? "no-stock" : ""} ${i === 0 ? "focused" : ""}" data-id="${p.id}" data-i="${i}">
            <div>
              <div class="sku">${U.escape(p.sku)} ${stock <= 0 ? "· SIN STOCK" : ""}</div>
              <div class="name">${U.escape(p.nombre)}</div>
            </div>
            <div style="text-align:right">
              <div class="price">${U.money(p.precio_venta)}</div>
              <div class="stock">Stock: ${stock}</div>
            </div>
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

    function addToCart(productoId, qty = 1) {
      const p = DB.get("productos", productoId);
      if (!p) return;
      const stock = DB.stockOf(productoId);
      if (stock <= 0) { U.toast("Sin stock disponible", "danger"); return; }
      const existing = cart.find(x => x.producto_id === productoId);
      if (existing) {
        if (existing.cantidad + qty > stock) { U.toast(`Stock máximo: ${stock}`, "warning"); return; }
        existing.cantidad += qty;
      } else {
        cart.push({
          producto_id: productoId,
          nombre: p.nombre, sku: p.sku,
          precio: U.num(p.precio_venta),
          costo: DB.avgCostOf(productoId),
          cantidad: qty,
          stock
        });
      }
      renderCart();
      // limpiar buscador y enfocar
      inp.value = "";
      showResults("");
      inp.focus();
    }

    function renderCart() {
      const cartEl = host.querySelector("#pos-cart");
      if (!cart.length) {
        cartEl.innerHTML = `<div class="pos-cart-empty">El carrito está vacío.<br><br><small>Busca un producto y presiona <kbd class="hint">Enter</kbd> para agregarlo.</small></div>`;
      } else {
        cartEl.innerHTML = cart.map((it, idx) => `
          <div class="pos-cart-item">
            <div>
              <div class="row1">
                <span class="name">${U.escape(it.nombre)}</span>
                <span><strong>${U.money(it.precio * it.cantidad)}</strong></span>
              </div>
              <div class="ctrl">
                <button data-act="dec" data-i="${idx}">−</button>
                <span class="qty">${it.cantidad}</span>
                <button data-act="inc" data-i="${idx}">+</button>
                <span class="sub" style="margin-left:8px">@ ${U.money(it.precio)}</span>
                <button data-act="del" data-i="${idx}" style="margin-left:auto;color:var(--danger);border-color:var(--danger)">✕</button>
              </div>
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
      }
      // totales
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
      U.toast("Carrito vaciado", "warning");
    }

    // Eventos buscador
    inp.addEventListener("input", e => showResults(e.target.value));
    inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); moveFocus(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveFocus(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const card = results.querySelector(".pos-card.focused");
        if (card) addToCart(Number(card.dataset.id));
      }
    });

    host.querySelector("#pos-desc").addEventListener("input", renderCart);
    host.querySelector("#pos-clear").addEventListener("click", clearCart);
    host.querySelector("#pos-pay").addEventListener("click", openCobro);

    // mostrar todos los productos al inicio
    showResults("");
    renderCart();
    inp.focus();

    // Atajos globales
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

      const div = document.createElement("div");
      div.innerHTML = `
        <div class="modal-backdrop" id="mdl-cobro">
          <form class="modal cobro-modal" id="frm-cobro">
            <h3>💰 Cobrar venta</h3>

            <div class="cobro-total">${U.money(total)}</div>

            <label class="lbl">Método de pago
              <select class="sel" name="metodo_pago_id" id="cobro-mp">
                ${metodos.map(m => `<option value="${m.id}">${U.escape(m.nombre)}</option>`).join("")}
              </select>
            </label>

            <div id="cobro-efectivo-block">
              <div class="cobro-quickcash" id="cobro-quick">
                ${[total, 10000, 20000, 50000, 100000, Math.ceil(total/10000)*10000, Math.ceil(total/50000)*50000].filter((v,i,a) => v >= total && a.indexOf(v) === i).slice(0,8).map(v => `<button type="button" data-cash="${v}">${U.money(v)}</button>`).join("")}
              </div>
              <div class="cobro-cash-row">
                <div class="cobro-cash recibido">
                  <div class="label">Billete recibido</div>
                  <input type="number" name="recibido" id="cobro-recibido" min="0" step="0.01" autofocus>
                </div>
                <div class="cobro-cash cambio">
                  <div class="label">Cambio</div>
                  <div class="value" id="cobro-cambio">${U.money(0)}</div>
                </div>
              </div>
            </div>

            <label class="lbl">Caja
              <select class="sel" name="caja_id">
                ${cajas.map(c => `<option value="${c.id}">${U.escape(c.nombre)}</option>`).join("")}
              </select>
            </label>

            <div class="muted" style="font-size:12px;text-align:center;margin-top:8px">
              <kbd class="hint">Enter</kbd> confirmar · <kbd class="hint">Esc</kbd> cancelar
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
              <button type="submit" class="btn btn-primary" style="background:var(--accent);color:#1a1a1a;font-weight:700">Confirmar venta</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(div);
      const mdl = div.querySelector("#mdl-cobro");
      const recInp = mdl.querySelector("#cobro-recibido");
      const cambioEl = mdl.querySelector("#cobro-cambio");
      const efBlock = mdl.querySelector("#cobro-efectivo-block");
      const mpSel = mdl.querySelector("#cobro-mp");

      function recalcCambio() {
        const r = U.num(recInp.value);
        const c = r - total;
        cambioEl.textContent = U.money(c);
        cambioEl.classList.toggle("negative", c < 0);
      }
      recInp.addEventListener("input", recalcCambio);

      // botones de billetes rápidos
      mdl.querySelectorAll("[data-cash]").forEach(b => b.addEventListener("click", () => {
        recInp.value = b.dataset.cash;
        recalcCambio();
        recInp.focus();
      }));

      // si el método de pago no es efectivo, ocultar el bloque de cambio
      mpSel.addEventListener("change", () => {
        const m = metodos.find(x => x.id === Number(mpSel.value));
        if (m && m.tipo !== "efectivo") {
          efBlock.style.display = "none";
          recInp.removeAttribute("required");
        } else {
          efBlock.style.display = "block";
        }
      });

      // valor inicial = exacto
      recInp.value = total;
      recalcCambio();
      setTimeout(() => { recInp.focus(); recInp.select(); }, 50);

      function close() { mdl.remove(); document.removeEventListener("keydown", onCobroKey); }

      function onCobroKey(e) {
        if (e.key === "Escape") { e.preventDefault(); close(); }
      }
      document.addEventListener("keydown", onCobroKey);

      mdl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === mdl) close(); });

      mdl.querySelector("#frm-cobro").addEventListener("submit", e => {
        e.preventDefault();
        const data = U.formData(e.target);
        const mp = metodos.find(x => x.id === Number(data.metodo_pago_id));
        const recibido = U.num(data.recibido);
        if (mp && mp.tipo === "efectivo" && recibido < total) {
          return U.toast("El billete recibido es menor al total", "danger");
        }
        // validar stock una vez más
        for (const it of cart) {
          if (it.cantidad > DB.stockOf(it.producto_id)) {
            return U.toast(`Sin stock suficiente de ${it.nombre}`, "danger");
          }
        }

        const venta = DB.insert("ventas", {
          numero: "V-" + Date.now().toString(36).toUpperCase(),
          cliente_id: clienteId,
          vendedor_id: vendedorId,
          fecha: U.nowISO(),
          metodo_pago_id: U.num(data.metodo_pago_id),
          caja_id: U.num(data.caja_id),
          subtotal: sub,
          descuento: desc,
          total,
          costo_total: cart.reduce((a, b) => a + b.costo * b.cantidad, 0),
          utilidad: total - cart.reduce((a, b) => a + b.costo * b.cantidad, 0),
          estado: "pagada",
          observaciones: mp?.tipo === "efectivo" ? `Recibido: ${U.money(recibido)} · Cambio: ${U.money(recibido - total)}` : ""
        });

        cart.forEach(it => {
          DB.insert("ventas_detalle", {
            venta_id: venta.id, producto_id: it.producto_id,
            cantidad: it.cantidad, precio_unitario: it.precio, descuento: 0,
            subtotal: it.precio * it.cantidad,
            costo_unitario: it.costo,
            utilidad: it.cantidad * (it.precio - it.costo)
          });
          DB.pushInvMovement({
            producto_id: it.producto_id, tipo: "salida",
            cantidad: it.cantidad, costo_unitario: it.costo,
            referencia_tipo: "venta", referencia_id: venta.id,
            motivo: "POS " + venta.numero
          });
        });

        DB.pushCajaMov({
          caja_id: U.num(data.caja_id), fecha: venta.fecha,
          tipo: "ingreso", concepto: "Venta POS " + venta.numero,
          referencia_tipo: "venta", referencia_id: venta.id,
          metodo_pago_id: U.num(data.metodo_pago_id), monto: total
        });

        close();
        cart.length = 0;
        renderCart();
        showReceipt(venta.id, recibido, mp?.tipo === "efectivo");
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
        <div class="modal" style="max-width:380px;font-family:monospace">
          <div style="text-align:center">
            <img src="assets/logo.svg" style="width:120px"><br>
            <div style="margin:4px 0"><strong>${U.escape(empresa)}</strong></div>
            <div style="font-size:12px;color:var(--text-muted)">Recibo de venta</div>
            <hr>
            <div><strong>${U.escape(v.numero)}</strong></div>
            <div style="font-size:12px">${U.fmtDate(v.fecha)}</div>
            <div style="font-size:12px">Cliente: ${U.escape(cliente?.nombre || "Mostrador")}</div>
            <hr>
          </div>
          <table style="width:100%;font-size:12px">
            ${det.map(d => {
              const p = DB.get("productos", d.producto_id);
              return `<tr>
                <td>${d.cantidad} × ${U.escape(p?.nombre || "")}</td>
                <td style="text-align:right">${U.money(d.subtotal)}</td>
              </tr>`;
            }).join("")}
          </table>
          <hr>
          <div style="font-size:13px">
            <div class="flex between"><span>Subtotal</span><span>${U.money(v.subtotal)}</span></div>
            ${v.descuento ? `<div class="flex between"><span>Descuento</span><span>-${U.money(v.descuento)}</span></div>` : ""}
            <div class="flex between" style="font-size:18px;font-weight:700;padding-top:4px"><span>TOTAL</span><span>${U.money(v.total)}</span></div>
            ${esEfectivo ? `
              <div class="flex between" style="margin-top:8px"><span>Recibido</span><span>${U.money(recibido)}</span></div>
              <div class="flex between" style="font-weight:700;color:var(--success)"><span>Cambio</span><span>${U.money(cambio)}</span></div>
            ` : ""}
          </div>
          <hr>
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

  // Limpiar handler global al salir de la ruta
  window.addEventListener("hashchange", () => { if (host._posCleanup) host._posCleanup(); }, { once: true });

  render();
}, { module: "ventas" });
