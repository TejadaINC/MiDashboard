/* ============================================================
   Configuración del Dashboard
   ============================================================ */
const CONFIG = {
  // ⬇️ PEGA AQUÍ TU URL PUBLICADA DE GOOGLE SHEETS ⬇️
  // Archivo → Compartir → Publicar en la web → pestaña "master" → CSV
  // Debe terminar en &output=csv
  CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR97GQAnT1XyTGfhB2gFpjCZRIQNjXmlpPui9JkjBH7VuVMaKIp-GHKM1gDu3snMJ_ybFnkLc5MBxl8/pubhtml?gid=0&single=true&output=csv',

  // Título del dashboard: "Dashboard de {funcionario}"
  TITULO_PREFIX: 'Dashboard de',

  // Rango horario visible (formato militar)
  HORA_INICIO: 7,
  HORA_FIN: 18,

  // Duración asumida de cada tarea (en horas) para calcular ocupación
  DURACION_TAREA_HORAS: 1,

  // Un día se marca como "LLENO" (rojo) si tiene >= N horas ocupadas
  // Rango disponible = HORA_FIN - HORA_INICIO + 1 = 12 slots (7..18)
  UMBRAL_DIA_LLENO: 8,

  // Días laborables (0=Dom, 1=Lun ... 6=Sáb)
  DIAS_LABORABLES: [1, 2, 3, 4, 5, 6],

  // Timeout para la petición del CSV (ms)
  TIMEOUT_MS: 10000
};
