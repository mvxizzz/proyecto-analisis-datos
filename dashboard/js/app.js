// Dashboard CUP Chile (v0.3): pestañas Inicio, Análisis (modelo de estadía) y Descargas
// Los datos vienen de datos/datos.js (generado con preparar_datos.py): una posición por egreso en cada arreglo.

const E = DATOS.egresos;
const N = E.anio.length;
const ANIOS = [...new Set(E.anio)].sort();
const G_CUP = 0;          // C80.0
const G_C809 = 1;         // C80.9 (solo si el filtro de diagnóstico lo incluye)
const CODIGO_SITIO = ['C78.7', 'C78.6', 'C78.0', 'C79.5', 'C79.3', 'C77', 'C78.2', 'C79.7'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Zonas del país (códigos de región del DEIS, de norte a sur). Ñuble va al sur: hasta 2018 era parte del Biobío.
const ZONAS = {
  norte: { nombre: 'Norte', regiones: [15, 1, 2, 3, 4] },
  centro: { nombre: 'Centro', regiones: [5, 13, 6, 7] },
  sur: { nombre: 'Sur', regiones: [16, 8, 9, 14, 10, 11, 12] },
};
const ZONA_DE_REGION = {};
for (const [z, d] of Object.entries(ZONAS)) d.regiones.forEach(r => { ZONA_DE_REGION[r] = z; });
const regionEnZona = (region, zona) => !zona || ZONA_DE_REGION[region] === zona;

// Los colores se leen de las variables CSS (css/estilos.css), así cambian con el modo de alto contraste.
// gris = contexto (año anterior, referencias); cada grupo tiene su color (COLOR.grupos, en el orden de DATOS.grupos).
// RAMPA_MAPA: más oscuro = más egresos. DIVERGE: azul (negativo), gris (0), rojo (positivo) para las correlaciones.
let COLOR = {};
let RAMPA_MAPA = [];     // egresos: verde azulado (territorio)
let RAMPA_MUERTE = [];   // mortalidad en el mapa: naranjo (muerte)

function leerColores() {
  const css = getComputedStyle(document.documentElement);
  const v = nombre => css.getPropertyValue(nombre).trim();
  COLOR = {
    violeta: v('--violeta'), violetaClaro: v('--violeta-claro'), gris: v('--gris'), grilla: v('--grilla'),
    texto: v('--texto-2'), tinta: v('--tinta'), tarjeta: v('--tarjeta'), naranjo: v('--naranjo'), azul: v('--azul'),
    apagado: v('--apagado'), muerte: v('--s-muerte'), territorio: v('--s-territorio'), recursos: v('--s-recursos'),
    // CUP, CUP potencial (C80.9, mismo color que el CUP), Pulmón, Colorrectal, Mama, Próstata, Gástrico
    grupos: ['cup', 'cup', 'pulmon', 'colorrectal', 'mama', 'prostata', 'gastrico'].map(g => v(`--g-${g}`)),
    diverge: ['neg', 'medio', 'pos'].map(p => v(`--diverge-${p}`)),
  };
  RAMPA_MAPA = [1, 2, 3, 4].map(k => v(`--mapa-${k}`));
  RAMPA_MUERTE = [1, 2, 3, 4].map(k => v(`--muerte-${k}`));
  COLOR.zonas = ['norte', 'centro', 'sur'].map(z => v(`--z-${z}`));
  Chart.defaults.color = COLOR.texto;
  // Los cuadros emergentes de Chart.js son negros por defecto: en alto contraste (fondo negro) llevan borde blanco
  const alto = document.documentElement.dataset.contraste === 'alto';
  const tip = Chart.defaults.plugins.tooltip;
  tip.backgroundColor = alto ? '#000000' : 'rgba(0, 0, 0, 0.8)';
  tip.borderColor = alto ? '#ffffff' : 'rgba(0, 0, 0, 0)';
  tip.borderWidth = alto ? 1 : 0;
}

// Estado de los filtros
const estado = {
  anioDesde: ANIOS[ANIOS.length - 1],   // rango de años (ambos incluidos)
  anioHasta: ANIOS[ANIOS.length - 1],
  zona: '',           // '' = todas; 'norte', 'centro' o 'sur'
  region: 0,          // 0 = todas
  servicio: -1,        // -1 = todos
  hospital: -1,        // -1 = todos; índice en DATOS.hospitales
  sexo: -1,
  tramoDesde: 0,       // rango de tramos de edad (ambos incluidos); completo = sin filtro
  tramoHasta: DATOS.tramos.length - 1,
  diagnostico: 'c800', // 'c800' o 'c809' (C80.0 + C80.9)
  ingreso: -1,
  vista: 'cup',        // 'cup' o 'comparar'
  indicadorMapa: 'mortalidad', // pestaña Territorio: 'egresos', 'mortalidad', 'oncologia' o 'estancia'
  ordenTerritorio: 'geo',      // pestaña Territorio: 'geo' (de norte a sur) o 'valor' (de mayor a menor)
};

const graficos = {};   // objetos de Chart.js ya creados

// ---------------------------------------------------------------- utilidades
const fmtEntero = n => n.toLocaleString('es-CL');
const fmtDec = (x, d = 1) => x.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });

function mediana(valores) {
  if (valores.length === 0) return NaN;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Períodos: { desde, hasta }. El anterior es un bloque del mismo largo justo antes (2021–2022 → 2019–2020).
const periodoActual = () => ({ desde: estado.anioDesde, hasta: estado.anioHasta });

function periodoAnterior() {
  const largo = estado.anioHasta - estado.anioDesde + 1;
  const p = { desde: estado.anioDesde - largo, hasta: estado.anioHasta - largo };
  return ANIOS.includes(p.desde) ? p : null;
}

const textoPeriodo = (p = periodoActual()) => (p.desde === p.hasta ? String(p.desde) : `${p.desde}–${p.hasta}`);

// Límites de cada tramo para los selectores de edad: '40–49' → desde 40, hasta 49; '80+' → hasta "más"
const EDAD_DESDE = DATOS.tramos.map(t => t.match(/\d+/)[0]);
const EDAD_HASTA = DATOS.tramos.map(t => (t.includes('–') ? t.split('–')[1] : 'más'));
const edadCompleta = () => estado.tramoDesde === 0 && estado.tramoHasta === DATOS.tramos.length - 1;

function textoEdad() {
  const desde = EDAD_DESDE[estado.tramoDesde];
  if (estado.tramoHasta === DATOS.tramos.length - 1) return `${desde}+ años`;
  return `${desde}–${EDAD_HASTA[estado.tramoHasta]} años`;
}

function esCUP(i) {
  return E.grupo[i] === G_CUP || (estado.diagnostico === 'c809' && E.grupo[i] === G_C809);
}

// Filtros que no son ni año ni grupo (zona, región, servicio, sexo, edad, tipo de ingreso)
// Con un hospital elegido se filtra solo por él: zona, región y servicio ya quedan dados por el hospital.
// ignorarRegion (para el mapa y las zonas) deja fuera zona, región y servicio.
function pasaFiltros(i, ignorarRegion = false) {
  if (estado.hospital >= 0) {
    if (E.hospital[i] !== estado.hospital) return false;
  } else {
    if (!ignorarRegion && estado.zona && ZONA_DE_REGION[E.region[i]] !== estado.zona) return false;
    if (!ignorarRegion && estado.region && E.region[i] !== estado.region) return false;
    if (!ignorarRegion && estado.servicio >= 0 && E.servicio[i] !== estado.servicio) return false;
  }
  if (estado.sexo >= 0 && E.sexo[i] !== estado.sexo) return false;
  // con el rango completo se mantienen también los egresos sin edad registrada
  if (!edadCompleta() && (E.tramo[i] < estado.tramoDesde || E.tramo[i] > estado.tramoHasta)) return false;
  if (estado.ingreso >= 0 && E.ingreso[i] !== estado.ingreso) return false;
  return true;
}

// Devuelve los índices de los egresos que cumplen los filtros.
// grupo: 'cup', 'met' (los 5 metastásicos) o el número de un grupo.
function filtrarEgresos({ periodo = periodoActual(), grupo = 'cup', ignorarRegion = false } = {}) {
  const indices = [];
  for (let i = 0; i < N; i++) {
    if (E.anio[i] < periodo.desde || E.anio[i] > periodo.hasta) continue;
    if (grupo === 'cup' && !esCUP(i)) continue;
    if (grupo === 'met' && E.grupo[i] < 2) continue;
    if (typeof grupo === 'number' && E.grupo[i] !== grupo) continue;
    if (!pasaFiltros(i, ignorarRegion)) continue;
    indices.push(i);
  }
  return indices;
}

function calcularKPI(indices) {
  const n = indices.length;
  if (n === 0) return { egresos: 0, pacientes: 0, mortalidad: NaN, estada: NaN, peso: NaN, sev3: NaN, charlson2: NaN };
  let muertes = 0, peso = 0, sev3 = 0, charlson2 = 0;
  const pacientes = new Set();
  const estadas = [];
  for (const i of indices) {
    muertes += E.fallece[i];
    peso += E.peso[i];
    sev3 += E.sev3[i];
    if (E.charlson[i] >= 2) charlson2++;
    pacientes.add(E.paciente[i]);
    estadas.push(E.estada[i]);
  }
  return {
    egresos: n,
    pacientes: pacientes.size,
    mortalidad: muertes / n * 100,
    estada: mediana(estadas),
    peso: peso / n / 100,
    sev3: sev3 / n * 100,
    charlson2: charlson2 / n * 100,
  };
}

// ---------------------------------------------------------------- filtros
function llenarFiltros() {
  for (const [id, campo] of [['f-anio-desde', 'anioDesde'], ['f-anio-hasta', 'anioHasta']]) {
    const sel = document.getElementById(id);
    ANIOS.slice().reverse().forEach(a => sel.add(new Option(a, a)));
    sel.value = estado[campo];
  }

  llenarRegiones();

  const edadDesde = document.getElementById('f-edad-desde'), edadHasta = document.getElementById('f-edad-hasta');
  EDAD_DESDE.forEach((t, k) => edadDesde.add(new Option(t, k)));
  EDAD_HASTA.forEach((t, k) => edadHasta.add(new Option(t, k)));
  edadDesde.value = estado.tramoDesde;
  edadHasta.value = estado.tramoHasta;

  llenarServicios();
}

// Regiones de la zona elegida (todas si no hay zona)
function llenarRegiones() {
  const sel = document.getElementById('f-region');
  sel.length = 1;   // deja solo "Todas"
  DATOS.ordenRegiones.filter(c => regionEnZona(c, estado.zona)).forEach(c => sel.add(new Option(DATOS.regiones[c], c)));
  sel.value = estado.region;
  document.getElementById('f-zona').value = estado.zona;
}

function llenarServicios() {
  const sel = document.getElementById('f-servicio');
  sel.length = 1;   // deja solo "Todos"
  DATOS.servicios.forEach((s, k) => {
    if (regionEnZona(s.region, estado.zona) && (!estado.region || s.region === estado.region)) sel.add(new Option(s.nombre, k));
  });
  sel.value = estado.servicio;
  llenarHospitales();
}

// ---------------------------------------------------------------- buscador de hospital
// Busca por código o por nombre (sin importar tildes ni mayúsculas) dentro de la región y servicio elegidos.
const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const NOMBRE_BUSCABLE = DATOS.hospitales.map(h => sinTildes(h.nombre));
let resultadosHospital = [];   // índices que se muestran en la lista
let activoHospital = -1;       // posición resaltada con el teclado

const hospitalVisible = h => regionEnZona(h.region, estado.zona) && (!estado.region || h.region === estado.region) &&
                             (estado.servicio < 0 || h.servicio === estado.servicio);

// Si el hospital elegido ya no está en la región o servicio, vuelve a "Todos"
function llenarHospitales() {
  if (estado.hospital >= 0 && !hospitalVisible(DATOS.hospitales[estado.hospital])) estado.hospital = -1;
  mostrarHospitalElegido();
}

function mostrarHospitalElegido() {
  const input = document.getElementById('f-hospital');
  const h = DATOS.hospitales[estado.hospital];
  input.value = h ? h.nombre : '';
  input.title = h ? `${h.codigo} · ${h.nombre}` : '';
  input.classList.toggle('elegido', !!h);
  document.getElementById('limpiar-hospital').hidden = !h;
}

// Marca en la lista las partes del texto que coinciden con lo buscado
function resaltar(texto, palabras) {
  const base = sinTildes(texto);
  const marcas = new Array(texto.length).fill(false);
  for (const p of palabras) {
    for (let i = base.indexOf(p); i >= 0; i = base.indexOf(p, i + 1)) marcas.fill(true, i, i + p.length);
  }
  let html = '', abierto = false;
  for (let i = 0; i < texto.length; i++) {
    if (marcas[i] !== abierto) { html += marcas[i] ? '<mark>' : '</mark>'; abierto = marcas[i]; }
    html += texto[i].replace('&', '&amp;').replace('<', '&lt;');
  }
  return html + (abierto ? '</mark>' : '');
}

function buscarHospitales(texto) {
  const palabras = sinTildes(texto.trim()).split(/\s+/).filter(Boolean);
  resultadosHospital = DATOS.hospitales.map((h, k) => k).filter(k => {
    const h = DATOS.hospitales[k];
    return hospitalVisible(h) && palabras.every(p => h.codigo.includes(p) || NOMBRE_BUSCABLE[k].includes(p));
  });
  activoHospital = palabras.length && resultadosHospital.length ? 0 : -1;
  const lista = document.getElementById('lista-hospitales');
  let html = palabras.length ? '' : `<li data-k="-1" class="${estado.hospital < 0 ? 'actual' : ''}">Todos los hospitales</li>`;
  html += resultadosHospital.map((k, j) => {
    const h = DATOS.hospitales[k];
    return `<li role="option" data-k="${k}" id="op-hosp-${k}" class="${j === activoHospital ? 'activo' : ''} ${k === estado.hospital ? 'actual' : ''}">` +
           `<span class="codigo">${resaltar(h.codigo, palabras)}</span><span>${resaltar(h.nombre, palabras)}</span></li>`;
  }).join('');
  if (!resultadosHospital.length) html += '<li class="vacio">Sin resultados en la zona, región y servicio elegidos</li>';
  lista.innerHTML = html;
  lista.hidden = false;
  document.getElementById('f-hospital').setAttribute('aria-expanded', 'true');
}

function cerrarListaHospitales() {
  document.getElementById('lista-hospitales').hidden = true;
  document.getElementById('f-hospital').setAttribute('aria-expanded', 'false');
}

function elegirHospital(k) {
  estado.hospital = k;
  cerrarListaHospitales();
  mostrarHospitalElegido();
  actualizarTodo();
}

function moverActivo(paso) {
  if (!resultadosHospital.length) return;
  activoHospital = (activoHospital + paso + resultadosHospital.length) % resultadosHospital.length;
  document.querySelectorAll('#lista-hospitales li[role="option"]').forEach((li, j) => {
    li.classList.toggle('activo', j === activoHospital);
    if (j === activoHospital) li.scrollIntoView({ block: 'nearest' });
  });
}

function conectarBuscadorHospital() {
  const input = document.getElementById('f-hospital');
  const lista = document.getElementById('lista-hospitales');
  // Al entrar se selecciona el nombre vigente para escribir encima. Con clic, el mouseup quitaría esa
  // selección, así que se ignora el primer mouseup después de enfocar.
  let recienEnfocado = false;
  input.addEventListener('focus', () => { input.select(); recienEnfocado = true; buscarHospitales(''); });
  input.addEventListener('mouseup', ev => { if (recienEnfocado) ev.preventDefault(); recienEnfocado = false; });
  input.addEventListener('input', () => buscarHospitales(input.value));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); if (lista.hidden) buscarHospitales(input.value); else moverActivo(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); moverActivo(-1); }
    else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (!input.value.trim()) elegirHospital(-1);
      else if (activoHospital >= 0) elegirHospital(resultadosHospital[activoHospital]);
    } else if (ev.key === 'Escape') { cerrarListaHospitales(); mostrarHospitalElegido(); input.blur(); }
  });
  // mousedown en vez de click: así se elige antes de que el campo pierda el foco
  lista.addEventListener('mousedown', ev => {
    const li = ev.target.closest('li[data-k]');
    ev.preventDefault();
    if (li) elegirHospital(parseInt(li.dataset.k, 10));
  });
  // al salir sin elegir se vuelve a mostrar el hospital vigente
  input.addEventListener('blur', () => { cerrarListaHospitales(); mostrarHospitalElegido(); });
  document.getElementById('limpiar-hospital').addEventListener('click', () => elegirHospital(-1));
}

