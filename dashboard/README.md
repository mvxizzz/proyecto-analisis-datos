# Dashboard CUP Chile: v0.1 (avance de la semana 9)

Primera versión del dashboard, basada en el boceto de Figma. Usa los datos reales de los egresos GRD 2019–2025.

## Cómo abrirlo
Doble clic en `index.html`. Funciona sin internet: la librería de gráficos y los datos vienen en la carpeta.

## Qué funciona
- **Pestaña Inicio** con todos los filtros: rango de años, región, Servicio de Salud, hospital, sexo, rango de edad, diagnóstico (C80.0 o C80.0 + C80.9) y tipo de ingreso.
- **Filtro de hospital:** 73 hospitales con su nombre oficial del DEIS, filtrados por la región y el servicio elegidos. El cruce código → nombre está corroborado en `../BD/referencias/README.md`.
- **Vista "CUP vs. metastásicos":** agrega los valores de los 5 cánceres metastásicos.
- **5 indicadores** con su variación frente al período anterior del mismo largo.
- **Paneles:** sitios de metástasis, evolución mensual, sexo, edad, tabla comparativa y mapa por región (al hacer clic en una región se filtra por ella).
- **Pestaña Descargas:** egresos filtrados (CSV), resumen por grupo (CSV) y captura del dashboard en PDF.

## Pendiente
- **Pestañas Análisis, Comparaciones y Territorio** (semana 11).
- Revisar la vista en celular.

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la página |
| `css/estilos.css` | Colores y diseño (violeta = CUP, naranjo = mortalidad, gris = contexto) |
| `js/app.js` | Filtros, cálculos, gráficos (Chart.js) y mapa (SVG) |
| `datos/datos.js`, `datos/regiones.js` | Datos generados; no se editan a mano |
| `lib/chart.umd.min.js` | Chart.js 4.4.1 |
| `lib/html2canvas.min.js`, `lib/jspdf.umd.min.js` | html2canvas 1.4.1 y jsPDF 2.5.1 (PDF de la pestaña Descargas) |
| `preparar_datos.py` | Regenera `datos/` desde `../BD/` |

## Regenerar los datos
Si cambia la base del proyecto, ejecutar desde esta carpeta:
```
python preparar_datos.py
```
El script lee `../BD/GRD_grupos_estudio_2019_2025.parquet`, `../BD/regiones_chile.geojson` y `../BD/referencias/hospitales_grd.csv`, y muestra las cifras de control de 2025 para compararlas con el dashboard.
