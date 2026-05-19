// Configuración del frontend.
// Si apiUrl está vacío, la app funciona 100% en localStorage (modo demo).
// Cuando despliegues Google Apps Script, pega aquí la URL /exec.
window.APP_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbwWKG9OxjLHtSmiaybU0Ne-MRvys2ZGmfxs5-kzcHA2ADShGU7glkJG861Hy5NZCiw/exec",
  mode: "production", // "demo" | "production"
  appName: "KAM Papelería",
  currency: "$",
  currencyCode: "USD",
  locale: "es-EC",
  country: "Ecuador",
  ivaDefault: 0.15,
  storageKey: "isaac_papeleria_db_v1",
  sessionKey: "isaac_papeleria_session_v1"
};
