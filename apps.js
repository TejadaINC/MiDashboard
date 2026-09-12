/* ============================================================
   Dashboard de actividades – lógica principal
   ============================================================ */

/* ---------- Estado ---------- */
let TAREAS = [];
let FUNCIONARIOS = [];
let FUNCIONARIO_ACTUAL = '';
let VISTA = 'semana';
let FECHA_REF = new Date();
let DIA_SELECCIONADO = new Date();

/* ---------- Constantes ---------- */
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_CORTO  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DIAS_LARGO  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const $ = (s, c = document) => c.querySelector(s);

/* ============================================================
   Utilidades
   ============================================================ */
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const mismoDia = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function lunesDe(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function fmtCorto(d) { return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`; }

function normalizarHora(v) {
  const m = String(v ?? '').trim().match(/^(\d{1,2}):?(\d{2})?/);
  if (!m) return '00:00';
  return String(m[1]).padStart(2, '0') + ':' + (m[2] || '00');
}

function horaNum(hhmm) {
  const m = String(hhmm).match(/^(\d{1,2})/);
  return m ? Number(m[1]) : null;
}

/* ---------- Parseo de fecha dd-mm-yyyy ---------- */
function parseFecha(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  y = Number(y); if (y < 100) y += 2000;
  const date = new Date(y, Number(mo) - 1, Number(d));
  date.setHours(0, 0, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

/* ---------- Parser CSV robusto ---------- */
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/* ---------- Normaliza encabezados (minúsculas, sin acentos) ---------- */
const normHeader = s => String(s).trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ============================================================
   Carga de datos
   ============================================================ */
function cargarTareas(textoCSV) {
  const rows = parseCSV(textoCSV);
  if (!rows.length) return { ok: false, motivo: 'El CSV está vacío.' };

  const headers = rows[0].map(normHeader);
  console.log('🧭 Encabezados detectados:', headers);

  const buscar = (aliases) => {
    for (const a of aliases) {
      const i = headers.indexOf(a);
      if (i >= 0) return i;
    }
    return -1;
  };

  const idx = {
    id:          buscar(['id']),
    funcionario: buscar(['funcionario']),
    tarea:       buscar(['tarea']),
    // 👇 Acepta descripcion, descripción, detalle, description
    descripcion: buscar(['descripcion','descripción','descripc','detalle','description']),
    fecha:       buscar(['fecha']),
    hora:        buscar(['hora'])
  };

  const requeridas = ['funcionario', 'tarea', 'fecha', 'hora'];
  const faltantes = requeridas.filter(k => idx[k] < 0);
  if (faltantes.length) {
    return {
      ok: false,
      motivo: `Faltan columnas obligatorias: ${faltantes.join(', ')}.`,
      headers
    };
  }

  TAREAS = rows.slice(1).map(r => {
    const fecha = parseFecha(r[idx.fecha]);
    if (!fecha) return null;
    return {
      id:          idx.id >= 0          ? String(r[idx.id] || '').trim()          : '',
      funcionario: String(r[idx.funcionario] || '').trim(),
      tarea:       String(r[idx.tarea] || '').trim(),
      descripcion: idx.descripcion >= 0 ? String(r[idx.descripcion] || '').trim() : '',
      fecha,
      hora: normalizarHora(r[idx.hora])
    };
  }).filter(Boolean);

  return { ok: true, total: TAREAS.length };
}

/* ============================================================
   Filtros / cálculos
   ============================================================ */
function tareasDe(dia) {
  return TAREAS
    .filter(t => (!FUNCIONARIO_ACTUAL || t.funcionario === FUNCIONARIO_ACTUAL) && mismoDia(t.fecha, dia))
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

function horasOcupadas(tareas) {
  const set = new Set();
  tareas.forEach(t => {
    const h = horaNum(t.hora);
    if (h === null) return;
    for (let i = 0; i < CONFIG.DURACION_TAREA_HORAS; i++) set.add(h + i);
  });
  return set.size;
}

const esDiaLleno = tareas => horasOcupadas(tareas) >= CONFIG.UMBRAL_DIA_LLENO;

/* ============================================================
   Etiquetas de período
   ============================================================ */
function etiquetaPeriodo() {
  if (VISTA === 'semana') {
    const l = lunesDe(FECHA_REF);
    const s = addDias(l, 5);
    if (l.getMonth() === s.getMonth())
      return `Semana del ${l.getDate()} al ${s.getDate()} de ${MESES_LARGO[l.getMonth()]} de ${s.getFullYear()}`;
    return `Semana del ${l.getDate()} ${MESES_CORTO[l.getMonth()]} al ${s.getDate()} ${MESES_CORTO[s.getMonth()]} de ${s.getFullYear()}`;
  }
  if (VISTA === 'dia') {
    const d = DIA_SELECCIONADO;
    return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`;
  }
  const m = MESES_LARGO[FECHA_REF.getMonth()];
  return `${m[0].toUpperCase() + m.slice(1)} ${FECHA_REF.getFullYear()}`;
}

