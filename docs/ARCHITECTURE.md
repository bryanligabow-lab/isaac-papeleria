# Arquitectura del sistema

```
┌──────────────────────┐         ┌───────────────────────────┐
│  Navegador (SPA)     │  HTTPS  │  Google Apps Script (API) │
│  HTML/CSS/JS         ├────────►│  doGet / doPost           │
│  GitHub Pages        │◄────────┤  Sheets como DB           │
└──────────────────────┘         │  Lógica de negocio        │
                                 │  Webhook Telegram         │
                                 │  OCR (Vision/Tesseract)   │
                                 └──────────┬────────────────┘
                                            │
                          ┌─────────────────┼─────────────────┐
                          ▼                 ▼                 ▼
                  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                  │ Google       │  │ Google Drive │  │ Telegram     │
                  │ Sheets (DB)  │  │ (imágenes)   │  │ Bot API      │
                  └──────────────┘  └──────────────┘  └──────────────┘
```

## Componentes

### 1. Frontend (GitHub Pages)
- SPA con router por hash (`#/ventas`, `#/compras`, ...).
- Capa `db.js` que abstrae el acceso a datos:
  - Modo demo: usa `localStorage`.
  - Modo producción: hace `fetch` al endpoint de Apps Script.
- Validaciones, filtros, exportación a Excel/PDF en cliente.

### 2. Backend (Apps Script)
- Un único archivo `apps-script.gs` con:
  - `doGet(e)` / `doPost(e)` — API REST estilo CRUD.
  - Lógica de inventario (Kardex + costo promedio ponderado).
  - Lógica de caja, ventas, compras, utilidades.
  - Webhook `/telegram` para mensajes del bot.
  - Función OCR `parseInvoiceImage(fileId)`.

### 3. Google Sheets como base de datos
- Una hoja de cálculo con una pestaña por tabla.
- Cada fila = un registro.
- IDs autoincrementales gestionados por Apps Script (locks).
- Ver `DATABASE.md` para esquema completo.

### 4. Bot de Telegram
- Webhook apuntando al Apps Script.
- Usuarios autorizados (su `telegram_id` debe estar en tabla `usuarios`).
- Flujo factura:
  1. Usuario envía foto.
  2. Apps Script descarga la imagen, la guarda en Drive.
  3. OCR extrae proveedor, fecha, nº factura, líneas (producto, cantidad, costo), totales.
  4. Bot responde con el resumen y botones [Confirmar] [Editar] [Cancelar].
  5. Al confirmar → crea registro en `compras` + `compras_detalle` + actualiza inventario.

## Flujos clave

### Venta
```
Frontend → POST /api?action=createSale
  → Apps Script:
     1. Valida stock de cada producto
     2. Inserta venta y detalle
     3. Salida de inventario (costo = costo_promedio actual)
     4. Calcula utilidad real (precio_venta - costo_promedio)
     5. Ingreso en caja del método de pago
     6. Devuelve venta + utilidad
```

### Compra
```
Frontend o Bot Telegram → POST /api?action=createPurchase
  → Apps Script:
     1. Inserta compra y detalle
     2. Entrada de inventario
     3. Actualiza costo_promedio_ponderado del producto
     4. (si pagada) egreso en caja
     5. Devuelve compra
```

### Inventario / Kardex
- Cada movimiento se persiste en `inventario_movimientos` con:
  `producto_id, tipo (entrada/salida/ajuste), cantidad, costo_unitario, costo_total, saldo_cantidad, saldo_valor, referencia, usuario, fecha`.
- El stock actual de un producto = saldo_cantidad de su último movimiento.
- Costo promedio ponderado se recalcula en cada entrada:
  `nuevo_costo = (saldo_valor_actual + valor_entrada) / (saldo_cantidad_actual + cantidad_entrada)`.

## Seguridad

- Login con usuario+password (hash SHA-256 con salt en Apps Script).
- Permisos por módulo (matriz `roles_permisos`).
- Cada request lleva un token de sesión (UUID guardado en `sesiones`).
- El bot valida que el `telegram_id` exista y esté activo.
- Anulaciones (no borrados) en compras/ventas/egresos.

## Modo demo (sin Apps Script)

Si `config.apiUrl` está vacío, la app trabaja contra `localStorage` con datos de ejemplo.
Útil para evaluar la interfaz antes de configurar Google Sheets.
