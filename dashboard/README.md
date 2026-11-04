# Dashboard CUP Chile: v0.2

Dashboard basado en el boceto de Figma, con los datos reales de los egresos GRD 2019–2025. La v0.2 agrega las comorbilidades, el modelo de estadía (pestaña Análisis) y el modo de alto contraste.

## Cómo abrirlo
Doble clic en `index.html`. Funciona sin internet: la librería de gráficos y los datos vienen en la carpeta.

## Qué funciona
- **Pestaña Inicio** con todos los filtros: rango de años, región, Servicio de Salud, hospital, sexo, rango de edad, diagnóstico (C80.0 o C80.0 + C80.9) y tipo de ingreso.
- **Filtro de hospital:** 73 hospitales con su nombre oficial del DEIS, filtrados por la región y el servicio elegidos. El cruce código → nombre está corroborado en `../BD/referencias/README.md`.
- **Vista "CUP vs. metastásicos":** agrega los valores de los 5 cánceres metastásicos.
- **5 indicadores** con su variación frente al período anterior del mismo largo.
- **Paneles:** sitios de metástasis, evolución mensual, sexo, edad, tabla comparativa y mapa por región (al hacer clic en una región se filtra por ella).
- **Comorbilidades (v0.2):** paneles de las 10 comorbilidades más frecuentes, de la mortalidad según cada comorbilidad (con "sin ninguna de las 10" como referencia) y del índice de Charlson (sin cáncer). La tabla comparativa suma la columna "Ch. ≥ 2" (% con Charlson de 2 o más).
- **Vista "CUP vs. metastásicos" (v0.2):** cada cáncer tiene su propio color (los mismos del notebook, validados para daltonismo): el CUP en barras y cada cáncer como un punto, con leyenda.
- **Pestaña Análisis (v0.2):** calculadora de estadía esperada según el perfil del paciente, gráfico de coeficientes (qué alarga o acorta la estadía), calidad del modelo y mapa de calor de las correlaciones con que se eligieron las variables. Usa la regresión lineal de la pregunta P13 del notebook; el formulario de la calculadora se arma solo a partir de `modelo_estadia.json`.
- **Alto contraste (v0.2):** botón en el encabezado. Cambia los colores de la página, los gráficos y el mapa; la preferencia queda guardada en el navegador y, si no hay una guardada, sigue la del sistema.
- **Pestaña Descargas:** egresos filtrados (CSV, ahora con comorbilidades e índice de Charlson), resumen por grupo (CSV) y captura del dashboard en PDF.

## Pendiente
- **Pestañas Comparaciones y Territorio**, y en Análisis la trayectoria del paciente y el diagnóstico principal (semana 11).
- Revisar el resto de la vista en celular (ya no hay desplazamiento horizontal a 375 px).

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la página |
| `css/estilos.css` | Colores y diseño (violeta = CUP, naranjo = mortalidad, gris = contexto); todos los colores son variables y el alto contraste las redefine |
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