function conectarFiltros() {
  conectarRango('f-anio', 'anioDesde', 'anioHasta');
  conectarRango('f-edad', 'tramoDesde', 'tramoHasta');
  conectarBuscadorHospital();
  const enteros = { 'f-region': 'region', 'f-servicio': 'servicio', 'f-sexo': 'sexo', 'f-ingreso': 'ingreso' };
  for (const [id, campo] of Object.entries(enteros)) {
    document.getElementById(id).addEventListener('change', ev => {
      estado[campo] = parseInt(ev.target.value, 10);
      if (campo === 'region') { estado.servicio = -1; llenarServicios(); }
      if (campo === 'servicio') llenarHospitales();
      actualizarTodo();
    });
  }
  document.getElementById('f-zona').addEventListener('change', ev => elegirZona(ev.target.value, false));
  document.getElementById('f-diagnostico').addEventListener('change', ev => {
    estado.diagnostico = ev.target.value;
    actualizarTodo();
  });
  for (const [id, vista] of [['vista-cup', 'cup'], ['vista-comparar', 'comparar']]) {
    document.getElementById(id).addEventListener('click', () => {
      estado.vista = vista;
      document.querySelectorAll('#botones-vista-inicio .boton-vista').forEach(b => {
        b.classList.toggle('activo', b.id === id);
        b.setAttribute('aria-pressed', String(b.id === id));
      });
      actualizarTodo();
    });
  }
  document.getElementById('descargar').addEventListener('click', descargarCSV);

  // pestaña Descargas
  document.getElementById('descargar-resumen').addEventListener('click', descargarCSV);
  document.getElementById('descargar-egresos').addEventListener('click', descargarEgresos);
  document.getElementById('descargar-pdf').addEventListener('click', guardarPDF);
  document.getElementById('ir-filtros').addEventListener('click', () => irA('inicio'));
  document.querySelectorAll('input[name="d-grupo"]').forEach(r => r.addEventListener('change', actualizarDescargas));

  // pestañas
  document.querySelectorAll('.pestana').forEach(boton => {
    boton.addEventListener('click', () => irA(boton.dataset.seccion));
  });
}

function irA(seccion) {
  document.querySelectorAll('.pestana').forEach(b => b.classList.toggle('activa', b.dataset.seccion === seccion));
  document.querySelectorAll('.seccion').forEach(s => s.classList.toggle('activa', s.id === seccion));
}

// Par de selectores desde–hasta: si "desde" queda después de "hasta", se arrastra el otro extremo
function conectarRango(prefijo, campoDesde, campoHasta) {
  const selDesde = document.getElementById(prefijo + '-desde'), selHasta = document.getElementById(prefijo + '-hasta');
  for (const [sel, campo] of [[selDesde, campoDesde], [selHasta, campoHasta]]) {
    sel.addEventListener('change', () => {
      estado[campo] = parseInt(sel.value, 10);
      if (estado[campoDesde] > estado[campoHasta]) {
        if (campo === campoDesde) estado[campoHasta] = estado[campoDesde];
        else estado[campoDesde] = estado[campoHasta];
      }
      selDesde.value = estado[campoDesde];
      selHasta.value = estado[campoHasta];
      actualizarTodo();
    });
  }
}

// Región desde el mapa o la tabla. Si queda fuera de la zona elegida, la zona pasa a ser la de la región.
function elegirRegion(codigo) {
  estado.region = estado.region === codigo ? 0 : codigo;   // segundo clic = quitar el filtro
  if (estado.region && !regionEnZona(estado.region, estado.zona)) estado.zona = ZONA_DE_REGION[estado.region];
  estado.servicio = -1;
  llenarRegiones();
  llenarServicios();
  actualizarTodo();
}

// Zona desde el selector o las tarjetas de zona (alternar = un segundo clic la quita). Quita la región si queda fuera.
function elegirZona(zona, alternar = true) {
  estado.zona = alternar && estado.zona === zona ? '' : zona;
  if (estado.region && !regionEnZona(estado.region, estado.zona)) estado.region = 0;
  estado.servicio = -1;
  llenarRegiones();
  llenarServicios();
  actualizarTodo();
}

// ---------------------------------------------------------------- KPI
function textoVariacion(actual, anterior, tipo) {
  if (anterior === null) return estado.anioDesde === estado.anioHasta ? 'sin año anterior' : 'sin período anterior';
  if (!isFinite(actual) || !isFinite(anterior)) return '';
  const vs = ` vs. ${textoPeriodo(periodoAnterior())}`;
  if (tipo === 'pts') {
    const d = actual - anterior;
    if (Math.abs(d) < 0.05) return `<span class="neutro">= sin cambio</span>${vs}`;
    const clase = d > 0 ? 'sube-mal' : 'baja-bien';
    return `<span class="${clase}">${d > 0 ? '↑' : '↓'} ${fmtDec(Math.abs(d))} pts</span>${vs}`;
  }
  if (tipo === 'dias') {
    const d = actual - anterior;
    if (d === 0) return `<span class="neutro">= sin cambio</span>${vs}`;
    return `<span class="neutro">${d > 0 ? '↑' : '↓'} ${fmtDec(Math.abs(d), 0)} ${Math.abs(d) === 1 ? 'día' : 'días'}</span>${vs}`;
  }
  if (anterior === 0) return '';
  const p = (actual / anterior - 1) * 100;
  return `<span class="neutro">${p >= 0 ? '↑' : '↓'} ${fmtDec(Math.abs(p))} %</span>${vs}`;
}

function actualizarKPI() {
  const k = calcularKPI(filtrarEgresos());
  const anterior = periodoAnterior();
  const ka = anterior ? calcularKPI(filtrarEgresos({ periodo: anterior })) : null;
  const ant = campo => (ka ? ka[campo] : null);

  const poner = (id, valor) => { document.getElementById(id).innerHTML = valor; };
  poner('kpi-egresos', fmtEntero(k.egresos));
  poner('kpi-pacientes', fmtEntero(k.pacientes));
  poner('kpi-mortalidad', isFinite(k.mortalidad) ? fmtDec(k.mortalidad) + ' %' : '–');
  poner('kpi-estada', isFinite(k.estada) ? fmtDec(k.estada, 0) + ' días' : '–');
  poner('kpi-peso', isFinite(k.peso) ? fmtDec(k.peso, 2) : '–');
  poner('var-egresos', textoVariacion(k.egresos, ant('egresos'), '%'));
  poner('var-pacientes', textoVariacion(k.pacientes, ant('pacientes'), '%'));
  poner('var-mortalidad', textoVariacion(k.mortalidad, ant('mortalidad'), 'pts'));
  poner('var-estada', textoVariacion(k.estada, ant('estada'), 'dias'));
  poner('var-peso', textoVariacion(k.peso, ant('peso'), '%'));

  document.getElementById('periodo-kpi').textContent = `· ${textoPeriodo()}`;

  // vista comparativa: valor de los 5 metastásicos bajo cada KPI. Solo CUP: egresos por paciente bajo "Pacientes".
  const km = estado.vista === 'comparar' ? calcularKPI(filtrarEgresos({ grupo: 'met' })) : null;
  const porPaciente = k.pacientes ? `${fmtDec(k.egresos / k.pacientes, 2)} egresos por paciente` : '';
  poner('ref-egresos', km ? `Metastásicos: ${fmtEntero(km.egresos)}` : '');
  poner('ref-pacientes', km ? `Metastásicos: ${fmtEntero(km.pacientes)}` : porPaciente);
  poner('ref-mortalidad', km ? `Metastásicos: ${fmtDec(km.mortalidad)} %` : '');
  poner('ref-estada', km ? `Metastásicos: ${fmtDec(km.estada, 0)} días` : '');
  poner('ref-peso', km ? `Metastásicos: ${fmtDec(km.peso, 2)}` : '');
}

// ---------------------------------------------------------------- gráficos (Chart.js)
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
Chart.defaults.font.size = 12;

// Plugin simple: escribe el valor al final de cada barra (solo donde lo pedimos)
const etiquetasBarras = {
  id: 'etiquetasBarras',
  afterDatasetsDraw(chart, args, opciones) {
    if (!opciones || !opciones.mostrar) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 11.5px ' + Chart.defaults.font.family;
    ctx.fillStyle = COLOR.tinta;
    chart.data.datasets.forEach((ds, k) => {
      if (opciones.soloPrimero && k > 0) return;
      chart.getDatasetMeta(k).data.forEach((barra, j) => {
        const v = ds.data[j];
        if (v === null || v === undefined) return;   // sin dato (por ejemplo, cifra poco estable)
        const texto = opciones.formato ? opciones.formato(v, j) : fmtEntero(v);
        if (chart.options.indexAxis === 'y') {
          // barras negativas: el texto va a la izquierda del extremo
          ctx.textAlign = v < 0 ? 'right' : 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(texto, barra.x + (v < 0 ? -5 : 5), barra.y);
        } else {
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(texto, barra.x, barra.y - 4);
        }
      });
    });
    ctx.restore();
  },
};
Chart.register(etiquetasBarras);

function dibujarGrafico(id, config) {
  if (graficos[id]) graficos[id].destroy();
  graficos[id] = new Chart(document.getElementById(id), config);
}

const ejeLimpio = () => ({ grid: { color: COLOR.grilla }, border: { display: false } });

// Vista comparativa: el CUP en barras y cada cáncer metastásico como un punto de su color (cinco barras más por
// categoría no se leerían). valores(indices) devuelve { data, ...datos extra para el tooltip } de un grupo.
const GRUPOS_MET = [2, 3, 4, 5, 6];   // posiciones en DATOS.grupos: Pulmón … Gástrico
const leyendaGrupos = { display: true, position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true } };

function datasetsComparacion(valores) {
  const datasets = [{ type: 'bar', label: 'CUP', ...valores(filtrarEgresos()), backgroundColor: COLOR.grupos[0],
                      borderRadius: 4, barPercentage: 0.75, order: 2 }];
  for (const g of GRUPOS_MET) {
    datasets.push({ type: 'line', label: DATOS.grupos[g], ...valores(filtrarEgresos({ grupo: g })), showLine: false,
                    pointStyle: 'circle', pointRadius: 5, pointHoverRadius: 7, backgroundColor: COLOR.grupos[g],
                    borderColor: COLOR.tarjeta, borderWidth: 1.5, order: 1 });
  }
  return datasets;
}

// Cuenta los egresos con cada bit encendido en un campo de máscara (sitios de metástasis o comorbilidades)
function contarBits(indices, campo, n) {
  const cuenta = new Array(n).fill(0);
  for (const i of indices) {
    for (let b = 0; b < n; b++) if (E[campo][i] & (1 << b)) cuenta[b]++;
  }
  return cuenta;
}

