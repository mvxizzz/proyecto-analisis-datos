// Dashboard CUP Chile (v0.2): pestañas Inicio, Análisis (modelo de estadía) y Descargas
// Los datos vienen de datos/datos.js (generado con preparar_datos.py): una posición por egreso en cada arreglo.

const E = DATOS.egresos;
const N = E.anio.length;
const ANIOS = [...new Set(E.anio)].sort();
const G_CUP = 0;          // C80.0
const G_C809 = 1;         // C80.9 (solo si el filtro de diagnóstico lo incluye)
const CODIGO_SITIO = ['C78.7', 'C78.6', 'C78.0', 'C79.5', 'C79.3', 'C77', 'C78.2', 'C79.7'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Los colores se leen de las variables CSS (css/estilos.css), así cambian con el modo de alto contraste.
// gris = contexto (año anterior, referencias); cada grupo tiene su color (COLOR.grupos, en el orden de DATOS.grupos).
// RAMPA_MAPA: más oscuro = más egresos. DIVERGE: azul (negativo), gris (0), rojo (positivo) para las correlaciones.
let COLOR = {};
let RAMPA_MAPA = [];
const CORTES_MAPA = [15, 30, 60];   // cortes como en el boceto de Figma

function leerColores() {
  const css = getComputedStyle(document.documentElement);
  const v = nombre => css.getPropertyValue(nombre).trim();
  COLOR = {
    violeta: v('--violeta'), violetaClaro: v('--violeta-claro'), gris: v('--gris'), grilla: v('--grilla'),
    texto: v('--texto-2'), tinta: v('--tinta'), tarjeta: v('--tarjeta'), naranjo: v('--naranjo'), azul: v('--azul'),
    apagado: v('--apagado'),
    // CUP, CUP potencial (C80.9, mismo color que el CUP), Pulmón, Colorrectal, Mama, Próstata, Gástrico
    grupos: ['cup', 'cup', 'pulmon', 'colorrectal', 'mama', 'prostata', 'gastrico'].map(g => v(`--g-${g}`)),
    diverge: ['neg', 'medio', 'pos'].map(p => v(`--diverge-${p}`)),
  };
  RAMPA_MAPA = [1, 2, 3, 4].map(k => v(`--mapa-${k}`));
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
  region: 0,          // 0 = todas
  servicio: -1,        // -1 = todos
  hospital: -1,        // -1 = todos; índice en DATOS.hospitales
  sexo: -1,
  tramoDesde: 0,       // rango de tramos de edad (ambos incluidos); completo = sin filtro
  tramoHasta: DATOS.tramos.length - 1,
  diagnostico: 'c800', // 'c800' o 'c809' (C80.0 + C80.9)
  ingreso: -1,
  vista: 'cup',        // 'cup' o 'comparar'
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

// Filtros que no son ni año ni grupo (región, servicio, sexo, edad, tipo de ingreso)
// Con un hospital elegido se filtra solo por él: región y servicio ya quedan dados por el hospital
function pasaFiltros(i, ignorarRegion = false) {
  if (estado.hospital >= 0) {
    if (E.hospital[i] !== estado.hospital) return false;
  } else {
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

  const selRegion = document.getElementById('f-region');
  DATOS.ordenRegiones.forEach(c => selRegion.add(new Option(DATOS.regiones[c], c)));

  const edadDesde = document.getElementById('f-edad-desde'), edadHasta = document.getElementById('f-edad-hasta');
  EDAD_DESDE.forEach((t, k) => edadDesde.add(new Option(t, k)));
  EDAD_HASTA.forEach((t, k) => edadHasta.add(new Option(t, k)));
  edadDesde.value = estado.tramoDesde;
  edadHasta.value = estado.tramoHasta;

  llenarServicios();
}

function llenarServicios() {
  const sel = document.getElementById('f-servicio');
  sel.length = 1;   // deja solo "Todos"
  DATOS.servicios.forEach((s, k) => {
    if (!estado.region || s.region === estado.region) sel.add(new Option(s.nombre, k));
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

const hospitalVisible = h => (!estado.region || h.region === estado.region) &&
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
  if (!resultadosHospital.length) html += '<li class="vacio">Sin resultados en la región y servicio elegidos</li>';
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
  document.getElementById('f-diagnostico').addEventListener('change', ev => {
    estado.diagnostico = ev.target.value;
    actualizarTodo();
  });
  for (const [id, vista] of [['vista-cup', 'cup'], ['vista-comparar', 'comparar']]) {
    document.getElementById(id).addEventListener('click', () => {
      estado.vista = vista;
      document.querySelectorAll('.boton-vista').forEach(b => b.classList.toggle('activo', b.id === id));
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

function elegirRegion(codigo) {
  estado.region = estado.region === codigo ? 0 : codigo;   // segundo clic = quitar el filtro
  estado.servicio = -1;
  document.getElementById('f-region').value = estado.region;
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

  // vista comparativa: valor de los 5 metastásicos bajo cada KPI
  const km = estado.vista === 'comparar' ? calcularKPI(filtrarEgresos({ grupo: 'met' })) : null;
  poner('ref-egresos', km ? `Metastásicos: ${fmtEntero(km.egresos)}` : '');
  poner('ref-pacientes', km ? `Metastásicos: ${fmtEntero(km.pacientes)}` : '');
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
  const datasets = comparar ? datasetsComparacion(indices => serie(mortalidadPorComorb(indices)))
    : [{ label: 'CUP', ...serie(cup), borderRadius: 4, barPercentage: 0.75,
         backgroundColor: orden.map(k => (k === n ? COLOR.gris : COLOR.violeta)) }];
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
  const datasets = comparar ? datasetsComparacion(serie)
    : [{ label: 'CUP', ...serie(filtrarEgresos()), backgroundColor: COLOR.violeta, borderRadius: 4, barPercentage: 0.6 }];
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
const LON_MIN = -76, LAT_MAX = -17.3, LAT_MIN = -56, COS = Math.cos(37 * Math.PI / 180);
const proyectar = ([lon, lat]) => [((lon - LON_MIN) * COS * 10).toFixed(1), ((LAT_MAX - lat) * 10).toFixed(1)];

function dibujarMapa(porRegion) {
  const ancho = (9.7 * COS * 10).toFixed(0), alto = ((LAT_MAX - LAT_MIN) * 10).toFixed(0);
  let svg = `<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Mapa de Chile por región">`;
  for (const f of REGIONES_GEO.features) {
    const cod = f.properties.codregion;
    const n = porRegion[cod] ? porRegion[cod].egresos : 0;
    const color = RAMPA_MAPA[CORTES_MAPA.filter(c => n >= c).length];
    const d = f.geometry.coordinates.map(poly =>
      poly.map(anillo => 'M' + anillo.map(p => proyectar(p).join(',')).join('L') + 'Z').join('')).join('');
    svg += `<path d="${d}" fill="${color}" data-region="${cod}" class="${estado.region === cod ? 'elegida' : ''}"/>`;
  }
  document.getElementById('mapa').innerHTML = svg + '</svg>';

  const tip = document.getElementById('tooltip-mapa');
  document.querySelectorAll('#mapa path').forEach(p => {
    const cod = parseInt(p.dataset.region, 10);
    const r = porRegion[cod];
    p.addEventListener('mousemove', ev => {
      tip.style.display = 'block';
      tip.style.left = ev.clientX + 12 + 'px';
      tip.style.top = ev.clientY + 12 + 'px';
      tip.innerHTML = `<b>${DATOS.regiones[cod]}</b><br>${r ? fmtEntero(r.egresos) : 0} egresos CUP` +
        (r && r.egresos ? `<br>Mortalidad: ${fmtDec(r.mortalidad)} %` : '');
    });
    p.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    p.addEventListener('click', () => { tip.style.display = 'none'; elegirRegion(cod); });
  });

  const etiquetas = ['< 15', '15–29', '30–59', '≥ 60'];
  document.getElementById('leyenda-mapa').innerHTML =
    RAMPA_MAPA.map((c, k) => `<div><span style="background:${c}"></span>${etiquetas[k]}</div>`).join('');
}

function actualizarTerritorio() {
  // El mapa muestra todas las regiones (no se filtra por región, solo se marca la elegida)
  const porRegion = {};
  for (const i of filtrarEgresos({ ignorarRegion: true })) {
    const r = E.region[i];
    if (!r) continue;
    porRegion[r] = porRegion[r] || { egresos: 0, muertes: 0 };
    porRegion[r].egresos++;
    porRegion[r].muertes += E.fallece[i];
  }
  Object.values(porRegion).forEach(r => { r.mortalidad = r.muertes / r.egresos * 100; });
  document.getElementById('nota-mapa').textContent = `Egresos CUP ${textoPeriodo()} por región del establecimiento`;
  dibujarMapa(porRegion);

  let html = '<tr><th>Región</th><th>Egresos</th><th>Mort.</th></tr>';
  for (const cod of DATOS.ordenRegiones) {
    const r = porRegion[cod] || { egresos: 0, mortalidad: NaN };
    const mort = r.egresos ? fmtDec(r.mortalidad) + ' %' : '–';
    html += `<tr data-region="${cod}" class="${estado.region === cod ? 'elegida' : ''}"><td>${DATOS.regiones[cod]}</td>` +
            `<td>${fmtEntero(r.egresos)}</td><td class="${r.egresos < 30 ? 'poco' : ''}">${mort}</td></tr>`;
  }
  const tabla = document.getElementById('tabla-regiones');
  tabla.innerHTML = html;
  tabla.querySelectorAll('tr[data-region]').forEach(tr =>
    tr.addEventListener('click', () => elegirRegion(parseInt(tr.dataset.region, 10))));
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
    return { ...g, ...k, variacion: kAnt && kAnt.egresos ? (k.egresos / kAnt.egresos - 1) * 100 : NaN };
  });
  // CUP primero y los demás ordenados por mortalidad (como en el boceto)
  const resto = filasTabla.slice(1).sort((a, b) => (b.mortalidad || 0) - (a.mortalidad || 0));
  filasTabla = [filasTabla[0]].concat(resto);

  let html = '<tr><th>Grupo</th><th>Egresos</th><th>Var.</th><th>Mortalidad</th><th>Estancia</th><th>Sev. 3</th>' +
             '<th>Ch. ≥ 2</th><th>Peso</th></tr>';
  for (const f of filasTabla) {
    const vacio = f.egresos === 0;
    const color = COLOR.grupos[f.grupo === 'cup' ? 0 : f.grupo];
    html += `<tr class="${f.grupo === 'cup' ? 'fila-cup' : ''}"><td><span class="punto-grupo" style="background:${color}"></span>` +
      `${f.nombre}</td><td>${fmtEntero(f.egresos)}</td>` +
      `<td>${isFinite(f.variacion) ? (f.variacion >= 0 ? '+' : '−') + fmtDec(Math.abs(f.variacion)) + ' %' : '–'}</td>` +
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
  const enc = ['Grupo', 'Egresos', 'Variacion_%', 'Mortalidad_%', 'Estancia_mediana_dias', 'Severidad3_%',
               'Charlson_2_o_mas_%', 'Peso_GRD'];
  bajarCSV(`comparacion_cup_${periodoArchivo()}.csv`, [enc].concat(filasTabla.map(f => [
    f.nombre, f.egresos, isFinite(f.variacion) ? fmtDec(f.variacion) : '', isFinite(f.mortalidad) ? fmtDec(f.mortalidad) : '',
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
      ignoreElements: el => el.id === 'tooltip-mapa' || el.classList.contains('creditos') || el.id === 'descargar' ||
                            el.id === 'alto-contraste',
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
actualizarTodo();
if (llenarCalculadora()) {
  mostrarCalidadModelo();
  dibujarModelo();
}
// TODO: versión para celular