/* ============================================================
   Render: agenda por horas (07:00–18:00)
   ============================================================ */
function htmlAgenda(dia) {
  const tareas = tareasDe(dia);
  const porHora = new Map();
  tareas.forEach(t => {
    const h = horaNum(t.hora);
    if (!porHora.has(h)) porHora.set(h, []);
    porHora.get(h).push(t);
  });

  let html = '';
  for (let h = CONFIG.HORA_INICIO; h <= CONFIG.HORA_FIN; h++) {
    const items = porHora.get(h) || [];
    html += `
      <div class="slot ${items.length ? 'ocupado' : ''}">
        <div class="slot-hora">${String(h).padStart(2, '0')}:00</div>
        <div class="slot-contenido">
          ${items.length
            ? items.map(t => `
                <div class="slot-tarea">
                  <strong>${escapeHtml(t.tarea || 'Sin título')}</strong>
                  ${t.descripcion ? `<span>${escapeHtml(t.descripcion)}</span>` : ''}
                </div>`).join('')
            : '<span class="slot-libre">Libre</span>'}
        </div>
      </div>`;
  }
  return html;
}

/* ============================================================
   Render: vista SEMANA
   ============================================================ */
function renderSemana() {
  const cont = $('#calendario');
  cont.className = 'calendario semana';
  cont.innerHTML = '';

  const lunes = lunesDe(FECHA_REF);

  for (let i = 0; i < 6; i++) {
    const dia = addDias(lunes, i);
    const tareas = tareasDe(dia);
    const lleno = esDiaLleno(tareas);

    const card = document.createElement('article');
    card.className = 'dia-card'
      + (lleno ? ' lleno' : '')
      + (mismoDia(dia, new Date()) ? ' hoy' : '');

    card.innerHTML = `
      <header class="dia-head">
        <span class="dia-nombre">${DIAS_CORTO[dia.getDay()]}</span>
        <span class="dia-fecha">${fmtCorto(dia)}</span>
      </header>
      ${lleno ? '<div class="badge-lleno">Sin disponibilidad</div>' : ''}
      <ul class="tareas-mini">
        ${tareas.length
          ? tareas.map(t => `
              <li>
                <span class="hora-mini">${t.hora}</span>
                <span class="tarea-mini">
                  <strong>${escapeHtml(t.tarea || '—')}</strong>
                  ${t.descripcion ? `<em>${escapeHtml(t.descripcion)}</em>` : ''}
                </span>
              </li>`).join('')
          : '<li class="vacio">Sin tareas</li>'}
      </ul>
      <footer class="dia-foot">${tareas.length} tarea${tareas.length === 1 ? '' : 's'} · ${horasOcupadas(tareas)} h</footer>
    `;

    card.addEventListener('click', () => {
      DIA_SELECCIONADO = dia;
      VISTA = 'dia';
      actualizarBotonesVista();
      render();
    });

    cont.appendChild(card);
  }
}

/* ============================================================
   Render: vista DÍA
   ============================================================ */
function renderDia() {
  const cont = $('#calendario');
  cont.className = 'calendario dia';

  const tareas = tareasDe(DIA_SELECCIONADO);
  const lleno = esDiaLleno(tareas);
  const d = DIA_SELECCIONADO;

  cont.innerHTML = `
    <article class="dia-card grande ${lleno ? 'lleno' : ''}">
      <header class="dia-head">
        <span class="dia-nombre">${DIAS_LARGO[d.getDay()]}</span>
        <span class="dia-fecha">${d.getDate()} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}</span>
      </header>
      ${lleno ? '<div class="badge-lleno">Sin disponibilidad</div>' : ''}
      <div class="agenda">${htmlAgenda(d)}</div>
    </article>
  `;
}