// Barras horizontales por bit, de mayor a menor en el CUP. Solo CUP: N° de egresos; comparar: % de cada grupo.
// notas = { cup, comparar }: textos de la nota bajo el título según la vista
function graficoPorBits(id, campo, nombres, notas) {
  const cup = filtrarEgresos();
  const cuenta = contarBits(cup, campo, nombres.length);
  const orden = cuenta.map((v, k) => k).sort((a, b) => cuenta[b] - cuenta[a]);
  const etiquetas = orden.map(k => nombres[k]);
  const comparar = estado.vista === 'comparar';
  let datasets;

  if (!comparar) {
    datasets = [{ label: 'Egresos CUP', data: orden.map(k => cuenta[k]), backgroundColor: COLOR.violeta,
                  borderRadius: 4, barPercentage: 0.75 }];
    document.getElementById('nota-' + id.slice(2)).textContent = notas.cup;
  } else {
    datasets = datasetsComparacion(indices => {
      const c = contarBits(indices, campo, nombres.length);
      return { data: orden.map(k => (indices.length ? c[k] / indices.length * 100 : 0)) };
    });
    document.getElementById('nota-' + id.slice(2)).textContent = notas.comparar;
  }

  dibujarGrafico(id, {
    type: 'bar',
    data: { labels: etiquetas, datasets },
    options: {
      indexAxis: 'y', maintainAspectRatio: false,
      layout: { padding: { right: 36 } },
      scales: { x: { ...ejeLimpio(), ticks: { callback: v => fmtEntero(v) + (comparar ? ' %' : '') } },
                y: { grid: { display: false }, border: { display: false } } },
      plugins: {
        legend: comparar ? leyendaGrupos : { display: false },
        tooltip: { callbacks: { label: c => comparar ? `${c.dataset.label}: ${fmtDec(c.raw)} %`
          : `${fmtEntero(c.raw)} egresos (${cup.length ? fmtDec(c.raw / cup.length * 100) : 0} % de los CUP)` } },
        etiquetasBarras: { mostrar: !comparar },
      },
    },
  });
}

function graficoSitios() {
  graficoPorBits('g-sitios', 'sitios', DATOS.sitios.map((s, k) => `${s} (${CODIGO_SITIO[k]})`), {
    cup: `N° de egresos CUP ${textoPeriodo()} con metástasis codificada en cada sitio · un egreso puede tener varios`,
    comparar: `% de egresos ${textoPeriodo()} con metástasis en cada sitio · barra: CUP; punto: cada cáncer metastásico`,
  });
}

function graficoComorbilidades() {
  graficoPorBits('g-comorb', 'comorb', DATOS.comorbilidades, {
    cup: `N° de egresos CUP ${textoPeriodo()} con cada enfermedad en los diagnósticos secundarios · un egreso puede tener varias`,
    comparar: `% de egresos ${textoPeriodo()} con cada enfermedad · barra: CUP; punto: cada cáncer metastásico`,
  });
}

// Mortalidad según comorbilidad: muertes de cada 100 egresos que tienen cada enfermedad. La última posición es
// "sin ninguna de las 10" (la referencia). Con menos de MIN_ESTABLE egresos la cifra no se muestra (poco estable).
const MIN_ESTABLE = 30;

function mortalidadPorComorb(indices) {
  const n = DATOS.comorbilidades.length;
  const total = new Array(n + 1).fill(0), muertes = new Array(n + 1).fill(0);
  for (const i of indices) {
    const m = E.comorb[i];
    if (!m) { total[n]++; muertes[n] += E.fallece[i]; continue; }
    for (let b = 0; b < n; b++) if (m & (1 << b)) { total[b]++; muertes[b] += E.fallece[i]; }
  }
  return { total, mortalidad: total.map((t, k) => (t >= MIN_ESTABLE ? muertes[k] / t * 100 : null)) };
}

