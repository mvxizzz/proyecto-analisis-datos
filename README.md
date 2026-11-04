# Proyecto CUP: Dashboard CUP Chile

Análisis de Datos e Inferencia Estadística (UDD, 2026-2) · Bastián Campos · Renato Infante · Agustín Tapia · Maximiliano Mella

Cáncer de origen primario desconocido (CUP, CIE-10 C80.0) comparado con cinco cánceres metastásicos de primario conocido, usando los egresos hospitalarios GRD de FONASA 2019–2025 (60.816 egresos de adultos).

## Qué hay en cada carpeta

| Ruta | Contenido |
|---|---|
| `Analisis_CUP_vs_metastasicos.ipynb` | **El análisis vigente**: 13 preguntas, cada una con su gráfico y su interpretación. P12 son las comorbilidades (índice de Charlson y mortalidad según comorbilidad) y P13 la regresión lineal que predice los días de estadía (con boxplot por sexo y mapa de calor de correlaciones) |
| `BD/GRD_grupos_estudio_2019_2025.parquet` | Base que usa el notebook: los 6 grupos más el C80.9 (sensibilidad). Se lee en segundos |
| `BD/modelo_estadia.json` | Coeficientes, métricas, formulario de la calculadora y matriz de correlaciones de la regresión de P13; lo genera el notebook y lo usa el dashboard |
| `BD/regiones_chile.geojson` | Contorno de las 16 regiones para los mapas (fuente: github.com/caracena/chile-geojson, base BCN; simplificado y sin islas oceánicas) |
| `BD/GRD_C80/` | Archivos GRD crudos (`GRD2020.txt` … `GRD2024.txt`, `GRD_PUBLICO_2019.txt`, `GRD_PUBLICO_2025.txt`). Solo se leen si falta el `.parquet` |
| `dashboard/` | **Dashboard CUP Chile v0.2** (HTML basado en el boceto de Figma, con comorbilidades, calculadora de estadía y alto contraste): se abre con doble clic en `index.html`, sin internet. Ver su README |
| `figuras/` | Gráficos `P01`–`P13` en PNG para el informe y la presentación; `P05` (trayectoria), `P11a` (mapa por región, con selector de indicador) y `P11` (embudo) también en HTML interactivo |
| `referencias/` | Rúbrica del primer avance, documento del proyecto, indicaciones de la profesora (grupos y estrategia de identificación) e idea del dashboard |
| `archivo/` | Versiones anteriores, que no se usan: notebook v1, notebook de gráficos, figuras viejas, CSV 2020–2024, `grd_cup_2020_2024.parquet` (extracción C76–C80 de un compañero), `GRD_v0.ipynb` y `datasetSemana3.xlsx` (dataset de clase) |

## Cómo correr el notebook
1. Abrir `Analisis_CUP_vs_metastasicos.ipynb` en VS Code, elegir el kernel de Python y usar **Run All** (tarda alrededor de un minuto).
2. Requiere `pandas`, `pyarrow`, `matplotlib`, `scipy`, `statsmodels` y `scikit-learn`; `plotly` y `kaleido` son opcionales (gráficos interactivos).
3. Para rehacer la base desde los `.txt` (por ejemplo, si se agrega un año), poner `REHACER_EXTRACCION = True` en la primera celda de código y ajustar `ANIOS`.

## Presentación
`presentacion/Dashboard CUP Chile — Primer avance.pptx`: Presentación con un guion en las notas.
