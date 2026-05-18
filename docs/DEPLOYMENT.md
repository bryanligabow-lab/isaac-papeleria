# Despliegue paso a paso

## A. Modo demo (sin backend)

1. Abre `index.html` en tu navegador (o publica el repo en GitHub Pages).
2. Inicia sesión con `admin / admin123`.
3. Los datos se guardan en localStorage del navegador.

Esto sirve para evaluar la UI y todo el flujo (compras, ventas, caja, inventario, reportes).
No tendrás bot de Telegram en este modo.

---

## B. Modo producción (Google Sheets + Apps Script + Telegram)

### 1. Crear la hoja de cálculo

1. Ve a https://sheets.google.com y crea un Spreadsheet nuevo llamado **`IsaacPapeleriaDB`**.
2. Copia el ID del spreadsheet (parte central de la URL: `/spreadsheets/d/<ID>/edit`).

### 2. Crear el proyecto de Apps Script

1. En la hoja, menú **Extensiones → Apps Script**.
2. Borra el contenido y pega el contenido de `backend/apps-script.gs`.
3. En **Configuración del proyecto (⚙)** → **Propiedades del script**, añade:
   - `SPREADSHEET_ID` = el ID copiado.
   - `TELEGRAM_TOKEN` = `8980738836:AAGQfL9n7jzPDWJtALIpD4XCq0vrpzbxcp4`
   - `OCR_PROVIDER` = `vision` (si activas Cloud Vision) o `tesseract` (cliente).
   - `DRIVE_FOLDER_ID` = id de una carpeta de Drive para guardar facturas (opcional).
4. **Ejecutar → función `initDatabase`** una sola vez. Acepta los permisos. Esto crea todas las pestañas con sus encabezados y siembra el usuario admin (`admin / admin123`).
5. **Desplegar → Nueva implementación → tipo "Aplicación web"**:
   - Ejecutar como: *Yo*.
   - Quién tiene acceso: *Cualquier persona*.
   - Copia la URL que termina en `/exec`.

### 3. Conectar el frontend

1. Edita `js/config.js`:
   ```js
   window.APP_CONFIG = {
     apiUrl: "https://script.google.com/macros/s/AKfyc.../exec",
     mode: "production"
   };
   ```
2. Confirma haciendo login en el sitio.

### 4. Configurar el bot de Telegram

1. (Ya tienes el bot creado con token `8980738836:AAGQfL9n7jzPDWJtALIpD4XCq0vrpzbxcp4`).
2. Define el webhook (una sola vez, desde tu navegador):
   ```
   https://api.telegram.org/bot8980738836:AAGQfL9n7jzPDWJtALIpD4XCq0vrpzbxcp4/setWebhook?url=<TU_URL_APPS_SCRIPT_EXEC>
   ```
3. Comprueba estado:
   ```
   https://api.telegram.org/bot8980738836:AAGQfL9n7jzPDWJtALIpD4XCq0vrpzbxcp4/getWebhookInfo
   ```
4. Habilita tu Telegram en el sistema: módulo **Usuarios** → editar tu usuario → poner tu `telegram_id` (o escríbele `/start` al bot, te dirá tu id).
5. Envía `/start` al bot.

### 5. OCR (opcional pero recomendado)

Dos opciones:

- **Google Cloud Vision** (mejor calidad). Habilita la API en Google Cloud, crea una clave de servicio y guárdala en propiedades de script como `VISION_API_KEY`.
- **Tesseract.js** en cliente (gratis, sin API). Se usa cuando el usuario sube facturas desde la web.

### 6. Publicar el frontend en GitHub Pages

1. Crea un repositorio en GitHub: `isaac-papeleria`.
2. Desde tu máquina:
   ```bash
   git init
   git add .
   git commit -m "feat: sistema administrativo + bot telegram"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/isaac-papeleria.git
   git push -u origin main
   ```
3. En GitHub → **Settings → Pages → Source: deploy from a branch → main / root**. Guarda.
4. Espera 1-2 min. Tu URL será `https://<tu-usuario>.github.io/isaac-papeleria/`.

### 7. Smoke test

- Login admin → cambia contraseña.
- Crea una categoría, un producto, un proveedor, un cliente.
- Registra una compra → verifica que aumente el stock.
- Registra una venta → verifica que descuente stock e impacte caja.
- Envía una foto de factura al bot → confirma → revisa que se cree la compra.
- Ve a Reportes → exporta a Excel y PDF.

---

## Variables sensibles

- **Nunca** subas `TELEGRAM_TOKEN` ni `VISION_API_KEY` al repo público.
- Ambas se guardan como Propiedades de Script en Google Apps Script.
- `apps-script.gs` ya las lee con `PropertiesService.getScriptProperties()`.
