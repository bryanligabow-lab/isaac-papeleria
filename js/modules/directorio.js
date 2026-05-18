// CRUD genérico para entidades de directorio.
const Directorio = (() => {
  /** specs por módulo */
  const SPECS = {
    productos: {
      titulo: "Productos",
      table: "productos",
      cols: [
        { key: "sku", label: "SKU", input: { type: "text", required: true } },
        { key: "nombre", label: "Nombre", input: { type: "text", required: true } },
        { key: "categoria_id", label: "Categoría", input: { type: "select", source: "categorias", label: "nombre" } },
        { key: "unidad", label: "Unidad", input: { type: "text", default: "und" } },
        { key: "precio_venta", label: "Precio venta", input: { type: "number", required: true }, render: r => U.money(r.precio_venta) },
        { key: "costo_promedio", label: "Costo prom.", input: { type: "number" }, render: r => U.money(r.costo_promedio) },
        { key: "stock_minimo", label: "Stock mín.", input: { type: "number", default: 0 } },
        { key: "_stock", label: "Stock actual", render: r => DB.stockOf(r.id), readonly: true },
        { key: "activo", label: "Activo", input: { type: "checkbox", default: true }, render: r => r.activo ? "Sí" : "No" }
      ]
    },
    categorias: {
      titulo: "Categorías",
      table: "categorias",
      cols: [
        { key: "nombre", label: "Nombre", input: { type: "text", required: true } },
        { key: "descripcion", label: "Descripción", input: { type: "text" } },
        { key: "activo", label: "Activo", input: { type: "checkbox", default: true }, render: r => r.activo ? "Sí" : "No" }
      ]
    },
    clientes: {
      titulo: "Clientes",
      table: "clientes",
      cols: [
        { key: "tipo_doc", label: "Tipo doc.", input: { type: "select", options: ["CC","NIT","CE","RUC","Pasaporte","Otro"] } },
        { key: "num_doc", label: "Documento", input: { type: "text" } },
        { key: "nombre", label: "Nombre", input: { type: "text", required: true } },
        { key: "telefono", label: "Teléfono", input: { type: "text" } },
        { key: "email", label: "Email", input: { type: "email" } },
        { key: "direccion", label: "Dirección", input: { type: "text" } },
        { key: "activo", label: "Activo", input: { type: "checkbox", default: true }, render: r => r.activo ? "Sí" : "No" }
      ]
    },
    proveedores: {
      titulo: "Proveedores",
      table: "proveedores",
      cols: [
        { key: "tipo_doc", label: "Tipo doc.", input: { type: "select", options: ["NIT","RUC","CC","CE","Otro"] } },
        { key: "num_doc", label: "Documento", input: { type: "text" } },
        { key: "nombre", label: "Razón social", input: { type: "text", required: true } },
        { key: "telefono", label: "Teléfono", input: { type: "text" } },
        { key: "email", label: "Email", input: { type: "email" } },
        { key: "direccion", label: "Dirección", input: { type: "text" } },
        { key: "activo", label: "Activo", input: { type: "checkbox", default: true }, render: r => r.activo ? "Sí" : "No" }
      ]
    },
    metodos_pago: {
      titulo: "Métodos de pago",
      table: "metodos_pago",
      cols: [
        { key: "nombre", label: "Nombre", input: { type: "text", required: true } },
        { key: "tipo", label: "Tipo", input: { type: "select", options: ["efectivo","transferencia","tarjeta","credito","otro"] } },
        { key: "activo", label: "Activo", input: { type: "checkbox", default: true }, render: r => r.activo ? "Sí" : "No" }
      ]
    },
    cajas: {
      titulo: "Cajas",
      table: "cajas",
      cols: [
        { key: "nombre", label: "Nombre", input: { type: "text", required: true } },
        { key: "activo", label: "Activo", input: { type: "checkbox", default: true }, render: r => r.activo ? "Sí" : "No" }
      ]
    }
  };

  function renderInput(col, value) {
    const def = col.input || {};
    if (def.type === "select") {
      let opts;
      if (def.source) {
        opts = DB.list(def.source).map(o => ({ v: o.id, l: o[def.label || "nombre"] }));
      } else {
        opts = (def.options || []).map(o => ({ v: o, l: o }));
      }
      return `<select class="sel" name="${col.key}" ${def.required ? "required" : ""}>
        <option value="">—</option>
        ${opts.map(o => `<option value="${U.escape(o.v)}" ${String(o.v) === String(value ?? "") ? "selected" : ""}>${U.escape(o.l)}</option>`).join("")}
      </select>`;
    }
    if (def.type === "checkbox") {
      const checked = value === undefined ? def.default : value;
      return `<input type="checkbox" name="${col.key}" ${checked ? "checked" : ""}>`;
    }
    return `<input class="inp" name="${col.key}" type="${def.type || "text"}"
      value="${U.escape(value ?? def.default ?? "")}" ${def.required ? "required" : ""}>`;
  }

  function form(spec, item = {}) {
    const body = spec.cols
      .filter(c => c.input)
      .map(c => `<label class="lbl">${U.escape(c.label)}${renderInput(c, item[c.key])}</label>`)
      .join("");
    return `
      <div class="modal-backdrop" id="dir-modal">
        <form class="modal lg" id="dir-form">
          <h3>${item.id ? "Editar" : "Nuevo"} — ${U.escape(spec.titulo)}</h3>
          <div class="grid grid-2">${body}</div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    `;
  }

  async function open(spec, item) {
    const div = document.createElement("div");
    div.innerHTML = form(spec, item);
    document.body.appendChild(div);
    const modal = div.querySelector("#dir-modal");
    modal.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target === modal) modal.remove(); });
    modal.querySelector("#dir-form").addEventListener("submit", async e => {
      e.preventDefault();
      const data = U.formData(e.target);
      // checkbox => boolean
      spec.cols.forEach(c => {
        if (c.input?.type === "checkbox") data[c.key] = e.target.querySelector(`[name="${c.key}"]`).checked;
        if (c.input?.type === "number") data[c.key] = U.num(data[c.key]);
      });
      try {
        if (item.id) {
          DB.update(spec.table, item.id, data);
          U.toast("Actualizado", "success");
        } else {
          data.created_by = Auth.currentUser()?.id;
          DB.insert(spec.table, data);
          U.toast("Creado", "success");
        }
        modal.remove();
        Router.render();
      } catch (err) { U.toast(err.message, "danger"); }
    });
  }

  function render(host, modName) {
    const spec = SPECS[modName];
    document.getElementById("page-title").textContent = spec.titulo;

    const search = "";
    const visibleCols = spec.cols.filter(c => c.key !== "activo" || true);

    function refresh(filters = {}) {
      let rows = DB.list(spec.table);
      rows = U.applyFilters(rows, filters);
      const html = U.table([
        { key: "id", label: "#" },
        ...visibleCols.map(c => ({ key: c.key, label: c.label, render: c.render })),
        { key: "_act", label: "", render: r => `
          <div class="flex" style="gap:4px">
            ${Auth.can(modName, "editar") ? `<button class="btn btn-sm" data-edit="${r.id}">Editar</button>` : ""}
            ${Auth.can(modName, "anular") ? `<button class="btn btn-sm btn-danger" data-del="${r.id}">Eliminar</button>` : ""}
          </div>
        ` }
      ], rows);
      host.querySelector("#dir-list").innerHTML = html;
      host.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => open(spec, DB.get(spec.table, Number(b.dataset.edit)))));
      host.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
        if (await U.confirm("Eliminar", `¿Eliminar este registro?`)) {
          // soft delete -> activo=false
          DB.update(spec.table, Number(b.dataset.del), { activo: false });
          U.toast("Eliminado", "warning");
          refresh(currentFilters());
        }
      }));
    }

    function currentFilters() {
      return { _search: host.querySelector("#flt-search")?.value || "" };
    }

    host.innerHTML = `
      <div class="page">
        <div class="page-header">
          <h2>${U.escape(spec.titulo)}</h2>
          <div class="actions">
            ${Auth.can(modName, "crear") ? `<button class="btn btn-primary" id="btn-new">+ Nuevo</button>` : ""}
            <button class="btn" id="btn-export">⬇ Excel</button>
          </div>
        </div>
        <div class="filters">
          <label class="lbl">Buscar<input class="inp" id="flt-search" placeholder="Texto..."></label>
        </div>
        <div id="dir-list"></div>
      </div>
    `;

    host.querySelector("#btn-new")?.addEventListener("click", () => open(spec, {}));
    host.querySelector("#flt-search").addEventListener("input", () => refresh(currentFilters()));
    host.querySelector("#btn-export").addEventListener("click", () => {
      const rows = U.applyFilters(DB.list(spec.table), currentFilters());
      U.exportCSV(`${spec.table}.csv`, rows, [
        { key: "id", label: "ID" },
        ...spec.cols.map(c => ({ key: c.key, label: c.label, export: r => r[c.key] }))
      ]);
    });

    refresh();
  }

  // Registrar rutas
  Object.keys(SPECS).forEach(mod => {
    Router.register("/" + mod, (host) => render(host, mod), { module: mod });
  });

  return { SPECS, render };
})();
