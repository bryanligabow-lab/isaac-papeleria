# Isaac Papelería — Sistema Administrativo

Sistema web completo para administrar una papelería: usuarios y permisos, directorio, compras, ventas, caja, comprobantes de egreso, inventario (Kardex + costo promedio), costos y utilidades, reportes (Excel/PDF) y **bot de Telegram con OCR de facturas**.

## Stack

- **Frontend**: HTML + CSS + JavaScript vanilla (SPA)
- **Base de datos**: Google Sheets (vía Google Apps Script) + cache local (localStorage)
- **Backend / API**: Google Apps Script (gratis, serverless)
- **Bot de Telegram**: Webhook a Apps Script + OCR con Google Vision API o Tesseract
- **Hosting**: GitHub Pages (estático)

## Demo

Una vez activado GitHub Pages estará disponible en:
`https://<tu-usuario>.github.io/isaac-papeleria/`

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Arquitectura general y flujos
- [`docs/DATABASE.md`](docs/DATABASE.md) — Estructura de Google Sheets (tablas y relaciones)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Despliegue paso a paso
- [`docs/TELEGRAM_BOT.md`](docs/TELEGRAM_BOT.md) — Configuración del bot de Telegram + OCR

## Módulos

1. Usuarios y permisos (roles, autenticación, control por módulo)
2. Directorio: clientes, proveedores, productos, categorías, métodos de pago, cajas
3. Compras (aumenta inventario, guarda histórico de costos)
4. Ventas (descuenta inventario, registra ingreso en caja, calcula utilidad real)
5. Caja (apertura/cierre, ingresos, egresos, saldo esperado vs real)
6. Comprobantes de egreso / pagos
7. Inventario: stock, Kardex, costo promedio ponderado, ajustes con motivo
8. Costos y utilidades (margen %, productos más rentables, baja utilidad)
9. Reportes (ventas, compras, caja, inventario, utilidad) + exportar Excel/PDF
10. Bot de Telegram: subir facturas (foto/texto) → OCR → confirmar → registrar compra

## Reglas de negocio

- Toda compra aumenta inventario.
- Toda venta descuenta inventario y genera ingreso en caja.
- Todo comprobante de egreso descuenta caja.
- No se permite vender sin stock suficiente.
- Cada acción guarda usuario, fecha y hora.
- Los registros no se eliminan: se anulan (con motivo + usuario).
- El bot exige confirmación antes de registrar compras/ventas/egresos.

## Inicio rápido (local)

Abre `index.html` directamente en el navegador. Sin Google Sheets configurado funcionará 100% en localStorage (modo demo).

Para conectar Google Sheets + Telegram, sigue [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Usuario demo

- Usuario: `admin`
- Contraseña: `admin123`

⚠️ Cambia la contraseña tras el primer login.