function graficoMortalidadComorb() {
  const n = DATOS.comorbilidades.length;
  const cup = mortalidadPorComorb(filtrarEgresos());
  // "Sin ninguna" primero (referencia) y luego de mayor a menor mortalidad en el CUP; las poco estables al final
  const orden = [n].concat(DATOS.comorbilidades.map((c, k) => k)
    .sort((a, b) => (cup.mortalidad[b] ?? -1) - (cup.mortalidad[a] ?? -1)));
  const etiquetas = orden.map(k => (k === n ? 'Sin ninguna de las 10' : DATOS.comorbilidades[k]));
  const serie = r => ({ data: orden.map(k => r.mortalidad[k]), n: orden.map(k => r.total[k]) });
  const comparar = estado.vista === 'comparar';
  // Solo CUP: barras en el color de la muerte (naranjo) y la referencia en gris
  const datasets = comparar ? datasetsComparacion(indices => serie(mortalidadPorComorb(indices)))
    : [{ label: 'CUP', ...serie(cup), borderRadius: 4, barPercentage: 0.75,
         backgroundColor: orden.map(k => (k === n ? COLOR.gris : COLOR.muerte)) }];
  const referencia = cup.mortalidad[n];
  document.getElementById('nota-mortcomorb').textContent =
    `Muertes de cada 100 egresos ${comparar ? '' : 'CUP '}${textoPeriodo()} que tienen cada enfermedad · ` +
    `${comparar ? 'barra: CUP; punto: cada cáncer · ' : ''}CUP sin ninguna de las 10: ` +
    `${referencia === null ? 'pocos egresos' : fmtDec(referencia) + ' %'} · sin barra: menos de ${MIN_ESTABLE} egresos`;

  dibujarGrafico('g-mortcomorb', {
    type: 'bar',
    data: { labels: etiquetas, datasets },
    options: {
      indexAxis: 'y', maintainAspectRatio: false,
      layout: { padding: { right: 36 } },
      scales: { x: { ...ejeLimpio(), beginAtZero: true, ticks: { callback: v => fmtEntero(v) + ' %' } },
                y: { grid: { display: false }, border: { display: false },
                     ticks: { font: c => (c.index === 0 ? { weight: '600' } : {}) } } },
      plugins: {
        legend: comparar ? leyendaGrupos : { display: false },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtDec(c.raw)} % mueren ` +
                                            `(${fmtEntero(c.dataset.n[c.dataIndex])} egresos)` } },
        etiquetasBarras: { mostrar: !comparar, formato: v => fmtDec(v, 0) + ' %' },
      },
    },
  });
}

// Índice de Charlson (sin cáncer) en 4 categorías: % de egresos en cada una y su mortalidad en el tooltip
const CATEGORIAS_CHARLSON = ['0', '1', '2', '3 o más'];

function porCharlson(indices) {
  const n = [0, 0, 0, 0], muertes = [0, 0, 0, 0];
  for (const i of indices) {
    const c = Math.min(E.charlson[i], 3);
    n[c]++;
    muertes[c] += E.fallece[i];
  }
  const total = indices.length;
  return { pct: n.map(v => (total ? v / total * 100 : 0)), n, mortalidad: n.map((v, c) => (v ? muertes[c] / v * 100 : NaN)) };
}

function graficoCharlson() {
  const comparar = estado.vista === 'comparar';
  const serie = indices => { const r = porCharlson(indices); return { data: r.pct, mortalidad: r.mortalidad, n: r.n }; };
  // Solo CUP: rampa del violeta, más intenso = más puntos (sobre negro también: más claro = más puntos)
  const rampa = [0.3, 0.5, 0.75, 1].map(t => mezclar(COLOR.tarjeta, COLOR.violeta, t));
  const datasets = comparar ? datasetsComparacion(serie)
    : [{ label: 'CUP', ...serie(filtrarEgresos()), backgroundColor: rampa, borderRadius: 4, barPercentage: 0.6 }];
  document.getElementById('nota-charlson').textContent = comparar
    ? `% de egresos ${textoPeriodo()} según el índice de Charlson · barra: CUP; punto: cada cáncer · mortalidad en el detalle`
    : `% de egresos CUP ${textoPeriodo()} según el índice de Charlson (puntos por enfermedad crónica, sin contar el cáncer)`;

  dibujarGrafico('g-charlson', {
    type: 'bar',
    data: { labels: CATEGORIAS_CHARLSON.map(c => (c === '1' ? '1 punto' : `${c} puntos`)), datasets },
    options: {
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      scales: { y: { ...ejeLimpio(), beginAtZero: true, ticks: { callback: v => fmtEntero(v) + ' %' } },
                x: { grid: { display: false } } },
      plugins: {
        legend: comparar ? leyendaGrupos : { display: false },
        tooltip: { callbacks: {
          label: c => `${c.dataset.label}: ${fmtDec(c.raw)} % (${fmtEntero(c.dataset.n[c.dataIndex])} egresos)`,
          afterLabel: c => (isFinite(c.dataset.mortalidad[c.dataIndex])
            ? `Mortalidad: ${fmtDec(c.dataset.mortalidad[c.dataIndex])} %` : ''),
        } },
        etiquetasBarras: { mostrar: !comparar, formato: v => fmtDec(v, 0) + ' %' },
      },
    },
  });
}

// Egresos por mes de alta en el período, uno tras otro (Ene del primer año … Dic del último)
function egresosPorMes(periodo) {
  const meses = new Array((periodo.hasta - periodo.desde + 1) * 12).fill(0);
  for (const i of filtrarEgresos({ periodo })) if (E.mes[i] >= 1) meses[(E.anio[i] - periodo.desde) * 12 + E.mes[i] - 1]++;
  return meses;
}

function graficoMensual() {
  const periodo = periodoActual(), anteriorP = periodoAnterior();
  const unAnio = periodo.desde === periodo.hasta;
  const actual = egresosPorMes(periodo);
  const datasets = [{ label: textoPeriodo(), data: actual, borderColor: COLOR.violeta, backgroundColor: COLOR.violeta,
                      borderWidth: 2, pointRadius: unAnio ? 3 : 1.5, tension: 0 }];
  // Un año: eje Ene–Dic con el año anterior superpuesto. Varios años: serie continua mes a mes.
  const etiquetas = unAnio ? MESES
    : actual.map((v, k) => `${MESES[k % 12]} ${String(periodo.desde + Math.floor(k / 12)).slice(2)}`);
  let detalle = '';
  if (anteriorP) {
    const anterior = egresosPorMes(anteriorP);
    if (unAnio) {
      datasets.push({ label: textoPeriodo(anteriorP), data: anterior, borderColor: COLOR.gris, backgroundColor: COLOR.gris,
                      borderWidth: 2, borderDash: [5, 4], pointRadius: 2.5, tension: 0 });
    }
    const tA = actual.reduce((a, b) => a + b, 0), tB = anterior.reduce((a, b) => a + b, 0);
    if (tB > 0) detalle = ` (${tA >= tB ? '+' : '−'}${fmtDec(Math.abs(tA / tB - 1) * 100)} % vs. ${textoPeriodo(anteriorP)})`;
  }
  const total = actual.reduce((a, b) => a + b, 0);
  document.getElementById('nota-mensual').textContent =
    `N° de egresos por mes de alta · ${textoPeriodo()}: ${fmtEntero(total)} egresos${detalle}`;

  dibujarGrafico('g-mensual', {
    type: 'line',
    data: { labels: etiquetas, datasets },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: { y: { ...ejeLimpio(), beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
      plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 18 } } },
    },
  });
}

function graficoSexo() {
  const cup = filtrarEgresos();
  const hombres = cup.filter(i => E.sexo[i] === 0).length;
  const mujeres = cup.filter(i => E.sexo[i] === 1).length;
  const total = hombres + mujeres;
  let nota = `Egresos CUP ${textoPeriodo()}`;
  if (estado.vista === 'comparar') {
    const met = filtrarEgresos({ grupo: 'met' });
    const mm = met.filter(i => E.sexo[i] === 1).length;
    if (met.length) nota += ` · mujeres en metastásicos: ${fmtDec(mm / met.length * 100)} %`;
  }
  document.getElementById('nota-sexo').textContent = nota;

  const centro = {
    id: 'centro',
    afterDraw(chart) {
      const { ctx, chartArea: a } = chart;
      const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = COLOR.tinta;
      ctx.font = '700 20px ' + Chart.defaults.font.family;
      ctx.fillText(fmtEntero(total), x, y + 2);
      ctx.fillStyle = COLOR.texto;
      ctx.font = '12px ' + Chart.defaults.font.family;
      ctx.fillText('egresos', x, y + 18);
      ctx.restore();
    },
  };
  dibujarGrafico('g-sexo', {
    type: 'doughnut',
    data: {
      labels: ['Hombres', 'Mujeres'],
      datasets: [{ data: [hombres, mujeres], backgroundColor: [COLOR.violeta, COLOR.violetaClaro],
                   borderColor: COLOR.tarjeta, borderWidth: 2 }],
    },
    options: {
      maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12,
          generateLabels: chart => chart.data.labels.map((l, k) => ({
            text: `${l}: ${fmtEntero(chart.data.datasets[0].data[k])} (${total ? fmtDec(chart.data.datasets[0].data[k] / total * 100) : 0} %)`,
            fillStyle: chart.data.datasets[0].backgroundColor[k], strokeStyle: COLOR.tarjeta, fontColor: COLOR.texto, index: k })) } },
        tooltip: { callbacks: { label: c => `${c.label}: ${fmtEntero(c.raw)} (${fmtDec(c.raw / total * 100)} %)` } },
      },
    },
    plugins: [centro],
  });
}

// Cuenta por tramo, solo los tramos del rango de edad elegido
function contarTramos(indices) {
  const cuenta = new Array(DATOS.tramos.length).fill(0);
  for (const i of indices) if (E.tramo[i] >= 0) cuenta[E.tramo[i]]++;
  return cuenta.slice(estado.tramoDesde, estado.tramoHasta + 1);
}

function graficoEdad() {
  const cup = filtrarEgresos();
  const cuenta = contarTramos(cup);
  const comparar = estado.vista === 'comparar';
  let datasets;
  if (!comparar) {
    datasets = [{ label: 'Egresos CUP', data: cuenta, backgroundColor: COLOR.violeta, borderRadius: 4, barPercentage: 0.7 }];
    document.getElementById('nota-edad').textContent = `N° de egresos CUP ${textoPeriodo()} por tramo de edad al ingreso`;
  } else {
    datasets = datasetsComparacion(indices => ({ data: contarTramos(indices).map(v => (indices.length ? v / indices.length * 100 : 0)) }));
    document.getElementById('nota-edad').textContent = `% de egresos ${textoPeriodo()} en cada tramo de edad · barra: CUP; punto: cada cáncer`;
  }
  dibujarGrafico('g-edad', {
    type: 'bar',
    data: { labels: DATOS.tramos.slice(estado.tramoDesde, estado.tramoHasta + 1), datasets },
    options: {
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      scales: { y: { ...ejeLimpio(), beginAtZero: true, ticks: { callback: v => fmtEntero(v) + (comparar ? ' %' : '') } },
                x: { grid: { display: false } } },
      plugins: {
        legend: comparar ? leyendaGrupos : { display: false },
        tooltip: { callbacks: { label: c => comparar ? `${c.dataset.label}: ${fmtDec(c.raw)} %`
                                                     : `${fmtEntero(c.raw)} egresos (${fmtDec(c.raw / cup.length * 100)} %)` } },
        etiquetasBarras: { mostrar: !comparar },
      },
    },
  });
}

// ---------------------------------------------------------------- mapa (SVG hecho a mano)
// Proyección simple: longitud corregida por el coseno de la latitud media de Chile continental.
// El mapa responde al filtro Zona: con una zona elegida solo se dibujan sus regiones y el encuadre se acerca a ellas.
const LON_MIN = -76, LAT_MAX = -17.3, COS = Math.cos(37 * Math.PI / 180);
const proyectar = ([lon, lat]) => [(lon - LON_MIN) * COS * 10, (LAT_MAX - lat) * 10];

// Contorno proyectado de cada región (se calcula una vez): trazo SVG, caja y centro del polígono más grande
const FORMAS = {};
for (const f of REGIONES_GEO.features) {
  const caja = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  let mayor = null, areaMayor = -1;
  const d = f.geometry.coordinates.map(poly => poly.map(anillo => {
    const pts = anillo.map(proyectar);
    let a = 0;
    pts.forEach(([x, y], k) => {
      caja.x0 = Math.min(caja.x0, x); caja.x1 = Math.max(caja.x1, x);
      caja.y0 = Math.min(caja.y0, y); caja.y1 = Math.max(caja.y1, y);
      const [x2, y2] = pts[(k + 1) % pts.length];
      a += x * y2 - x2 * y;
    });
    if (Math.abs(a) > areaMayor) { areaMayor = Math.abs(a); mayor = pts; }
    return 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
  }).join('')).join('');
  const ys = mayor.map(p => p[1]), xs = mayor.map(p => p[0]);
  FORMAS[f.properties.codregion] = { d, caja, centroY: (Math.min(...ys) + Math.max(...ys)) / 2, bordeX: Math.max(...xs) };
}

// Indicadores del mapa y del gráfico por región (pestaña Territorio). Las proporciones llevan su IC 95 % (Wilson):
// con pocos egresos el intervalo es ancho, y eso se muestra en vez de esconder la región.
// rampa: más intenso = valor más alto (sobre negro, más claro). Las de proporción se pintan en gris bajo MIN_ESTABLE.
const rampaDe = color => [0.22, 0.45, 0.72, 1].map(t => mezclar(COLOR.tarjeta, color, t));
const INDICADORES_MAPA = {
  egresos: { nombre: 'Egresos CUP', corto: 'Egresos', cortes: [15, 30, 60], etiquetas: ['< 15', '15–29', '30–59', '≥ 60'],
             rampa: () => RAMPA_MAPA, color: () => COLOR.territorio, valor: r => r.egresos, formato: v => fmtEntero(v),
             texto: 'N° de egresos CUP', proporcion: false },
  mortalidad: { nombre: 'Mortalidad', corto: 'Mortalidad', cortes: [15, 20, 25], etiquetas: ['< 15 %', '15–19 %', '20–24 %', '≥ 25 %'],
                rampa: () => RAMPA_MUERTE, color: () => COLOR.muerte, casos: r => r.muertes, proporcion: true,
                valor: r => (r.egresos ? r.muertes / r.egresos * 100 : NaN), formato: v => fmtDec(v, 0) + ' %',
                texto: 'Muertes de cada 100 egresos CUP', alto: 'más alta', bajo: 'más baja' },
  oncologia: { nombre: 'Alta por oncología', corto: 'Oncología', cortes: [3, 6, 10], etiquetas: ['< 3 %', '3–5 %', '6–9 %', '≥ 10 %'],
               rampa: () => rampaDe(COLOR.violeta), color: () => COLOR.violeta, casos: r => r.onco, proporcion: true,
               valor: r => (r.egresos ? r.onco / r.egresos * 100 : NaN), formato: v => fmtDec(v, 0) + ' %',
               texto: 'Egresos CUP con alta de oncología, de cada 100', alto: 'más alta', bajo: 'más baja' },
  estancia: { nombre: 'Estancia mediana', corto: 'Estancia', cortes: [7, 9, 11], etiquetas: ['< 7 d', '7–8 d', '9–10 d', '≥ 11 d'],
              rampa: () => rampaDe(COLOR.recursos), color: () => COLOR.recursos, proporcion: false,
              valor: r => (r.egresos ? mediana(r.estadas) : NaN), formato: v => fmtDec(v, 0) + ' d',
              texto: 'Estancia mediana (días)' },
};

// Intervalo de confianza 95 % de Wilson para una proporción (en %)
function wilson(casos, n) {
  if (!n) return [NaN, NaN];
  const z = 1.96, p = casos / n, d = 1 + z * z / n;
  const centro = (p + z * z / (2 * n)) / d, ancho = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, centro - ancho) * 100, Math.min(1, centro + ancho) * 100];
}

// Dibuja el mapa en el contenedor id. opciones: ancho (px), etiquetas (nombres de región a la derecha), indicador.
function dibujarMapa(id, porRegion, { ancho = 150, etiquetas = false, indicador = 'egresos' } = {}) {
  const ind = INDICADORES_MAPA[indicador];
  const rampa = ind.rampa();
  const visibles = REGIONES_GEO.features.map(f => f.properties.codregion).filter(c => regionEnZona(c, estado.zona));
  const caja = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const c of visibles) {
    const k = FORMAS[c].caja;
    caja.x0 = Math.min(caja.x0, k.x0); caja.x1 = Math.max(caja.x1, k.x1);
    caja.y0 = Math.min(caja.y0, k.y0); caja.y1 = Math.max(caja.y1, k.y1);
  }
  // u = unidades del mapa por píxel; con etiquetas se reservan 130 px a la derecha para los nombres
  const espacio = etiquetas ? 130 : 0;
  const u = (caja.x1 - caja.x0) / (ancho - espacio - 8);
  const margen = 4 * u;
  const vb = [caja.x0 - margen, caja.y0 - margen, caja.x1 - caja.x0 + espacio * u + 2 * margen, caja.y1 - caja.y0 + 2 * margen];
  const zona = estado.zona ? ZONAS[estado.zona].nombre : 'Chile';
  let svg = `<svg viewBox="${vb.map(v => v.toFixed(1)).join(' ')}" style="width:${ancho}px" role="img" ` +
            `aria-label="Mapa de ${zona} por región: ${ind.texto.toLowerCase()}">`;
  for (const c of visibles) {
    const r = porRegion[c] || { egresos: 0, muertes: 0 };
    const v = ind.valor(r);
    const pocos = ind.proporcion && r.egresos < MIN_ESTABLE;
    const color = !isFinite(v) || pocos ? COLOR.apagado : rampa[ind.cortes.filter(x => v >= x).length];
    svg += `<path d="${FORMAS[c].d}" fill="${color}" data-region="${c}" class="${estado.region === c ? 'elegida' : ''}"/>`;
  }
  if (etiquetas) {
    for (const c of visibles) {
      svg += `<text class="nombre-region" x="${(FORMAS[c].bordeX + 6 * u).toFixed(1)}" y="${FORMAS[c].centroY.toFixed(1)}" ` +
             `style="font-size:${(11.5 * u).toFixed(2)}px" dominant-baseline="middle">${DATOS.regiones[c]}</text>`;
    }
  }
  if (!estado.zona) svg += lineasZona(vb, u);
  const contenedor = document.getElementById(id);
  contenedor.innerHTML = svg + '</svg>';

  const tip = document.getElementById('tooltip-mapa');
  contenedor.querySelectorAll('path').forEach(p => {
    const cod = parseInt(p.dataset.region, 10);
    const r = porRegion[cod];
    p.addEventListener('mousemove', ev => {
      tip.style.display = 'block';
      tip.style.left = ev.clientX + 12 + 'px';
      tip.style.top = ev.clientY + 12 + 'px';
      const v = r && r.egresos ? ind.valor(r) : NaN;
      tip.innerHTML = `<b>${DATOS.regiones[cod]}</b> · zona ${ZONAS[ZONA_DE_REGION[cod]].nombre.toLowerCase()}` +
        `<br>${r ? fmtEntero(r.egresos) : 0} egresos CUP` +
        (indicador !== 'egresos' && isFinite(v) ? `<br>${ind.nombre}: ${ind.formato(v)}` +
          (ind.proporcion && r.egresos < MIN_ESTABLE ? ' (pocos egresos: cifra inestable)' : '') : '');
    });
    p.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    p.addEventListener('click', () => { tip.style.display = 'none'; elegirRegion(cod); });
  });
}

function leyendaMapa(id, indicador = 'egresos') {
  const ind = INDICADORES_MAPA[indicador];
  document.getElementById(id).innerHTML = ind.rampa().map((c, k) =>
    `<div><span style="background:${c}"></span>${ind.etiquetas[k]}</div>`).join('') +
    (ind.proporcion ? `<div><span style="background:${COLOR.apagado}"></span>&lt; ${MIN_ESTABLE} egr.</div>` : '');
}

// Límites de las zonas cuando se ve el país completo (latitud aproximada entre Coquimbo y Valparaíso, y entre Maule y Ñuble)
const LIMITES_ZONA = [{ lat: -32.2, abajo: 'Centro' }, { lat: -36.0, abajo: 'Sur' }];

function lineasZona(vb, u) {
  const y = lat => (LAT_MAX - lat) * 10;
  const t = 10 * u;   // texto de 10 px
  const x = vb[0] + 2 * u;
  let svg = `<text class="zona-mapa" x="${x.toFixed(1)}" y="${(vb[1] + t * 1.2).toFixed(1)}" style="font-size:${t.toFixed(2)}px">Norte</text>`;
  for (const l of LIMITES_ZONA) {
    svg += `<line class="limite-zona" x1="${vb[0]}" x2="${vb[0] + vb[2]}" y1="${y(l.lat).toFixed(1)}" y2="${y(l.lat).toFixed(1)}"/>` +
           `<text class="zona-mapa" x="${x.toFixed(1)}" y="${(y(l.lat) + t * 1.3).toFixed(1)}" style="font-size:${t.toFixed(2)}px">${l.abajo}</text>`;
  }
  return svg;
}

const mortalidadDe = r => (r.egresos ? r.muertes / r.egresos * 100 : NaN);
const textoMort = r => (r.egresos ? fmtDec(mortalidadDe(r)) + ' %' : '–');

// Resumen por región y por zona con los filtros de Inicio salvo zona, región y servicio. grupo: 'cup' o 'met'.
function nuevoResumen() { return { egresos: 0, muertes: 0, onco: 0, estadas: [], peso: 0, sev3: 0, pacientes: new Set() }; }

function resumenTerritorio({ grupo = 'cup', periodo = periodoActual() } = {}) {
  const porRegion = {}, porZona = {};
  for (const z of Object.keys(ZONAS)) porZona[z] = nuevoResumen();
  const pais = nuevoResumen();
  for (const i of filtrarEgresos({ ignorarRegion: true, grupo, periodo })) {
    const r = E.region[i];
    if (!r) continue;
    for (const s of [porRegion[r] = porRegion[r] || nuevoResumen(), porZona[ZONA_DE_REGION[r]], pais]) {
      s.egresos++;
      s.muertes += E.fallece[i];
      s.onco += E.onco[i];
      s.estadas.push(E.estada[i]);
      s.peso += E.peso[i];
      s.sev3 += E.sev3[i];
      s.pacientes.add(E.paciente[i]);
    }
  }
  return { porRegion, porZona, pais };
}

// Regiones que se listan: las de la zona elegida o todas
const regionesVisibles = () => DATOS.ordenRegiones.filter(c => regionEnZona(c, estado.zona));

// Pestañas Territorio y Comparaciones (el mapa ya no está en Inicio: vive en la pestaña Territorio)
function actualizarTerritorio() {
  const { porRegion, porZona, pais } = resumenTerritorio();
  actualizarPestanaTerritorio(porRegion, porZona, pais);
  actualizarComparaciones();
}

// ---------------------------------------------------------------- pestaña Territorio
// Mapa grande con nombres de región, indicador elegible y detalle por región.
// Usa los mismos filtros de Inicio; el selector de zona de esta pestaña es el mismo filtro Zona.
function kpiTerritorio(nombre, valor, detalle, tono) {
  return `<div class="tarjeta kpi ${tono}"><div><span class="kpi-nombre">${nombre}</span>` +
         `<div class="kpi-valor">${valor}</div><div class="kpi-ref">${detalle}</div></div></div>`;
}

function actualizarPestanaTerritorio(porRegion, porZona, pais) {
  const zona = estado.zona ? ZONAS[estado.zona].nombre : null;
  const ambito = zona ? porZona[estado.zona] : pais;
  const lugar = zona ? `zona ${zona.toLowerCase()}` : 'Chile completo';
  document.getElementById('t-titulo').innerHTML = `${zona ? 'Zona ' + zona : 'Chile completo'} <span>· ${textoPeriodo()}</span>`;
  document.getElementById('t-bajada').textContent = zona
    ? `Solo las ${ZONAS[estado.zona].regiones.length} regiones de la zona ${zona.toLowerCase()}. Usa los filtros de Inicio (años, sexo, edad, diagnóstico e ingreso).`
    : 'Las 16 regiones, divididas en norte, centro y sur. Elige una zona para acercar el mapa a sus regiones.';
  document.querySelectorAll('#t-zonas .boton-vista').forEach(b => {
    b.classList.toggle('activo', b.dataset.zona === estado.zona);
    b.setAttribute('aria-pressed', String(b.dataset.zona === estado.zona));
  });
  document.querySelectorAll('#t-indicador .boton-vista').forEach(b => {
    b.classList.toggle('activo', b.dataset.indicador === estado.indicadorMapa);
    b.setAttribute('aria-pressed', String(b.dataset.indicador === estado.indicadorMapa));
  });

  dibujarMapa('mapa-t', porRegion, { ancho: 340, etiquetas: true, indicador: estado.indicadorMapa });
  leyendaMapa('leyenda-mapa-t', estado.indicadorMapa);
  document.getElementById('t-nota-mapa').textContent =
    `${INDICADORES_MAPA[estado.indicadorMapa].texto} por región del hospital · ${lugar}. Clic en una región para filtrar.`;

  // Aviso: con un solo año muchas regiones tienen pocos egresos y sus cifras son inestables
  const regiones = regionesVisibles();
  const pocas = regiones.filter(c => (porRegion[c] || nuevoResumen()).egresos < MIN_ESTABLE).length;
  const aviso = document.getElementById('t-aviso');
  const variosAnios = estado.anioDesde === ANIOS[0] && estado.anioHasta === ANIOS[ANIOS.length - 1];
  aviso.hidden = !(pocas >= 3 && !variosAnios);
  aviso.querySelector('span').textContent = `En ${textoPeriodo()}, ${pocas} de ${regiones.length} regiones tienen menos de ` +
    `${MIN_ESTABLE} egresos CUP: sus porcentajes cambian mucho por azar (intervalos anchos). Con más años la comparación es más firme.`;

  // Indicadores del ámbito (zona o país)
  const est = mediana(ambito.estadas);
  const IND = INDICADORES_MAPA;
  const deTotal = zona && pais.egresos ? `${fmtDec(ambito.egresos / pais.egresos * 100, 0)} % de los egresos CUP del país` : 'todas las regiones';
  const vsPais = (k, txt) => (zona ? `país: ${IND[k].formato(IND[k].valor(pais))}` : txt);
  document.getElementById('t-kpi').innerHTML = [
    kpiTerritorio('Egresos CUP', fmtEntero(ambito.egresos), deTotal, 'tono-volumen'),
    kpiTerritorio('Pacientes únicos', fmtEntero(ambito.pacientes.size),
      ambito.pacientes.size ? `${fmtDec(ambito.egresos / ambito.pacientes.size, 2)} egresos por paciente` : '', 'tono-volumen'),
    kpiTerritorio('Mortalidad hospitalaria', textoMort(ambito), vsPais('mortalidad', 'de cada 100 egresos'), 'tono-muerte'),
    kpiTerritorio('Alta por oncología', ambito.egresos ? fmtDec(ambito.onco / ambito.egresos * 100) + ' %' : '–',
      vsPais('oncologia', 'de cada 100 egresos'), 'tono-volumen'),
    kpiTerritorio('Estancia mediana', isFinite(est) ? fmtDec(est, 0) + ' días' : '–', vsPais('estancia', 'entre ingreso y alta'), 'tono-recursos'),
    kpiTerritorio('Peso GRD medio', ambito.egresos ? fmtDec(ambito.peso / ambito.egresos / 100, 2) : '–',
      zona && pais.egresos ? `país: ${fmtDec(pais.peso / pais.egresos / 100, 2)}` : '1 = hospitalización promedio', 'tono-recursos'),
  ].join('');

  // Gráfico por región con el indicador elegido: todas las regiones con barra; las de pocos egresos en tono pálido.
  // Proporciones: bigote = IC 95 %. Línea punteada = valor del país (y de la zona, si hay una elegida).
  const ind = IND[estado.indicadorMapa];
  const color = ind.color();
  let filas = regiones.map(c => {
    const r = porRegion[c] || nuevoResumen();
    const v = r.egresos ? ind.valor(r) : NaN;
    return { c, r, v, ic: ind.proporcion ? wilson(ind.casos(r), r.egresos) : null, pocos: r.egresos < MIN_ESTABLE };
  });
  if (estado.ordenTerritorio === 'valor') filas = filas.slice().sort((a, b) => (isFinite(b.v) ? b.v : -1) - (isFinite(a.v) ? a.v : -1));
  const refs = [{ nombre: 'Chile', v: ind.valor(pais) }];
  if (zona && estado.indicadorMapa !== 'egresos') refs.push({ nombre: `Zona ${zona.toLowerCase()}`, v: ind.valor(ambito) });
  if (estado.indicadorMapa === 'egresos') refs.length = 0;   // en conteos no hay un valor de referencia comparable

  // Regiones que se alejan del país más allá del azar: su IC 95 % no incluye el valor de Chile
  const ref = refs.length ? refs[0].v : NaN;
  const altas = [], bajas = [];
  if (ind.proporcion) for (const f of filas) {
    if (f.r.egresos < 10) continue;
    if (f.ic[0] > ref) altas.push(DATOS.regiones[f.c]); else if (f.ic[1] < ref) bajas.push(DATOS.regiones[f.c]);
  }
  const lista = l => (l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l[0]);
  let hallazgo = '';
  if (ind.proporcion) {
    const partes = [];
    if (altas.length) partes.push(`<b>${ind.alto} que el país:</b> ${lista(altas)}`);
    if (bajas.length) partes.push(`<b>${ind.bajo} que el país:</b> ${lista(bajas)}`);
    const mayus = t => t.replace('<b>', '<b>').replace(/<b>(.)/, (m, c) => '<b>' + c.toUpperCase());
    hallazgo = partes.length ? mayus(partes.join(' · ')) + ' (fuera del margen de error).'
      : `Ninguna región se aleja de Chile (${ind.formato(ref)}) más de lo que explica el azar.`;
  } else if (estado.indicadorMapa === 'estancia') {
    hallazgo = `Chile: estancia mediana de ${ind.formato(ref)}.`;
  } else {
    const top = filas.filter(f => isFinite(f.v)).sort((a, b) => b.v - a.v)[0];
    hallazgo = top ? `<b>${DATOS.regiones[top.c]}</b> concentra ${fmtDec(top.v / Math.max(pais.egresos, 1) * 100, 0)} % de los egresos CUP del país.` : '';
  }
  document.getElementById('t-hallazgo').innerHTML = hallazgo;
  document.getElementById('t-graf-titulo').textContent = `${ind.nombre} por región`;
  document.getElementById('t-nota-mort').textContent = `${ind.texto} · ${textoPeriodo()} · ${lugar}` +
    (ind.proporcion ? ` · barra pálida: menos de ${MIN_ESTABLE} egresos · bigote: margen de error (IC 95 %)` : '');
  document.querySelectorAll('#t-orden .boton-vista').forEach(b => {
    b.classList.toggle('activo', b.dataset.orden === estado.ordenTerritorio);
    b.setAttribute('aria-pressed', String(b.dataset.orden === estado.ordenTerritorio));
  });

  // Eje: hasta 1,5 veces el valor más alto (no hasta el bigote más largo, que con pocos egresos aplasta las barras)
  const valores = filas.map(f => f.v).filter(isFinite);
  const maxX = Math.max(...valores, ...refs.map(r => r.v)) * (ind.proporcion ? 1.5 : 1.15) || 1;
  const decoracion = {
    id: 'icReferencia',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: { x } } = chart;
      ctx.save();
      // bigotes del IC
      ctx.strokeStyle = COLOR.tinta; ctx.lineWidth = 1.5;
      chart.getDatasetMeta(0).data.forEach((barra, j) => {
        const f = filas[j];
        if (!f.ic || !isFinite(f.ic[0])) return;
        const recortado = f.ic[1] > x.max;   // el bigote sigue más allá del eje: se marca con una flecha
        const x0 = x.getPixelForValue(f.ic[0]), x1 = x.getPixelForValue(Math.min(f.ic[1], x.max)), y = barra.y;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.moveTo(x0, y - 5); ctx.lineTo(x0, y + 5);
        if (recortado) { ctx.moveTo(x1 - 6, y - 4); ctx.lineTo(x1, y); ctx.lineTo(x1 - 6, y + 4); }
        else { ctx.moveTo(x1, y - 5); ctx.lineTo(x1, y + 5); }
        ctx.stroke();
      });
      // líneas de referencia
      refs.forEach((r, k) => {
        if (!isFinite(r.v)) return;
        const px = x.getPixelForValue(r.v);
        ctx.strokeStyle = k === 0 ? COLOR.tinta : color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(px, a.top - 4); ctx.lineTo(px, a.bottom); ctx.stroke(); ctx.setLineDash([]);
        // etiqueta sobre la línea, una fila por referencia; se corre hacia adentro si se saldría del gráfico
        ctx.fillStyle = k === 0 ? COLOR.tinta : color; ctx.font = '600 11.5px ' + Chart.defaults.font.family;
        const texto = `${r.nombre}: ${ind.formato(r.v)}`, ancho = ctx.measureText(texto).width;
        const xt = Math.min(Math.max(px, a.left + ancho / 2), a.right - ancho / 2);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(texto, xt, a.top - 6 - k * 17);
      });
      // valor al final de cada barra (después del bigote) y n si es poco estable
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      chart.getDatasetMeta(0).data.forEach((barra, j) => {
        const f = filas[j];
        if (!isFinite(f.v)) return;
        const fin = Math.max(barra.x, f.ic && isFinite(f.ic[1]) ? x.getPixelForValue(Math.min(f.ic[1], x.max)) : barra.x);
        ctx.font = '600 11.5px ' + Chart.defaults.font.family; ctx.fillStyle = f.pocos && ind.proporcion ? COLOR.texto : COLOR.tinta;
        const texto = ind.formato(f.v) + (f.pocos && ind.proporcion ? `  (n = ${f.r.egresos})` : '');
        ctx.fillText(texto, fin + 6, barra.y);
      });
      ctx.restore();
    },
  };
  dibujarGrafico('g-t-mort', {
    type: 'bar',
    data: { labels: filas.map(f => DATOS.regiones[f.c] + (!estado.zona && estado.ordenTerritorio === 'valor'
              ? ` (${ZONAS[ZONA_DE_REGION[f.c]].nombre.toLowerCase()})` : '')),
            datasets: [{ data: filas.map(f => (isFinite(f.v) ? f.v : null)), borderRadius: 4, barPercentage: 0.72,
                         backgroundColor: filas.map(f => (f.pocos && ind.proporcion ? mezclar(COLOR.tarjeta, color, 0.3)
                           : estado.region === f.c ? COLOR.naranjo : color)),
                         borderColor: filas.map(f => (estado.region === f.c ? COLOR.tinta : 'transparent')), borderWidth: 1.5 }] },
    options: {
      indexAxis: 'y', maintainAspectRatio: false, animation: false,
      layout: { padding: { right: 90, top: refs.length > 1 ? 44 : 24 } },   // espacio para las etiquetas de referencia
      scales: { x: { ...ejeLimpio(), beginAtZero: true, max: maxX, ticks: { callback: v => ind.formato(v) } },
                y: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: false } } },
      plugins: { legend: { display: false }, etiquetasBarras: { mostrar: false },
                 tooltip: { callbacks: { label: c => {   // incluye el IC completo aunque el bigote se recorte
                   const f = filas[c.dataIndex];
                   return [`${ind.nombre}: ${ind.formato(f.v)} (${fmtEntero(f.r.egresos)} egresos)`]
                     .concat(f.ic ? [`Margen de error (IC 95 %): ${fmtDec(f.ic[0], 0)} a ${fmtDec(f.ic[1], 0)} %`] : [])
                     .concat(f.pocos && ind.proporcion ? ['Pocos egresos: cifra inestable'] : []);
                 } } } },
      onClick: (ev, el) => { if (el.length) elegirRegion(filas[el[0].index].c); },
    },
    plugins: [decoracion],
  });
  document.querySelector('#territorio .alto-t-mort').style.height = (70 + regiones.length * 32) + 'px';

  // Detalle por región
  const total = pais.egresos;
  let html = '<tr><th>Región</th><th>Egresos</th><th>% del país</th><th>Pacientes</th><th>Mortalidad</th>' +
             '<th>Oncología</th><th>Estancia</th><th>Sev. 3</th><th>Peso</th></tr>';
  const fila = (nombre, r, clase, atributos) => {
    const e = mediana(r.estadas);
    return `<tr class="${clase}" ${atributos}><td>${nombre}</td><td>${fmtEntero(r.egresos)}</td>` +
      `<td>${total ? fmtDec(r.egresos / total * 100, 1) + ' %' : '–'}</td><td>${fmtEntero(r.pacientes.size)}</td>` +
      `<td class="${r.egresos < MIN_ESTABLE ? 'poco' : ''}">${textoMort(r)}</td>` +
      `<td class="${r.egresos < MIN_ESTABLE ? 'poco' : ''}">${r.egresos ? fmtDec(r.onco / r.egresos * 100) + ' %' : '–'}</td>` +
      `<td>${isFinite(e) ? fmtDec(e, 0) + ' d' : '–'}</td>` +
      `<td>${r.egresos ? fmtDec(r.sev3 / r.egresos * 100) + ' %' : '–'}</td>` +
      `<td>${r.egresos ? fmtDec(r.peso / r.egresos / 100, 2) : '–'}</td></tr>`;
  };
  for (const [z, d] of Object.entries(ZONAS)) {
    if (estado.zona && estado.zona !== z) continue;
    html += fila(d.nombre, porZona[z], `fila-zona ${estado.zona === z ? 'elegida' : ''}`, `data-zona="${z}"`);
    for (const c of d.regiones) {
      html += fila(DATOS.regiones[c], porRegion[c] || nuevoResumen(), estado.region === c ? 'elegida' : '', `data-region="${c}"`);
    }
  }
  if (!estado.zona) html += fila('Chile', pais, 'fila-total', '');
  const tabla = document.getElementById('t-tabla');
  tabla.innerHTML = html;
  tabla.querySelectorAll('tr[data-region]').forEach(tr =>
    tr.addEventListener('click', () => elegirRegion(parseInt(tr.dataset.region, 10))));
  tabla.querySelectorAll('tr[data-zona]').forEach(tr => tr.addEventListener('click', () => elegirZona(tr.dataset.zona)));
}

// ---------------------------------------------------------------- pestaña Comparaciones
// Las tres zonas lado a lado, con los filtros de Inicio salvo zona y región (se comparan todas).
// Barra violeta: CUP; barra gris: los 5 metastásicos juntos.
function graficoZonas(id, cup, met, valor, formato, eje) {
  const nombres = Object.values(ZONAS).map(d => d.nombre);
  const claves = Object.keys(ZONAS);
  dibujarGrafico(id, {
    type: 'bar',
    data: { labels: nombres, datasets: [
      { label: 'CUP', data: claves.map(z => valor(cup.porZona[z])), n: claves.map(z => cup.porZona[z].egresos),
        backgroundColor: COLOR.violeta, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7 },
      { label: 'Metastásicos (5)', data: claves.map(z => valor(met.porZona[z])), n: claves.map(z => met.porZona[z].egresos),
        backgroundColor: COLOR.gris, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7 },
    ] },
    options: {
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      scales: { y: { ...ejeLimpio(), beginAtZero: true, grace: '18%', ticks: { callback: eje } }, x: { grid: { display: false } } },
      plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10 } },
                 tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formato(c.raw)} (${fmtEntero(c.dataset.n[c.dataIndex])} egresos)` } },
                 etiquetasBarras: { mostrar: true, formato } },
    },
  });
}

