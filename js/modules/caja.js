// Módulo de caja: apertura, cierre, movimientos, saldos.
Router.register("/caja", async (host) => {
  document.getElementById("page-title").textContent = "Caja";

  const cajas = DB.list("cajas", { activo: true });
  let cajaId = cajas[0]?.id;

  function render() {
    if (!cajaId) {
      host.innerHTML = `<div class="page"><p>No hay cajas configuradas. Crea una en <a href="#/cajas">Cajas</a>.</p></div>`;
      return;
    }
    const caja = DB.get("cajas", cajaId);
    const sesion = DB.activeCajaSession(cajaId);
    const today = U.todayStr();
    const movs = DB.list("caja_movimientos", { caja_id: cajaId });
    const movsHoy = movs.filter(m => (m.fecha || "").slice(0,10) === today);

    const ingresosHoy = movsHoy.filter(m => m.tipo === "ingreso").reduce((a,b) => a + U.num(b.monto), 0);
    const egresosHoy = movsHoy.filter(m => m.tipo === "egreso").reduce((a,b) => a + U.num(b.monto), 0);
    const saldoActual = DB.cajaBalance(cajaId);

    host.innerHTML = `
      <div class="page">
        <div class="page-header">
          <h2>Caja — ${U.escape(caja.nombre)}</h2>
          <div class="actions">
            <select class="sel" id="caja-sel" style="min-width:160px">
              ${cajas.map(c => `<option value="${c.id}" ${c.id === cajaId ? "selected" : ""}>${U.escape(c.nombre)}</option>`).join("")}
            </select>
            ${!sesion ? `<button class="btn btn-primary" id="btn-open">Abrir caja</button>`
                       : `<button class="btn btn-warning" id="btn-close">Cerrar caja</button>`}
            <button class="btn" id="btn-adj">Ajuste</button>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi"><div class="label">Saldo actual</div><div class="value">${U.money(saldoActual)}</div></div>
          <div class="kpi success"><div class="label">Ingresos hoy</div><div class="value">${U.money(ingresosHoy)}</div></div>
          <div class="kpi danger"><div class="label">Egresos hoy</div><div class="value">${U.money(egresosHoy)}</div></div>
          <div class="kpi"><div class="label">Saldo inicial sesión</div><div class="value">${sesion ? U.money(sesion.saldo_inicial) : "—"}</div><div class="delta muted">${sesion ? "Abierta " + U.fmtDate(sesion.fecha_apertura) : "Sin sesión abierta"}</div></div>
        </div>

        <div class="filters">
          <label class="lbl">Desde<input type="date" class="inp" id="f-from" value="${today}"></label>
          <label class="lbl">Hasta<input type="date" class="inp" id="f-to" value="${today}"></label>
          <label class="lbl">Tipo
            <select class="sel" id="f-tipo">
              <option value="">Todos</option>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
              <option value="apertura">Apertura</option>
              <option value="cierre">Cierre</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </label>
        </div>
        <div id="mov-list"></div>

        <h3 style="margin-top:24px">Sesiones de caja</h3>
        <div id="ses-list"></div>
      </div>
    `;

    host.querySelector("#caja-sel").addEventListener("change", e => { cajaId = Number(e.target.value); render(); });
    host.querySelector("#btn-open")?.addEventListener("click", openCaja);
    host.querySelector("#btn-close")?.addEventListener("click", closeCaja);
    host.querySelector("#btn-adj").addEventListener("click", ajusteCaja);
    ["#f-from","#f-to","#f-tipo"].forEach(s => host.querySelector(s).addEventListener("input", refreshMovs));

    refreshMovs();
    refreshSesiones();
  }

  function refreshMovs() {
    const tipo = host.querySelector("#f-tipo").value;
    const from = host.querySelector("#f-from").value;
    const to = host.querySelector("#f-to").value;
    let movs = DB.list("caja_movimientos", { caja_id: cajaId });
    movs = movs.filter(m => {
      if (tipo && m.tipo !== tipo) return false;
      if (from && (m.fecha || "").slice(0,10) < from) return false;
      if (to && (m.fecha || "").slice(0,10) > to) return false;
      return true;
    });
    movs = [...movs].reverse();
    host.querySelector("#mov-list").innerHTML = U.table([
      { key: "id", label: "#" },
      { key: "fecha", label: "Fecha", render: r => U.fmtDate(r.fecha) },
      { key: "tipo", label: "Tipo", render: r => `<span class="pill">${U.escape(r.tipo)}</span>` },
      { key: "concepto", label: "Concepto" },
      { key: "metodo", label: "Método", render: r => U.escape(DB.get("metodos_pago", r.metodo_pago_id)?.nombre || "—") },
      { key: "monto", label: "Monto", render: r => {
        const sign = ["egreso"].includes(r.tipo) ? "-" : "";
        const color = sign === "-" ? "var(--danger)" : "var(--success)";
        return `<span style="color:${color}">${sign}${U.money(r.monto)}</span>`;
      } },
      { key: "usuario_id", label: "Usuario", render: r => U.escape(DB.get("usuarios", r.usuario_id)?.username || "—") }
    ], movs);
  }

  function refreshSesiones() {
    const ses = DB.list("caja_sesiones", { caja_id: cajaId });
    host.querySelector("#ses-list").innerHTML = U.table([
      { key: "id", label: "#" },
      { key: "apertura", label: "Apertura", render: r => U.fmtDate(r.fecha_apertura) },
      { key: "inicial", label: "Saldo inicial", render: r => U.money(r.saldo_inicial) },
      { key: "cierre", label: "Cierre", render: r => r.fecha_cierre ? U.fmtDate(r.fecha_cierre) : "—" },
      { key: "esperado", label: "Esperado", render: r => r.saldo_esperado != null ? U.money(r.saldo_esperado) : "—" },
      { key: "real", label: "Real", render: r => r.saldo_real != null ? U.money(r.saldo_real) : "—" },
      { key: "diff", label: "Diferencia", render: r => {
        if (r.diferencia == null) return "—";
        const c = U.num(r.diferencia) === 0 ? "var(--success)" : "var(--danger)";
        return `<span style="color:${c}">${U.money(r.diferencia)}</span>`;
      } },
      { key: "estado", label: "Estado", render: r => `<span class="tag tag-${r.estado}">${U.escape(r.estado)}</span>` }
    ], [...ses].reverse());
  }

  async function openCaja() {
    const inicial = await U.prompt("Apertura de caja", "Saldo inicial", "0");
    if (inicial == null) return;
    const monto = U.num(inicial);
    const ses = DB.insert("caja_sesiones", {
      caja_id: cajaId, usuario_id: Auth.currentUser().id,
      fecha_apertura: U.nowISO(), saldo_inicial: monto, estado: "abierta"
    });
    DB.pushCajaMov({
      caja_id: cajaId, fecha: U.nowISO(), tipo: "apertura",
      concepto: "Apertura caja sesión #" + ses.id,
      monto, referencia_tipo: "sesion", referencia_id: ses.id
    });
    U.toast("Caja abierta", "success");
    render();
  }

  async function closeCaja() {
    const sesion = DB.activeCajaSession(cajaId);
    if (!sesion) return U.toast("No hay sesión abierta", "warning");
    const saldoEsperado = DB.cajaBalance(cajaId);
    const real = await U.prompt("Cierre de caja", `Saldo esperado: ${U.money(saldoEsperado)}\nIngresa el saldo REAL contado`, String(saldoEsperado));
    if (real == null) return;
    const realN = U.num(real);
    const diff = realN - saldoEsperado;
    DB.update("caja_sesiones", sesion.id, {
      fecha_cierre: U.nowISO(),
      saldo_esperado: saldoEsperado,
      saldo_real: realN,
      diferencia: diff,
      estado: "cerrada"
    });
    DB.pushCajaMov({
      caja_id: cajaId, fecha: U.nowISO(), tipo: "cierre",
      concepto: `Cierre sesión #${sesion.id} — diferencia ${U.money(diff)}`,
      monto: 0, referencia_tipo: "sesion", referencia_id: sesion.id
    });
    if (Math.abs(diff) > 0.01) {
      DB.pushCajaMov({
        caja_id: cajaId, fecha: U.nowISO(), tipo: "ajuste",
        concepto: "Ajuste cierre sesión #" + sesion.id, monto: diff
      });
    }
    U.toast("Caja cerrada", "success");
    render();
  }

  async function ajusteCaja() {
    const monto = await U.prompt("Ajuste de caja", "Monto (positivo o negativo)", "0");
    if (monto == null) return;
    const concepto = await U.prompt("Ajuste de caja", "Concepto del ajuste", "Ajuste manual");
    if (!concepto) return;
    DB.pushCajaMov({
      caja_id: cajaId, fecha: U.nowISO(),
      tipo: "ajuste", concepto, monto: U.num(monto)
    });
    U.toast("Ajuste registrado", "success");
    render();
  }

  render();
}, { module: "caja" });
