# Bot de Telegram — Guía completa

## Comandos soportados

| Comando | Acción |
|---------|--------|
| `/start` | Vincula tu Telegram al sistema. Muestra tu `telegram_id`. |
| `/ayuda` | Lista de comandos. |
| `/stock <producto>` | Stock actual del producto (búsqueda por nombre o SKU). |
| `/ventas` | Resumen de ventas del día. |
| `/compras` | Resumen de compras del día. |
| `/caja` | Saldo actual de caja. |
| `/bajostock` | Productos por debajo del mínimo. |
| `/utilidad [dia\|semana\|mes]` | Utilidad real del periodo. |
| `/ultimasventas` | Últimas 10 ventas. |
| `/ultimascompras` | Últimas 10 compras. |
| `/factura <id>` | Estado y datos de una factura subida al bot. |
| `/inventario` | Reporte rápido (total productos, stock, valorizado). |

Frases libres también funcionan:
- "¿Cuánto stock hay de camisetas negras?"
- "Subir factura"
- "Dame el saldo de caja"
- "Utilidad de este mes"

## Subir factura (flujo)

1. El usuario envía una **foto** (o un PDF) de la factura.
2. El bot responde:
   > Procesando factura…
3. Apps Script descarga la imagen y la guarda en Drive.
4. Se ejecuta OCR (Vision o Tesseract).
5. Se intenta extraer:
   - Proveedor (NIT/RUC o nombre).
   - Número de factura.
   - Fecha.
   - Productos (descripción, cantidad, costo unit).
   - Subtotal, IVA, total.
6. El bot responde con resumen + botones:
   - ✅ Confirmar
   - ✏️ Editar
   - ❌ Descartar
7. Al **confirmar**:
   - Si el proveedor no existe, lo crea (estado borrador, pide completar después).
   - Si algún producto no existe, el bot lo lista y pide al usuario que lo registre o lo asigne a uno existente.
   - Crea la compra en estado `pendiente` (queda lista para pagar) y aumenta inventario.
   - Guarda referencia `compra_id` en `facturas_telegram`.

## Reglas de seguridad

- Solo `telegram_id` que estén en `usuarios` (o en `telegram_usuarios_autorizados`) pueden interactuar.
- Si llega un mensaje de un id desconocido, el bot responde:
  > No estás autorizado. Pide a un administrador que vincule tu Telegram (ID: 123456789).
- Toda interacción se guarda en `telegram_logs`.
- Las acciones que crean datos (factura confirmada) registran al usuario en `auditoria` con `created_by` = usuario vinculado al Telegram.

## Alertas automáticas (push)

Apps Script tiene un trigger diario que envía a los admins:
- Productos con stock bajo.
- Caja sin cerrar del día anterior.
- Facturas pendientes de confirmar > 24 h.

## OCR — cómo se parsea una factura

`parseInvoiceText(rawText)` aplica reglas heurísticas:

1. **Fecha**: regex `\d{1,2}[-/]\d{1,2}[-/]\d{2,4}`.
2. **Nº factura**: tras la palabra "Factura", "No.", "Nº", "Invoice".
3. **NIT/RUC/Doc proveedor**: regex `(NIT|RUC|CC|RFC|Tax ID)[:\s]+([\d\.\-]+)`.
4. **Totales**:
   - `Subtotal`: regex `(?i)subtotal[:\s\$]+(\d[\d\.,]*)`.
   - `IVA`: regex `(?i)(iva|impuesto|tax)[:\s\$]+(\d[\d\.,]*)`.
   - `Total`: regex `(?i)total\s*a\s*pagar|^total[:\s\$]+(\d[\d\.,]*)`.
5. **Líneas**: filas con patrón `cantidad descripción precio` (heurística por columnas o por tabs).

Si los datos extraídos no son confiables (low confidence), el bot lo dice y pide edición.

## Comandos administrativos (sólo admin)

- `/autorizar <telegram_id>` — autoriza un Telegram aún no vinculado a usuario.
- `/desautorizar <telegram_id>` — quita acceso.
- `/usuarios` — lista usuarios con Telegram vinculado.

## Endpoints internos

Apps Script expone (todos vía POST con `?action=<x>`):

| Action | Descripción |
|--------|-------------|
| `login` | Autentica usuario+password. |
| `list` | Lista filas de cualquier tabla. |
| `get` | Lee fila por id. |
| `create` | Crea fila. |
| `update` | Actualiza fila. |
| `void` | Anula (no borra). |
| `createSale` | Lógica completa de venta. |
| `createPurchase` | Lógica completa de compra. |
| `createEgreso` | Comprobante de egreso. |
| `openCashbox` / `closeCashbox` | Apertura/cierre caja. |
| `kardex` | Movimientos por producto. |
| `report` | Reportes (ventas, compras, caja, inventario, utilidad). |
| `telegramWebhook` | Recibe los updates del bot. |

Headers requeridos en producción: `X-Token` con un token de sesión válido.