function actualizarComparaciones() {
  const cup = resumenTerritorio(), met = resumenTerritorio({ grupo: 'met' });
  const mort = r => (r.egresos >= MIN_ESTABLE ? mortalidadDe(r) : null);
  const est = r => (r.egresos ? mediana(r.estadas) : null);
  const peso = r => (r.egresos ? r.peso / r.egresos / 100 : null);
  document.getElementById('c-titulo').innerHTML = `Norte, centro y sur lado a lado <span>· ${textoPeriodo()}</span>`;
  graficoZonas('g-c-mort', cup, met, mort, v => fmtDec(v) + ' %', v => fmtEntero(v) + ' %');
  graficoZonas('g-c-estancia', cup, met, est, v => fmtDec(v, 0) + ' d', v => fmtEntero(v) + ' d');
  graficoZonas('g-c-peso', cup, met, peso, v => fmtDec(v, 2), v => fmtDec(v, 1));

  // Egresos CUP por año en cada zona (todos los años, para ver la tendencia)
  const todos = { desde: ANIOS[0], hasta: ANIOS[ANIOS.length - 1] };
  const porAnio = {};
  for (const z of Object.keys(ZONAS)) porAnio[z] = ANIOS.map(() => 0);
  for (const i of filtrarEgresos({ ignorarRegion: true, periodo: todos })) {
    const z = ZONA_DE_REGION[E.region[i]];
    if (z) porAnio[z][ANIOS.indexOf(E.anio[i])]++;
  }
  const trazos = [[], [6, 4], [2, 3]];   // la línea también se distingue sin color
  dibujarGrafico('g-c-anios', {
    type: 'line',
    data: { labels: ANIOS, datasets: Object.entries(ZONAS).map(([z, d], k) => ({
      label: d.nombre, data: porAnio[z], borderColor: COLOR.zonas[k], backgroundColor: COLOR.zonas[k],
      borderWidth: 2.5, borderDash: trazos[k], pointRadius: 3.5, pointStyle: ['circle', 'rect', 'triangle'][k], tension: 0 })) },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: { y: { ...ejeLimpio(), beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
      plugins: { legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyleWidth: 10, boxHeight: 7 } } },
    },
  });

  // Tabla: CUP frente a metastásicos en cada zona
  let html = '<tr><th>Zona</th><th>Egresos CUP</th><th>Pacientes CUP</th><th>Mortalidad CUP</th><th>Mortalidad metastásicos</th>' +
             '<th>Diferencia</th><th>Estancia CUP</th><th>Sev. 3 CUP</th></tr>';
  for (const [z, d] of Object.entries(ZONAS)) {
    const c = cup.porZona[z], m = met.porZona[z];
    const dif = c.egresos && m.egresos ? mortalidadDe(c) - mortalidadDe(m) : NaN;
    const e = mediana(c.estadas);
    html += `<tr class="${estado.zona === z ? 'elegida' : ''}"><td><span class="punto-grupo" style="background:${COLOR.zonas[Object.keys(ZONAS).indexOf(z)]}"></span>${d.nombre}</td>` +
      `<td>${fmtEntero(c.egresos)}</td><td>${fmtEntero(c.pacientes.size)}</td>` +
      `<td class="${c.egresos < MIN_ESTABLE ? 'poco' : ''}">${textoMort(c)}</td><td>${textoMort(m)}</td>` +
      `<td>${isFinite(dif) ? (dif >= 0 ? '+' : '−') + fmtDec(Math.abs(dif)) + ' pts' : '–'}</td>` +
      `<td>${isFinite(e) ? fmtDec(e, 0) + ' d' : '–'}</td><td>${c.egresos ? fmtDec(c.sev3 / c.egresos * 100) + ' %' : '–'}</td></tr>`;
  }
  document.getElementById('c-tabla').innerHTML = html;
}

