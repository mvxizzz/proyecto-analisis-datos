# Códigos de hospital (COD_HOSPITAL) → nombre del establecimiento

La base GRD trae solo `COD_HOSPITAL` (6 dígitos). Este directorio guarda el cruce con el nombre oficial y la evidencia
de que cada código corresponde a ese hospital. Investigación hecha el 22-10-2026 con Firecrawl y Exa.

## Resultado

**Los 73 códigos de la base (2019–2025) quedan identificados y corroborados.** Ninguna fuente los contradice.

| Fuente | Tipo | Códigos encontrados | Nombre coincide |
|---|---|---|---|
| 1. Listado de establecimientos DEIS (datos.gob.cl, corte 20-10-2026) | Oficial, fuente del nombre | 73 / 73 (código vigente) | — |
| 2. CodeSystem "Código DEIS", guía FHIR de interoperabilidad MINSAL v0.2.0 | Oficial, publicación distinta | 73 / 73 | 73 / 73 |
| 3. Informe "Pandemia Covid-19 2020–2021 HUAP y casuística nacional MINSAL" (tablas GRD por hospital) | Oficial, basado en datos GRD | 73 / 73 | 70 / 73 (ver abajo) |
| 4. Agente de Exa (sitios de los hospitales, Doctoralia, directorios del registro DEIS, documentos de Servicios de Salud) | Secundaria | 49 confirmados, 24 sin evidencia, 0 contradichos | — |

Las 3 diferencias de nombre en la fuente 3 están explicadas:

- **107101** – el informe dice "Hospital San Martín (Quillota)". El Hospital Biprovincial Quillota-Petorca reemplazó al
  San Martín y conservó el código; el traslado de pacientes terminó el 12-10-2022
  ([MINSAL](https://www.minsal.cl/presidente-de-la-republica-y-ministra-de-salud-dan-el-vamos-a-la-puesta-en-marcha-del-hospital-biprovincial-quillota-petorca/)).
  Los egresos 2019 – oct 2022 de este código son del San Martín.
- **115100** – el informe dice "Hospital Regional de Rancagua". Cambió de nombre a Hospital Dr. Franco Ravera Zunino
  por Resolución Exenta N° 419 del 01-02-2024
  ([Superintendencia de Salud](https://www.superdesalud.gob.cl/app/uploads/2023/03/res-exenta-ip-n-6706-hospital-dr-franco-ravera-zunino-cambio-rpte-legal.pdf)).
- **121117** – error de la conversión del PDF ("Pitruñquén" por "Pitrufquén").

Los 24 "sin evidencia" del agente de Exa (112103, 116105–117102, 121109–133150 y 200717) son búsquedas que el agente no
alcanzó a hacer; todos aparecen con el mismo nombre en las fuentes 2 y 3. Ejecución: `agent_run_c023df73b55d4d3b9b1f1f42d86d70a9`.

## Archivos

- `establecimientos_deis_20261020.csv` – listado oficial del DEIS
  ([datos.gob.cl](https://datos.gob.cl/dataset/establecimientos-de-salud-vigentes)). Separador `;`, UTF-8.
- `verificar_hospitales.py` – hace el cruce y la comparación de nombres (`python BD/referencias/verificar_hospitales.py`
  desde `Proyecto/`). Lee las fuentes 2 y 3 desde `Proyecto/.firecrawl/` (no se versionan; se regeneran con
  `firecrawl scrape` de la guía FHIR y `firecrawl parse` del PDF del informe).
- `hospitales_grd.csv` – tabla final: código, código antiguo, nombre, Servicio de Salud y región del hospital, egresos y
  años en la base GRD, y el nombre y grado de coincidencia en las fuentes 2 y 3. La usa `dashboard/preparar_datos.py`.

## Notas

- El código es el "código vigente" del DEIS. Hasta 2013 el "código antiguo" era significativo: los dos primeros dígitos
  son el Servicio de Salud (`01-100` = Arica). Por eso en la base casi todos empiezan por `1` + Servicio de Salud.
- 200717 (Complejo Asistencial Padre Las Casas) es un código nuevo, sin esa estructura; aparece en la base desde 2024.
- Algunos hospitales entran a la base GRD recién en 2023–2025 (por ejemplo 105103 Illapel, 115104 Rengo, 116109 San Javier).
