// Configuración del frontend.
// Si apiUrl está vacío, la app funciona 100% en localStorage (modo demo).
// Cuando despliegues Google Apps Script, pega aquí la URL /exec.
window.APP_CONFIG = {
  apiUrl: "", // ej: "https://script.google.com/macros/s/AKfyc.../exec"
  mode: "demo", // "demo" | "production"
  appName: "Isaac Papelería",
  currency: "$",
  ivaDefault: 0.19,
  storageKey: "isaac_papeleria_db_v1",
  sessionKey: "isaac_papeleria_session_v1"
};