function conectarPestanasZona() {
  document.querySelectorAll('#t-zonas .boton-vista').forEach(b => b.addEventListener('click', () => elegirZona(b.dataset.zona, false)));
  document.querySelectorAll('#t-indicador .boton-vista').forEach(b => b.addEventListener('click', () => {
    estado.indicadorMapa = b.dataset.indicador;
    actualizarTerritorio();
  }));
  document.querySelectorAll('#t-orden .boton-vista').forEach(b => b.addEventListener('click', () => {
    estado.ordenTerritorio = b.dataset.orden;
    actualizarTerritorio();
  }));
  // Aviso de pocos egresos: pasa el filtro de años a todo el período (2019–2025)
  document.getElementById('t-ver-todo').addEventListener('click', () => {
    estado.anioDesde = ANIOS[0];
    estado.anioHasta = ANIOS[ANIOS.length - 1];
    document.getElementById('f-anio-desde').value = estado.anioDesde;
    document.getElementById('f-anio-hasta').value = estado.anioHasta;
    actualizarTodo();
  });
}

// ---------------------------------------------------------------- tabla comparativa
let filasTabla = [];   // se guarda para el CSV

function actualizarTabla() {
  const anterior = periodoAnterior();
  const nombreCUP = estado.diagnostico === 'c809' ? 'CUP (C80.0 + C80.9)' : 'CUP';
  const grupos = [{ nombre: nombreCUP, grupo: 'cup' }].concat(
    DATOS.grupos.slice(2).map((g, k) => ({ nombre: g, grupo: k + 2 })));

  filasTabla = grupos.map(g => {
    const k = calcularKPI(filtrarEgresos({ grupo: g.grupo }));
    const kAnt = anterior ? calcularKPI(filtrarEgresos({ grupo: g.grupo, periodo: anterior })) : null;
    // diferencia porcentual de egresos frente al período anterior del mismo largo
    return { ...g, ...k, difPct: kAnt && kAnt.egresos ? (k.egresos / kAnt.egresos - 1) * 100 : NaN };
  });
  // CUP primero y los demás ordenados por mortalidad (como en el boceto)
  const resto = filasTabla.slice(1).sort((a, b) => (b.mortalidad || 0) - (a.mortalidad || 0));
  filasTabla = [filasTabla[0]].concat(resto);

  let html = '<tr><th>Grupo</th><th>Egresos</th><th title="Diferencia porcentual de egresos frente al período anterior">Dif. %</th>' +
             '<th>Mortalidad</th><th>Estancia</th><th>Sev. 3</th><th>Ch. ≥ 2</th><th>Peso</th></tr>';
  for (const f of filasTabla) {
    const vacio = f.egresos === 0;
    const color = COLOR.grupos[f.grupo === 'cup' ? 0 : f.grupo];
    html += `<tr class="${f.grupo === 'cup' ? 'fila-cup' : ''}"><td><span class="punto-grupo" style="background:${color}"></span>` +
      `${f.nombre}</td><td>${fmtEntero(f.egresos)}</td>` +
      `<td>${isFinite(f.difPct) ? (f.difPct >= 0 ? '+' : '−') + fmtDec(Math.abs(f.difPct)) + ' %' : '–'}</td>` +
      `<td>${vacio ? '–' : fmtDec(f.mortalidad) + ' %'}</td><td>${vacio ? '–' : fmtDec(f.estada, 0) + ' d'}</td>` +
      `<td>${vacio ? '–' : fmtDec(f.sev3) + ' %'}</td><td>${vacio ? '–' : fmtDec(f.charlson2) + ' %'}</td>` +
      `<td>${vacio ? '–' : fmtDec(f.peso, 2)}</td></tr>`;
  }
  document.getElementById('tabla-comparacion').innerHTML = html;
  document.getElementById('nota-tabla').textContent = `Egresos ${textoPeriodo()} por grupo · ordenado por mortalidad`;
}

