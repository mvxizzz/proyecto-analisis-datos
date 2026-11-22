# Dashboard CUP Chile: v0.3

Dashboard basado en el boceto de Figma, con los datos reales de los egresos GRD 2019–2025. La v0.2 agrega las comorbilidades, el modelo de estadía (pestaña Análisis) y el modo de alto contraste. La v0.3 ordena Inicio en secciones (indicadores, actividad y perfil, comorbilidades), divide Chile en norte, centro y sur en las pestañas Territorio y Comparaciones, agrega una ayuda (i) que explica cada variable y su metodología, y renueva el sistema de colores.

## Cómo abrirlo
Doble clic en `index.html`. Funciona sin internet: la librería de gráficos y los datos vienen en la carpeta.

## Qué funciona
- **Pestaña Inicio** con todos los filtros: rango de años, región, Servicio de Salud, hospital, sexo, rango de edad, diagnóstico (C80.0 o C80.0 + C80.9) y tipo de ingreso.
- **Filtro de hospital:** 73 hospitales con su nombre oficial del DEIS, filtrados por la región y el servicio elegidos. El cruce código → nombre está corroborado en `../BD/referencias/README.md`.
- **Vista "CUP vs. metastásicos":** agrega los valores de los 5 cánceres metastásicos.
- **5 indicadores** con su diferencia porcentual frente al período anterior del mismo largo. Bajo "Pacientes únicos" se ven los egresos por paciente.
- **Zonas (v0.3):** filtro Zona (norte, centro, sur) en Inicio; filtra todo el dashboard.
- **Pestaña Territorio (v0.3):** con el filtro Zona, el mapa muestra y acerca solo las regiones de esa zona. Mapa y gráfico por región con cuatro indicadores (mortalidad, alta por oncología, estancia y egresos); todas las regiones con barra y su margen de error (IC 95 % de Wilson), línea de Chile y de la zona, una frase que nombra las regiones que se alejan del país más allá del azar, orden de norte a sur o de mayor a menor, y un aviso con botón "Ver 2019–2025" cuando un solo año deja muchas regiones con pocos egresos. Seis indicadores de la zona frente al país y detalle por región.
- **Pestaña Comparaciones (v0.3):** norte, centro y sur lado a lado: mortalidad, estancia y peso GRD del CUP frente a los metastásicos, egresos CUP por año en cada zona y tabla con la diferencia de mortalidad.
- **Ayudas (v0.3):** el botón (i) junto a cada indicador, filtro y panel explica la variable y cómo se calcula (textos en `AYUDA`, `js/app.js`).
- **Paneles:** sitios de metástasis, evolución mensual, sexo, edad, tabla comparativa y mapa por región (al hacer clic en una región se filtra por ella).
- **Comorbilidades (v0.2):** paneles de las 10 comorbilidades más frecuentes, de la mortalidad según cada comorbilidad (con "sin ninguna de las 10" como referencia) y del índice de Charlson (sin cáncer). La tabla comparativa suma la columna "Ch. ≥ 2" (% con Charlson de 2 o más).
- **Vista "CUP vs. metastásicos" (v0.2):** cada cáncer tiene su propio color (los mismos del notebook, validados para daltonismo): el CUP en barras y cada cáncer como un punto, con leyenda.
- **Pestaña Análisis (v0.2):** calculadora de estadía esperada según el perfil del paciente, gráfico de coeficientes (qué alarga o acorta la estadía), calidad del modelo y mapa de calor de las correlaciones con que se eligieron las variables. Usa la regresión lineal de la pregunta P13 del notebook; el formulario de la calculadora se arma solo a partir de `modelo_estadia.json`.
- **Alto contraste (v0.2):** botón en el encabezado. Pasa la página a fondo negro con texto y bordes blancos, y aclara los colores de los gráficos y del mapa (en el mapa, más claro = más egresos); la preferencia queda guardada en el navegador y, si no hay una guardada, sigue la del sistema.
- **Pestaña Descargas:** egresos filtrados (CSV, ahora con comorbilidades e índice de Charlson), resumen por grupo (CSV) y captura del dashboard en PDF.

## Pendiente
- En Comparaciones, la mortalidad con margen de error y la ajustada (regresión logística); en Análisis, la trayectoria del paciente y el diagnóstico principal (semana 11).
- Revisar el resto de la vista en celular (ya no hay desplazamiento horizontal a 375 px).

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la página |
| `css/estilos.css` | Colores y diseño por significado (violeta = CUP y volumen, naranjo = muerte, ámbar = recursos, vino = comorbilidades, verde azulado = territorio, gris = contexto); todos los colores son variables y el alto contraste las redefine |
| `js/app.js` | Filtros, cálculos, gráficos (Chart.js), mapa (SVG), calculadora de estadía y alto contraste |
| `datos/datos.js`, `datos/regiones.js` | Datos generados; no se editan a mano |
| `lib/chart.umd.min.js` | Chart.js 4.4.1 |
| `lib/html2canvas.min.js`, `lib/jspdf.umd.min.js` | html2canvas 1.4.1 y jsPDF 2.5.1 (PDF de la pestaña Descargas) |
| `preparar_datos.py` | Regenera `datos/` desde `../BD/` |

## Regenerar los datos
Si cambia la base del proyecto, ejecutar desde esta carpeta:
```
python preparar_datos.py
```
El script lee `../BD/GRD_grupos_estudio_2019_2025.parquet`, `../BD/regiones_chile.geojson`, `../BD/referencias/hospitales_grd.csv` y `../BD/modelo_estadia.json`, y muestra las cifras de control de 2025 para compararlas con el dashboard.

`modelo_estadia.json` lo genera el notebook (pregunta P13). Si cambia el modelo, primero se ejecuta el notebook y después `preparar_datos.py`. Los códigos de las comorbilidades y del índice de Charlson están repetidos en el notebook y en el script: si se cambian, hay que cambiarlos en los dos.
