# Backend — Google Apps Script

Único archivo: [`apps-script.gs`](apps-script.gs).

## Qué hace
- API REST sobre Google Sheets (`doGet` / `doPost`).
- Webhook del bot de Telegram (`/start`, `/stock`, `/ventas`, `/utilidad`, etc).
- OCR de facturas (Google Vision o Google Drive nativo).
- Lógica de negocio: ventas, compras, caja, inventario, kardex, costo promedio.

## Pasos rápidos
1. Crea un Google Spreadsheet llamado `IsaacPapeleriaDB`.
2. Extensiones → Apps Script → pega `apps-script.gs`.
3. ⚙ Propiedades del script: añade `SPREADSHEET_ID`, `TELEGRAM_TOKEN`, opcional `DRIVE_FOLDER_ID`, `OCR_PROVIDER`, `VISION_API_KEY`.
4. Habilita el servicio avanzado **Drive API v2** (Servicios → +). Necesario para `Drive.Files.copy(...)` del OCR vía Drive.
5. Menú **Ejecutar → función `initDatabase`** (acepta permisos). Crea pestañas y siembra admin.
6. **Desplegar → Aplicación web → ejecutar como yo / acceso a cualquiera** → copia la URL `/exec`.
7. En el navegador: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL_EXEC>` para enlazar Telegram.
8. Pega la URL `/exec` en `js/config.js` del frontend.

## Variables sensibles
Nunca subas el `TELEGRAM_TOKEN` ni la `VISION_API_KEY` al repo público. Se guardan en *Propiedades del script*.

## Endpoints (POST)
| action | descripción |
|---|---|
| `login` | Autentica usuario/contraseña |
| `list` / `get` / `create` / `update` / `void` | CRUD genérico por tabla |
| `createSale` | Venta completa (descuenta inventario + caja) |
| `createPurchase` | Compra completa (entra inventario + egreso caja) |
| `createEgreso` | Comprobante de egreso |
| `openCashbox` / `closeCashbox` | Apertura/cierre caja |
| `kardex` | Kardex de un producto |
| `report` | Datos para reportes |
| `telegramWebhook` | Recibe updates del bot |

## Trigger diario (opcional)
En Apps Script → Activadores → añade el trigger `dailyAlerts` (diariamente, 8:00 AM) para que envíe el resumen a los admins por Telegram.