// Separador ";" y BOM para que Excel en español lo abra bien
function bajarCSV(nombre, filas) {
  const blob = new Blob(['﻿' + filas.map(f => f.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

const periodoArchivo = () => textoPeriodo().replace('–', '-');

function descargarCSV() {
  const enc = ['Grupo', 'Egresos', 'Diferencia_porcentual_egresos_%', 'Mortalidad_%', 'Estancia_mediana_dias', 'Severidad3_%',
               'Charlson_2_o_mas_%', 'Peso_GRD'];
  bajarCSV(`comparacion_cup_${periodoArchivo()}.csv`, [enc].concat(filasTabla.map(f => [
    f.nombre, f.egresos, isFinite(f.difPct) ? fmtDec(f.difPct) : '', isFinite(f.mortalidad) ? fmtDec(f.mortalidad) : '',
    isFinite(f.estada) ? f.estada : '', isFinite(f.sev3) ? fmtDec(f.sev3) : '',
    isFinite(f.charlson2) ? fmtDec(f.charlson2) : '', isFinite(f.peso) ? fmtDec(f.peso, 2) : '',
  ])));
}

// ---------------------------------------------------------------- pestaña Descargas
const SEXOS = ['Hombre', 'Mujer'];
const COLUMNAS_EGRESO = ['Año', 'Mes_alta', 'Grupo', 'Región', 'Servicio_Salud', 'Codigo_hospital', 'Hospital', 'Sexo',
                         'Tramo_edad', 'Tipo_ingreso', 'Fallece', 'Estancia_dias', 'Peso_GRD', 'Severidad_3',
                         'Sitios_metastasis', 'Comorbilidades', 'Charlson'];

function filaEgreso(i) {
  const sitios = DATOS.sitios.filter((s, b) => E.sitios[i] & (1 << b)).join(' | ');
  const comorb = DATOS.comorbilidades.filter((c, b) => E.comorb[i] & (1 << b)).join(' | ');
  const hospital = DATOS.hospitales[E.hospital[i]] || { codigo: '', nombre: '' };
  return [
    E.anio[i], E.mes[i] || '', DATOS.grupos[E.grupo[i]], DATOS.regiones[E.region[i]] || '',
    E.servicio[i] >= 0 ? DATOS.servicios[E.servicio[i]].nombre : '', hospital.codigo, hospital.nombre,
    SEXOS[E.sexo[i]] || '',
    DATOS.tramos[E.tramo[i]] || '', DATOS.ingresos[E.ingreso[i]] || '', E.fallece[i], E.estada[i],
    fmtDec(E.peso[i] / 100, 2), E.sev3[i], sitios, comorb, E.charlson[i],
  ];
}

const grupoDescarga = () => document.querySelector('input[name="d-grupo"]:checked').value;

function egresosDescarga() {
  const indices = filtrarEgresos();
  if (grupoDescarga() === 'todos') indices.push(...filtrarEgresos({ grupo: 'met' }));
  return indices.sort((a, b) => a - b);
}

function filtrosActivos() {
  return [
    ['Años', textoPeriodo(), estado.anioDesde !== ANIOS[0] || estado.anioHasta !== ANIOS[ANIOS.length - 1]],
    ['Zona', estado.zona ? ZONAS[estado.zona].nombre : 'Todas', !!estado.zona],
    ['Región', estado.region ? DATOS.regiones[estado.region] : 'Todas', !!estado.region],
    ['Servicio de Salud', estado.servicio >= 0 ? DATOS.servicios[estado.servicio].nombre : 'Todos', estado.servicio >= 0],
    ['Hospital', estado.hospital >= 0 ? DATOS.hospitales[estado.hospital].nombre : 'Todos', estado.hospital >= 0],
    ['Sexo', estado.sexo >= 0 ? ['Hombres', 'Mujeres'][estado.sexo] : 'Todos', estado.sexo >= 0],
    ['Edad', textoEdad(), !edadCompleta()],
    ['Diagnóstico', estado.diagnostico === 'c809' ? 'C80.0 + C80.9' : 'C80.0', estado.diagnostico === 'c809'],
    ['Tipo de ingreso', estado.ingreso >= 0 ? DATOS.ingresos[estado.ingreso] : 'Todos', estado.ingreso >= 0],
  ];
}

function actualizarDescargas() {
  document.getElementById('chips-filtros').innerHTML = filtrosActivos()
    .map(([nombre, valor, activo]) => `<span class="chip ${activo ? 'activo' : ''}">${nombre}: <b>${valor}</b></span>`).join('');

  const indices = egresosDescarga();
  document.getElementById('resumen-egresos').innerHTML =
    `<b>${fmtEntero(indices.length)}</b> egresos · ${COLUMNAS_EGRESO.length} columnas · vista previa de las primeras filas:`;
  let html = '<tr>' + COLUMNAS_EGRESO.map(c => `<th>${c.replace(/_/g, ' ')}</th>`).join('') + '</tr>';
  for (const i of indices.slice(0, 5)) html += '<tr>' + filaEgreso(i).map(v => `<td>${v}</td>`).join('') + '</tr>';
  document.getElementById('previa-egresos').innerHTML = html;
  document.getElementById('descargar-egresos').disabled = indices.length === 0;
}

function descargarEgresos() {
  const grupo = grupoDescarga() === 'todos' ? 'cup_y_metastasicos' : 'cup';
  bajarCSV(`egresos_${grupo}_${periodoArchivo()}.csv`, [COLUMNAS_EGRESO].concat(egresosDescarga().map(filaEgreso)));
}

// Captura la pestaña Inicio (html2canvas) y la guarda como PDF de una sola página del mismo tamaño (jsPDF)
async function guardarPDF() {
  const boton = document.getElementById('descargar-pdf');
  const textoBoton = boton.innerHTML;
  boton.disabled = true;
  boton.textContent = 'Generando PDF…';
  irA('inicio');
  // Al mostrarse la pestaña Chart.js redibuja con animación: se fuerza el dibujo final antes de capturar
  await new Promise(r => setTimeout(r, 50));
  Object.values(graficos).forEach(g => { g.resize(); g.update('none'); });
  try {
    const lienzo = await html2canvas(document.body, {
      scale: 2, backgroundColor: getComputedStyle(document.body).backgroundColor,
      windowWidth: document.documentElement.scrollWidth,
      ignoreElements: el => el.id === 'tooltip-mapa' || el.id === 'tooltip-ayuda' || el.classList.contains('creditos') ||
                            el.id === 'descargar' || el.id === 'alto-contraste' || el.classList.contains('ayuda'),
      onclone: doc => {
        // html2canvas no aplica el CSS a los SVG: se copia el estilo de los íconos como atributos
        doc.querySelectorAll('svg').forEach(svg => {
          if (svg.closest('#mapa')) return;
          const css = doc.defaultView.getComputedStyle(svg);
          svg.setAttribute('width', css.width);
          svg.setAttribute('height', css.height);
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', css.color);
          svg.setAttribute('stroke-width', '2');
          svg.setAttribute('stroke-linecap', 'round');
          svg.setAttribute('stroke-linejoin', 'round');
        });
      },
    });
    const ancho = 297, alto = ancho * lienzo.height / lienzo.width;   // mm: ancho A4 horizontal, alto proporcional
    const pdf = new jspdf.jsPDF({ orientation: alto > ancho ? 'portrait' : 'landscape', unit: 'mm', format: [ancho, alto] });
    pdf.addImage(lienzo.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, ancho, alto);
    pdf.save(`dashboard_cup_${periodoArchivo()}.pdf`);
  } finally {
    irA('descargas');
    boton.innerHTML = textoBoton;
    boton.disabled = false;
  }
}

// ---------------------------------------------------------------- pestaña Análisis: modelo de estadía
// Regresión lineal de log(1 + días) ajustada en el notebook (P13). No depende de los filtros de Inicio.
// Estadía esperada = e^(b0 + Σ b·x) · smearing − 1; las categorías de referencia no tienen coeficiente (aportan 0).
const MODELO = DATOS.modelo;
const COEF = MODELO ? Object.fromEntries(MODELO.coeficientes.map(c => [c.variable, c])) : {};

// El formulario se arma con MODELO.entradas (lo define el notebook): categorica = un selector y suma el coeficiente
// "VARIABLE: valor"; binaria = un selector 0/1 que multiplica el coeficiente; casillas = suma cada casilla marcada.
function predecirEstadia(perfil) {
  const b = v => (COEF[v] ? COEF[v].b : 0);
  let z = MODELO.intercepto;
  for (const e of MODELO.entradas) {
    if (e.tipo === 'categorica') z += b(`${e.variable}: ${perfil[e.variable]}`);
    else if (e.tipo === 'binaria') z += perfil[e.variable] * b(e.variable);
  }
  for (const v of perfil.casillas) z += b(v);
  return Math.exp(z) * MODELO.smearing - 1;
}

function perfilCalculadora() {
  const perfil = { casillas: [...document.querySelectorAll('#calculadora input:checked')].map(c => c.value) };
  document.querySelectorAll('#calculadora select').forEach(sel => {
    perfil[sel.dataset.variable] = sel.dataset.tipo === 'binaria' ? parseInt(sel.value, 10) : sel.value;
  });
  return perfil;
}

function llenarCalculadora() {
  if (!MODELO || !MODELO.entradas) {
    document.getElementById('contenido-modelo').innerHTML =
      '<p class="nota">Falta el modelo: ejecutar el notebook (pregunta P13) y luego <code>python preparar_datos.py</code>.</p>';
    return false;
  }
  const campos = document.getElementById('campos-calculadora');
  const casillas = document.getElementById('casillas-calculadora');
  for (const e of MODELO.entradas) {
    if (e.tipo === 'casillas') {
      casillas.insertAdjacentHTML('beforeend', `<fieldset class="casillas"><legend>${e.nombre}</legend>` +
        e.opciones.map(([valor, texto]) => `<label><input type="checkbox" value="${valor}"> ${texto}</label>`).join('') +
        '</fieldset>');
      continue;
    }
    const etiqueta = document.createElement('label');
    etiqueta.textContent = e.nombre;
    const sel = document.createElement('select');
    sel.dataset.variable = e.variable;
    sel.dataset.tipo = e.tipo;
    e.opciones.forEach(([valor, texto]) => sel.add(new Option(texto, valor)));
    sel.value = e.defecto;
    etiqueta.append(sel);
    campos.append(etiqueta);
  }
  document.getElementById('calculadora').addEventListener('change', actualizarCalculadora);
  return true;
}

function actualizarCalculadora() {
  const perfil = perfilCalculadora();
  const dias = predecirEstadia(perfil);
  const grupos = MODELO.entradas.find(e => e.variable === 'GRUPO').opciones.map(([g]) => g);
  const porGrupo = grupos.map(g => ({ grupo: g, dias: predecirEstadia({ ...perfil, GRUPO: g }) }));
  const cup = porGrupo.find(g => g.grupo === 'CUP').dias;
  const otros = porGrupo.filter(g => g.grupo !== 'CUP').map(g => g.dias);
  const comparacion = perfil.GRUPO === 'CUP'
    ? `Con el mismo perfil, un cáncer metastásico de primario conocido estaría entre ${fmtDec(Math.min(...otros))} y ${fmtDec(Math.max(...otros))} días.`
    : `Con el mismo perfil, un paciente CUP estaría ${fmtDec(cup)} días (${cup >= dias ? '+' : '−'}${fmtDec(Math.abs(cup / dias - 1) * 100, 0)} %).`;
  document.getElementById('c-resultado').innerHTML =
    `<span class="etiqueta">Estadía esperada</span><div class="kpi-valor">${fmtDec(dias)} días</div>` +
    `<p>${comparacion}</p>`;

  const indiceGrupo = g => DATOS.grupos.indexOf(g);
  dibujarGrafico('g-perfil', {
    type: 'bar',
    data: { labels: porGrupo.map(g => g.grupo),
            datasets: [{ data: porGrupo.map(g => g.dias), borderRadius: 4, barPercentage: 0.7,
                         backgroundColor: porGrupo.map(g => COLOR.grupos[indiceGrupo(g.grupo)]) }] },
    options: {
      indexAxis: 'y', maintainAspectRatio: false,
      layout: { padding: { right: 44 } },
      scales: { x: { ...ejeLimpio(), beginAtZero: true, ticks: { callback: v => fmtEntero(v) + ' d' } },
                y: { grid: { display: false }, border: { display: false } } },
      plugins: { legend: { display: false },
                 tooltip: { callbacks: { label: c => `${fmtDec(c.raw)} días` } },
                 etiquetasBarras: { mostrar: true, formato: v => fmtDec(v) + ' d' } },
    },
  });
}

// Mapa de calor de las correlaciones (triángulo inferior). Color: azul negativo, gris 0, rojo positivo (|r| ≥ 0,7 = tope).
function mezclar(hex1, hex2, t) {
  const rgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const a = rgb(hex1), b = rgb(hex2);
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * t)).join(',')})`;
}

function mapaCorrelaciones() {
  const { variables, matriz } = MODELO.correlaciones;
  const [neg, medio, pos] = COLOR.diverge;
  const celda = r => (r < 0 ? mezclar(medio, neg, Math.min(-r / 0.7, 1)) : mezclar(medio, pos, Math.min(r / 0.7, 1)));
  const texto = r => (Math.abs(r) < 0.005 ? '0' : fmtDec(r, 2).replace('0,', ',').replace('-', '−'));
  let html = '<tbody>';
  for (let i = 1; i < variables.length; i++) {
    html += `<tr><th scope="row">${variables[i]}</th>`;
    for (let j = 0; j < variables.length - 1; j++) {
      if (j >= i) { html += '<td class="vacia"></td>'; continue; }
      const r = matriz[i][j];
      html += `<td style="background:${celda(r)};color:${Math.abs(r) > 0.45 ? '#fff' : COLOR.tinta}"` +
              ` class="${j === 0 ? 'con-estadia' : ''}" title="${variables[i]} × ${variables[j]}: r = ${texto(r)}">${texto(r)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody><tfoot><tr><th></th>' +
    variables.slice(0, -1).map((v, j) => `<th class="${j === 0 ? 'con-estadia' : ''}"><span>${v}</span></th>`).join('') + '</tr></tfoot>';
  document.getElementById('mapa-correlaciones').innerHTML = html;
}

// % de cambio en la estadía de cada variable; las que pasan de 100 % se cortan en el eje y se escribe su valor real
const TOPE_COEF = 100;

function graficoCoeficientes() {
  const filas = MODELO.coeficientes.map(c => ({ ...c, cambio: (Math.exp(c.b) - 1) * 100 }))
    .sort((a, b) => b.cambio - a.cambio);
  const color = f => (f.p >= 0.05 ? COLOR.gris : f.cambio > 0 ? COLOR.naranjo : COLOR.azul);
  const pct = x => `${Math.round(x) === 0 ? '' : x > 0 ? '+' : '−'}${fmtDec(Math.abs(x), 0)} %`;
  dibujarGrafico('g-coef', {
    type: 'bar',
    data: { labels: filas.map(f => f.nombre),
            datasets: [{ data: filas.map(f => Math.min(f.cambio, TOPE_COEF)), backgroundColor: filas.map(color),
                         borderRadius: 3, barPercentage: 0.75 }] },
    options: {
      indexAxis: 'y', maintainAspectRatio: false,
      layout: { padding: { right: 72 } },
      scales: { x: { ...ejeLimpio(), min: -50, max: TOPE_COEF, ticks: { callback: v => fmtEntero(v) + ' %' } },
                y: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: false, font: { size: 11.5 } } } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => {
          const f = filas[c.dataIndex];
          return [`Cambio en la estadía: ${pct(f.cambio)}`,
                  `IC 95 %: ${pct((Math.exp(f.inf) - 1) * 100)} a ${pct((Math.exp(f.sup) - 1) * 100)}`,
                  f.p < 0.05 ? 'Diferencia significativa' : 'Sin diferencia significativa (p ≥ 0,05)'];
        } } },
        etiquetasBarras: { mostrar: true, formato: (v, j) => pct(filas[j].cambio) + (filas[j].cambio > TOPE_COEF ? ' →' : '') },
      },
    },
  });
}