/* ============================================================
   Render: vista MES
   ============================================================ */
function renderMes() {
  const cont = $('#calendario');
  cont.className = 'calendario mes';
  cont.innerHTML = '';

  ['Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'mes-head';
    h.textContent = d;
    cont.appendChild(h);
  });

  const primerDia = new Date(FECHA_REF.getFullYear(), FECHA_REF.getMonth(), 1);
  const ultimoDia = new Date(FECHA_REF.getFullYear(), FECHA_REF.getMonth() + 1, 0);
  const inicio = lunesDe(primerDia);
  const offsetFin = (ultimoDia.getDay() + 6) % 7;
  const fin = addDias(ultimoDia, 5 - offsetFin);

  for (let d = new Date(inicio); d <= fin; d = addDias(d, 1)) {
    if (d.getDay() === 0) continue;

    const tareas = tareasDe(d);
    const lleno = esDiaLleno(tareas);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'mes-celda'
      + (d.getMonth() !== FECHA_REF.getMonth() ? ' fuera' : '')
      + (mismoDia(d, new Date()) ? ' hoy' : '')
      + (lleno ? ' lleno' : '');

    cell.innerHTML = `
      <span class="mes-num">${d.getDate()}</span>
      ${tareas.length ? `<span class="mes-info">${tareas.length} tarea${tareas.length === 1 ? '' : 's'}</span>` : ''}
      ${lleno ? '<span class="mes-full">Full</span>' : ''}
    `;

    cell.addEventListener('click', () => {
      DIA_SELECCIONADO = d;
      VISTA = 'dia';
      actualizarBotonesVista();
      render();
    });

    cont.appendChild(cell);
  }
}

/* ============================================================
   Render principal
   ============================================================ */
function render() {
  $('#titulo').textContent = `${CONFIG.TITULO_PREFIX} ${FUNCIONARIO_ACTUAL || ''}`.trim();
  $('#etiqueta-periodo').textContent = etiquetaPeriodo();

  if (VISTA === 'semana') renderSemana();
  else if (VISTA === 'dia') renderDia();
  else renderMes();

  $('#titulo-agenda').textContent = mismoDia(DIA_SELECCIONADO, new Date()) ? 'Agenda de hoy' : 'Agenda del día';
  $('#pill-fecha').textContent = fmtCorto(DIA_SELECCIONADO);
  $('#agenda').innerHTML = htmlAgenda(DIA_SELECCIONADO);

  $('#titulo-panel').textContent =
    VISTA === 'semana' ? 'Calendario semanal' :
    VISTA === 'dia'    ? 'Detalle del día'    : 'Vista mensual';

  const total = TAREAS.filter(t => !FUNCIONARIO_ACTUAL || t.funcionario === FUNCIONARIO_ACTUAL).length;
  $('#footer-info').textContent = `${total} actividades cargadas desde Google Sheets`;
}

/* ============================================================
   Selector de funcionario
   ============================================================ */
function construirSelectorFuncionario() {
  const wrap = $('#wrap-funcionario');
  const sel = $('#sel-funcionario');
  if (FUNCIONARIOS.length <= 1) { wrap.hidden = true; return; }

  wrap.hidden = false;
  sel.innerHTML = FUNCIONARIOS.map(f =>
    `<option value="${escapeHtml(f)}" ${f === FUNCIONARIO_ACTUAL ? 'selected' : ''}>${escapeHtml(f)}</option>`
  ).join('');

  sel.addEventListener('change', e => {
    FUNCIONARIO_ACTUAL = e.target.value;
    render();
  });
}

/* ============================================================
   UI: botones de navegación y vistas
   ============================================================ */
function actualizarBotonesVista() {
  document.querySelectorAll('.vistas button').forEach(b => {
    b.classList.toggle('activo', b.dataset.vista === VISTA);
  });
}

