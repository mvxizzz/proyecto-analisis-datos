# Proyecto CUP: Dashboard CUP Chile

Análisis de Datos e Inferencia Estadística (UDD, 2026-2) · Bastián Campos · Maximiliano Mella · Agustín Tapia

Cáncer de origen primario desconocido (CUP, CIE-10 C80.0) comparado con cinco cánceres metastásicos de primario conocido, usando los egresos hospitalarios GRD de FONASA 2019–2025 (60.816 egresos de adultos).

## Qué hay en cada carpeta

| Ruta | Contenido |
|---|---|
| `Analisis_CUP_vs_metastasicos.ipynb` | **El análisis vigente**: el EDA organizado en 11 preguntas, cada una con su gráfico y su interpretación |
| `BD/GRD_grupos_estudio_2019_2025.parquet` | Base que usa el notebook: los 6 grupos más el C80.9 (sensibilidad). Se lee en segundos |
| `BD/regiones_chile.geojson` | Contorno de las 16 regiones para los mapas (fuente: github.com/caracena/chile-geojson, base BCN; simplificado y sin islas oceánicas) |
| `BD/GRD_C80/` | Archivos GRD crudos (`GRD2020.txt` … `GRD2024.txt`, `GRD_PUBLICO_2019.txt`, `GRD_PUBLICO_2025.txt`). Solo se leen si falta el `.parquet` |
| `dashboard/` | **Dashboard CUP Chile v0.1** (HTML preliminar basado en el boceto de Figma): se abre con doble clic en `index.html`, sin internet. Ver su README |
| `figuras/` | Gráficos `P01`–`P11` en PNG para el informe y la presentación; `P05` (trayectoria), `P11a` (mapa por región, con selector de indicador) y `P11` (embudo) también en HTML interactivo |
| `referencias/` | Rúbrica del primer avance, documento del proyecto, indicaciones de la profesora (grupos y estrategia de identificación) e idea del dashboard |
| `archivo/` | Versiones anteriores, que no se usan: notebook v1, notebook de gráficos, figuras viejas, CSV 2020–2024, `grd_cup_2020_2024.parquet` (extracción C76–C80 de un compañero), `GRD_v0.ipynb` y `datasetSemana3.xlsx` (dataset de clase) |

## Cómo correr el notebook
1. Abrir `Analisis_CUP_vs_metastasicos.ipynb` en VS Code, elegir el kernel de Python y usar **Run All** (tarda alrededor de un minuto).
2. Requiere `pandas`, `pyarrow`, `matplotlib`, `scipy` y `statsmodels`; `plotly` y `kaleido` son opcionales (gráficos interactivos).
3. Para rehacer la base desde los `.txt` (por ejemplo, si se agrega un año), poner `REHACER_EXTRACCION = True` en la primera celda de código y ajustar `ANIOS`.

## Presentación
`presentacion/Dashboard CUP Chile — Primer avance.pptx`: versión corta (13 diapositivas, unos 9 minutos) con un guion por diapositiva en las notas. La versión larga (23 diapositivas) quedó en `archivo/`. La misma versión corta está en https://claude.ai/artifact/Y8HbGrZkKDbu3Pn4kZqWbx (se descarga como .pptx o PDF desde *Share › Export*; para que otra persona abra el enlace, primero hay que compartirlo).