function mostrarCalidadModelo() {
  const m = MODELO.metricas;
  document.getElementById('calidad-modelo').innerHTML = [
    ['R² (escala log)', fmtDec(m.R2_log, 2), `explica el ${fmtDec(m.R2_log * 100, 0)} % de la variación (primer modelo: ` +
     `${fmtDec(m.R2_log_modelo_anterior, 2)}); en días, ${fmtDec(m.R2_dias, 2)}`],
    ['Error absoluto medio', `${fmtDec(m.MAE_dias)} días`, `sin modelo (mediana para todos): ${fmtDec(m.MAE_dias_sin_modelo)} días`],
    ['Egresos', fmtEntero(MODELO.n_entrenamiento + MODELO.n_prueba),
     `${fmtEntero(MODELO.n_entrenamiento)} para ajustar y ${fmtEntero(MODELO.n_prueba)} para evaluar`],
  ].map(([nombre, valor, detalle]) =>
    `<div><span class="kpi-nombre">${nombre}</span><div class="kpi-valor">${valor}</div><div class="kpi-ref">${detalle}</div></div>`).join('');
}

function dibujarModelo() {
  if (!MODELO) return;
  actualizarCalculadora();
  graficoCoeficientes();
  mapaCorrelaciones();
}

// ---------------------------------------------------------------- alto contraste
// La preferencia se guarda en el navegador; sin preferencia guardada se sigue la del sistema (prefers-contrast).
// index.html ya marca <html data-contraste> antes de dibujar, para que no parpadee.
const CLAVE_CONTRASTE = 'dashboard-cup-contraste';
const altoContraste = () => document.documentElement.dataset.contraste === 'alto';

function conectarContraste() {
  const boton = document.getElementById('alto-contraste');
  boton.setAttribute('aria-pressed', String(altoContraste()));
  boton.addEventListener('click', () => {
    const alto = !altoContraste();
    document.documentElement.dataset.contraste = alto ? 'alto' : 'normal';
    boton.setAttribute('aria-pressed', String(alto));
    try { localStorage.setItem(CLAVE_CONTRASTE, alto ? 'alto' : 'normal'); } catch (e) { /* sin almacenamiento */ }
    leerColores();
    actualizarTodo();
    dibujarModelo();
  });
}

// ---------------------------------------------------------------- pacientes únicos frente a egresos
// Total del CUP (C80.0) 2019–2025: pacientes contados una vez en todo el período y la suma de los conteos de cada año.
const RESUMEN_PACIENTES = (() => {
  const total = new Set(), porAnio = {};
  let egresos = 0;
  for (let i = 0; i < N; i++) {
    if (E.grupo[i] !== G_CUP) continue;
    egresos++;
    total.add(E.paciente[i]);
    (porAnio[E.anio[i]] = porAnio[E.anio[i]] || new Set()).add(E.paciente[i]);
  }
  const suma = Object.values(porAnio).reduce((s, c) => s + c.size, 0);
  return { egresos, pacientes: total.size, sumaAnios: suma, desde: ANIOS[0], hasta: ANIOS[ANIOS.length - 1] };
})();

function textoPacientesTotal() {
  const r = RESUMEN_PACIENTES;
  return `en ${r.desde}–${r.hasta} hay ${fmtEntero(r.egresos)} egresos CUP de ${fmtEntero(r.pacientes)} pacientes ` +
    `(${fmtDec(r.egresos / r.pacientes, 2)} egresos por paciente); sumando los pacientes de cada año serían ` +
    `${fmtEntero(r.sumaAnios)}, porque quien se hospitaliza en dos años distintos se contaría dos veces.`;
}

// ---------------------------------------------------------------- ayudas (hover)
// Cada elemento con data-ayuda recibe un botón (i). Al pasar el mouse o enfocarlo con el teclado se muestra qué mide
// la variable y cómo se calcula. Los textos van aquí para mantenerlos juntos y revisarlos de una vez.
const AYUDA = {
  zona: ['Zona', 'Agrupa las 16 regiones en tres zonas, según la región del hospital. <b>Norte:</b> Arica y Parinacota, ' +
    'Tarapacá, Antofagasta, Atacama y Coquimbo. <b>Centro:</b> Valparaíso, Metropolitana, O\'Higgins y Maule. ' +
    '<b>Sur:</b> Ñuble, Biobío, La Araucanía, Los Ríos, Los Lagos, Aysén y Magallanes.'],
  edadFiltro: ['Edad', 'Edad al ingreso, en tramos de 10 años. Restricción de datos (0–18 años): el estudio incluye solo ' +
    'a pacientes de 18 años o más.'],
  diagnostico: ['Diagnóstico CIE-10', '<b>C80.0:</b> tumor maligno de sitio primario desconocido, el CUP del estudio. ' +
    '<b>C80.0 + C80.9:</b> suma el tumor maligno sin especificar (C80.9), solo como análisis de sensibilidad.'],
  ingreso: ['Tipo de ingreso', '<b>Urgencia:</b> la hospitalización empieza en la urgencia. <b>Programada:</b> fue agendada ' +
    '(por ejemplo, para un tratamiento o un estudio).'],
  egresos: ['Egresos CUP', 'Hospitalizaciones que terminaron en el período (alta o muerte) con el código C80.0 en ' +
    'cualquiera de los 35 diagnósticos. Un paciente que se hospitaliza dos veces suma dos egresos. Debajo, la diferencia ' +
    'porcentual frente al período anterior del mismo largo.'],
  pacientes: ['Pacientes únicos', () => 'Personas distintas detrás de los egresos, contadas una sola vez por su ID cifrado ' +
    'en todo el período elegido. Por eso es menor que los egresos: ' + textoPacientesTotal() +
    ' <b>Límite:</b> el ID cambia entre 2020 y 2021; en un rango que cruce ese corte, un paciente puede contarse dos veces.'],
  mortalidad: ['Mortalidad hospitalaria', 'Egresos que terminan con el paciente fallecido, de cada 100. Solo cuenta las ' +
    'muertes dentro del hospital. La diferencia con el período anterior va en puntos porcentuales: en naranjo si sube.'],
  estancia: ['Estancia mediana', 'Días entre el ingreso y el alta. Se usa la mediana (la mitad de los pacientes estuvo ' +
    'menos días) porque unas pocas estadías muy largas inflarían el promedio.'],
  peso: ['Peso GRD medio', 'Recursos que consume la hospitalización según la clasificación GRD, comparada con una ' +
    'hospitalización promedio (peso 1). Un peso de 1,5 consume 50 % más que el promedio.'],
  sitios: ['Sitios de metástasis', 'Lugar del cuerpo donde está la metástasis, según los códigos C77 a C79 de cualquier ' +
    'diagnóstico. Un egreso puede tener varios sitios, así que las barras suman más que el total. Solo CUP: N° de ' +
    'egresos. CUP vs. metastásicos: % de los egresos de cada grupo.'],
  mensual: ['Evolución mensual', 'N° de egresos según el mes del alta. Con un solo año, la línea gris punteada es el año ' +
    'anterior. Con varios años, la serie sigue mes a mes.'],
  sexo: ['Distribución por sexo', 'Sexo registrado en el egreso. El porcentaje se calcula sobre los egresos con sexo ' +
    'informado.'],
  edad: ['Distribución por edad', 'Edad al ingreso en tramos de 10 años. En 2025 la base solo trae tramos de 5 años: se ' +
    'usa el punto medio del tramo. Solo adultos (restricción de datos de 0 a 18 años).'],
  tabla: ['Comparación con metastásicos', '<b>Metastásico:</b> cáncer de pulmón, colorrectal, mama, próstata o gástrico ' +
    'con un código de metástasis (C77–C79). <b>Dif. %:</b> (egresos del período − egresos del período anterior) ÷ ' +
    'egresos del período anterior × 100. <b>Sev. 3:</b> % con la severidad GRD máxima. <b>Ch. ≥ 2:</b> % con índice ' +
    'de Charlson de 2 o más. <b>Peso:</b> peso GRD medio.'],
  comorb: ['Comorbilidades', '<b>Comorbilidad:</b> enfermedad crónica que el paciente tiene además del cáncer y que no ' +
    'es el motivo de la hospitalización. Se cuenta si su código CIE-10 aparece en los diagnósticos 2 a 35 (el 1 es el ' +
    'motivo). El cáncer y sus metástasis no se cuentan. Se miden 10 enfermedades; un egreso puede tener varias.'],
  mortcomorb: ['Mortalidad según comorbilidad', 'De cada 100 egresos que tienen esa enfermedad, cuántos mueren en el ' +
    'hospital. "Sin ninguna de las 10" es la referencia para comparar. No está ajustada por edad ni gravedad. Con menos ' +
    'de 30 egresos no se dibuja la barra.'],
  charlson: ['Índice de Charlson', 'Resume en un número la carga de enfermedades crónicas: suma 1, 2, 3 o 6 puntos por ' +
    'cada una según su gravedad (códigos de Quan, 2005). No cuenta el cáncer ni la metástasis, porque todos los ' +
    'pacientes los tienen. 0 puntos = ninguna enfermedad del índice.'],
  territorio: ['Mapa por región', 'Color según el indicador elegido: mortalidad, alta por oncología (de cada 100 egresos ' +
    'CUP, oncología es la especialidad que da el alta), estancia mediana o N° de egresos. Con el filtro Zona, el mapa muestra y acerca solo las regiones de esa zona; sin zona, ' +
    'las líneas punteadas separan el norte, el centro y el sur. La región es la del hospital (según el DEIS), no la del domicilio del paciente.'],
  regiones: ['Comparación por región', 'Valor de cada región para el indicador elegido. <b>Bigote:</b> margen de error ' +
    '(intervalo de confianza del 95 %, Wilson): con pocos egresos es ancho porque la cifra cambia mucho por azar. ' +
    '<b>Barra pálida:</b> menos de 30 egresos. <b>Línea punteada:</b> el valor de Chile (y de la zona). Una región se aleja ' +
    'del país más allá del azar cuando su bigote no toca la línea de Chile. Sin ajustar por edad ni gravedad.'],
  calculadora: ['Calculadora de estadía', 'Usa la regresión lineal de la pregunta P13 del notebook: suma el efecto de ' +
    'cada característica elegida y devuelve los días promedio de un paciente con ese perfil. No es un pronóstico ' +
    'individual.'],
  coeficientes: ['Qué alarga la estadía', 'Cada barra es el % de cambio en los días de estadía al tener esa ' +
    'característica, con todo lo demás igual, frente a la categoría de referencia. Gris: la diferencia no es ' +
    'significativa (p ≥ 0,05).'],
  calidad: ['Calidad del modelo', '<b>R²:</b> parte de la variación de la estadía que el modelo explica (de 0 a 1). ' +
    '<b>Error absoluto medio:</b> cuántos días se equivoca en promedio con un paciente. Se mide en el 20 % de los ' +
    'egresos que el modelo no usó para ajustarse.'],
  correlaciones: ['Correlaciones', 'Correlación de Pearson entre cada par de variables del ingreso, de −1 a 1. Cerca de ' +
    '0: no se relacionan. Sirvió para elegir las variables del modelo y descartar las que repiten información.'],
};

function conectarAyudas() {
  const tip = document.getElementById('tooltip-ayuda');
  const mostrar = boton => {
    const [titulo, texto] = AYUDA[boton.dataset.clave];
    tip.innerHTML = `<b class="tip-titulo">${titulo}</b>${typeof texto === 'function' ? texto() : texto}`;
    tip.style.display = 'block';
    const caja = boton.getBoundingClientRect();
    const ancho = tip.offsetWidth, alto = tip.offsetHeight;
    let x = Math.min(Math.max(8, caja.left + caja.width / 2 - ancho / 2), window.innerWidth - ancho - 8);
    let y = caja.bottom + 8;
    if (y + alto > window.innerHeight - 8) y = Math.max(8, caja.top - alto - 8);   // sin espacio abajo: arriba
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    boton.setAttribute('aria-describedby', 'tooltip-ayuda');
  };
  const ocultar = boton => { tip.style.display = 'none'; if (boton) boton.removeAttribute('aria-describedby'); };

  document.querySelectorAll('[data-ayuda]').forEach(el => {
    const clave = el.dataset.ayuda;
    if (!AYUDA[clave]) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'ayuda';
    boton.dataset.clave = clave;
    boton.setAttribute('aria-label', `Qué es: ${AYUDA[clave][0]}`);
    boton.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/></svg>';
    el.append(boton);
    boton.addEventListener('mouseenter', () => mostrar(boton));
    boton.addEventListener('focus', () => mostrar(boton));
    boton.addEventListener('mouseleave', () => { if (document.activeElement !== boton) ocultar(boton); });
    boton.addEventListener('blur', () => ocultar(boton));
    // dentro de un <label>, el clic no debe abrir el selector; en pantallas táctiles el clic muestra la ayuda
    boton.addEventListener('click', ev => { ev.preventDefault(); mostrar(boton); });
    boton.addEventListener('keydown', ev => { if (ev.key === 'Escape') ocultar(boton); });
  });
  window.addEventListener('scroll', () => ocultar(document.activeElement), { passive: true });
}

// ---------------------------------------------------------------- inicio
function actualizarTodo() {
  actualizarKPI();
  graficoSitios();
  graficoMensual();
  graficoSexo();
  graficoEdad();
  graficoComorbilidades();
  graficoMortalidadComorb();
  graficoCharlson();
  actualizarTerritorio();
  actualizarTabla();
  actualizarDescargas();
}

leerColores();
llenarFiltros();
conectarFiltros();
conectarContraste();
conectarAyudas();
conectarPestanasZona();
document.getElementById('met-pacientes').textContent = textoPacientesTotal();
actualizarTodo();
if (llenarCalculadora()) {
  mostrarCalidadModelo();
  dibujarModelo();
}
// TODO: versión para celular