function bindUI() {
  document.querySelectorAll('.vistas button').forEach(btn => {
    btn.addEventListener('click', () => {
      VISTA = btn.dataset.vista;
      if (VISTA === 'dia') DIA_SELECCIONADO = new Date(FECHA_REF);
      actualizarBotonesVista();
      render();
    });
  });

  document.querySelectorAll('[data-accion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const accion = btn.dataset.accion;
      if (accion === 'hoy') {
        FECHA_REF = new Date();
        DIA_SELECCIONADO = new Date();
      } else {
        const delta = accion === 'next' ? 1 : -1;
        if (VISTA === 'semana') FECHA_REF = addDias(FECHA_REF, 7 * delta);
        else if (VISTA === 'dia') {
          DIA_SELECCIONADO = addDias(DIA_SELECCIONADO, delta);
          FECHA_REF = new Date(DIA_SELECCIONADO);
        } else {
          FECHA_REF = new Date(FECHA_REF.getFullYear(), FECHA_REF.getMonth() + delta, 1);
        }
      }
      render();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'ArrowLeft')  document.querySelector('[data-accion="prev"]').click();
    if (e.key === 'ArrowRight') document.querySelector('[data-accion="next"]').click();
    if (e.key.toLowerCase() === 'h') document.querySelector('[data-accion="hoy"]').click();
  });
}

/* ============================================================
   Carga con timeout y mensajes de error visibles
   ============================================================ */
async function fetchConTimeout(url, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal, cache: 'no-store' }); }
  finally { clearTimeout(id); }
}

function mostrarError(titulo, detalleHtml) {
  $('#estado').innerHTML = `
    <div>
      <p class="error">${escapeHtml(titulo)}</p>
      <div class="detalle">${detalleHtml}</div>
    </div>`;
}

/* ============================================================
   Bootstrap
   ============================================================ */
async function init() {
  // Permite pasar ?csv=... y ?funcionario=... por URL
  const params = new URLSearchParams(location.search);
  const urlCSV = params.get('csv') || CONFIG.CSV_URL;

  if (!urlCSV || urlCSV.includes('TU_ID_AQUI') || urlCSV.includes('TU_GID_DE_MASTER')) {
    mostrarError('Falta configurar la URL del CSV', `
      Abre <code>config.js</code> y pega en <code>CSV_URL</code> la URL publicada
      de tu hoja <strong>master</strong> (debe terminar en <code>&output=csv</code>).
    `);
    return;
  }

  try {
    const res = await fetchConTimeout(urlCSV, CONFIG.TIMEOUT_MS);
    if (!res.ok) throw new Error(`El servidor respondió HTTP ${res.status}`);
    const texto = await res.text();

    console.log('📄 Primeros 300 caracteres del CSV:\n', texto.slice(0, 300));

    if (texto.trim().startsWith('<')) {
      throw new Error('Se recibió HTML en lugar de CSV. Suele indicar que el gid no corresponde a la hoja "master" o que la publicación está desactivada.');
    }

    const resultado = cargarTareas(texto);
    if (!resultado.ok) {
      const heads = resultado.headers
        ? `<p>Encabezados detectados:</p><pre>${escapeHtml(resultado.headers.join(' | '))}</pre>`
        : '';
      mostrarError('No se pudo interpretar el CSV', `<p>${escapeHtml(resultado.motivo)}</p>${heads}`);
      return;
    }
    if (!resultado.total) {
      mostrarError('El CSV no tiene filas válidas', `
        Se leyó el encabezado pero no hay filas con fecha válida (dd-mm-aaaa).
      `);
      return;
    }

    FUNCIONARIOS = [...new Set(TAREAS.map(t => t.funcionario).filter(Boolean))].sort();
    FUNCIONARIO_ACTUAL = params.get('funcionario') || FUNCIONARIOS[0] || '';

    construirSelectorFuncionario();
    bindUI();
    render();

    $('#estado').hidden = true;
    $('#dashboard').hidden = false;

  } catch (err) {
    console.error(err);
    const esCORS = /Failed to fetch|NetworkError|load failed|abort/i.test(err.message);
    mostrarError('No se pudieron cargar los datos', `
      <p><strong>Error:</strong> ${escapeHtml(err.message)}</p>
      ${esCORS ? `
        <p>Causas típicas:</p>
        <ul>
          <li>El visor online bloquea peticiones externas (prueba en <em>StackBlitz</em> o <em>CodeSandbox</em>).</li>
          <li>La hoja no está realmente publicada en la web.</li>
          <li>La URL no termina en <code>&output=csv</code>.</li>
          <li>El <code>gid</code> no es el de la pestaña <strong>master</strong>.</li>
        </ul>` : ''}
      <p>Abre la consola del navegador (F12) para más detalles.</p>
    `);
  }
}

document.addEventListener('DOMContentLoaded', init);
