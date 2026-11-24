# Proyecto CUP: Dashboard CUP Chile

Análisis de Datos e Inferencia Estadística (UDD, 2026-2) · Bastián Campos · Renato Infante · Agustín Tapia · Maximiliano Mella

Cáncer de origen primario desconocido (CUP, CIE-10 C80.0) comparado con cinco cánceres metastásicos de primario conocido, usando los egresos hospitalarios GRD de FONASA 2019–2025 (60.816 egresos de adultos).

## Cómo abrir el dashboard
1. Descargar el repositorio (botón **Code → Download ZIP** en GitHub) y descomprimirlo.
2. Abrir `dashboard/index.html` con doble clic (Chrome, Edge o Firefox).

No necesita internet, Python ni instalar nada: los datos y las librerías vienen dentro de la carpeta `dashboard/`. Importante: abrirlo desde la carpeta descomprimida, no desde la vista previa del ZIP.

## Qué hay en cada carpeta

| Ruta | Contenido |
|---|---|
| `dashboard/` | **Dashboard CUP Chile v0.3**: pestañas Inicio, Análisis, Comparaciones, Territorio, Descargas y Metodología. Ver su [README](dashboard/README.md) |
| `Analisis_CUP_vs_metastasicos.ipynb` | **El análisis**: 13 preguntas, cada una con su gráfico y su interpretación. P12 son las comorbilidades (índice de Charlson y mortalidad según comorbilidad) y P13 la regresión lineal que predice los días de estadía |
| `BD/GRD_grupos_estudio_2019_2025.parquet` | Base que usa el notebook: los 6 grupos más el C80.9 (sensibilidad). Se lee en segundos |
| `BD/modelo_estadia.json` | Coeficientes, métricas y correlaciones de la regresión de P13; lo genera el notebook y lo usa el dashboard |
| `BD/regiones_chile.geojson` | Contorno de las 16 regiones para los mapas (fuente: github.com/caracena/chile-geojson, base BCN) |
| `BD/referencias/` | Cruce de códigos GRD con los nombres oficiales de hospitales del DEIS |
| `figuras/` | Gráficos `P01`–`P13` en PNG; `P05` (trayectoria), `P11a` (mapa por región) y `P11` (embudo) también en HTML interactivo |
| `presentacion/` | Presentación final, presentaciones de los avances, plan de trabajo y cambios del dashboard v0.3 |
| `referencias/` | Documento del proyecto, rúbrica del primer avance, indicaciones de la profesora e idea del dashboard |
| `archivo/` | Versiones anteriores del notebook y de las figuras; no se usan |

## Cómo correr el notebook (opcional)
1. Abrir `Analisis_CUP_vs_metastasicos.ipynb` en VS Code o Jupyter y ejecutar todo (tarda alrededor de un minuto).
2. Requiere `pandas`, `pyarrow`, `matplotlib`, `scipy`, `statsmodels` y `scikit-learn`; `plotly` y `kaleido` son opcionales.
3. El notebook lee `BD/GRD_grupos_estudio_2019_2025.parquet`, que viene en el repositorio. Los archivos GRD crudos (`BD/GRD_C80/*.txt`, de 0,4 a 1 GB cada uno) no se incluyen por tamaño; solo hacen falta para rehacer la base (`REHACER_EXTRACCION = True`).
