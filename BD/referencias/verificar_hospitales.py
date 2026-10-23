"""Cruza COD_HOSPITAL de la base GRD con el listado oficial del DEIS y lo corrobora con otras fuentes.

Uso (desde la carpeta Proyecto/):  python BD/referencias/verificar_hospitales.py
Fuentes (descargadas el 2026-10-22, ver README.md de esta carpeta):
  1. establecimientos_deis_20261020.csv  – listado oficial DEIS en datos.gob.cl (fuente del nombre)
  2. minsal-fhir-codigodeis.md           – CodeSystem "Código DEIS" de la guía FHIR del MINSAL
  3. huap-casuistica-grd.md              – informe MINSAL/HUAP con casuística GRD nacional 2020–2021
Escribe hospitales_grd.csv (código, nombre, Servicio de Salud, comuna, región y resultado de cada fuente).
"""
import re
import unicodedata
from pathlib import Path

import pandas as pd

AQUI = Path(__file__).parent
PROYECTO = AQUI.parent.parent
FUENTES = PROYECTO / '.firecrawl'


def normalizar(texto):
    """Minúsculas, sin tildes ni signos: para comparar nombres escritos de distinta forma."""
    texto = unicodedata.normalize('NFKD', str(texto)).encode('ascii', 'ignore').decode().lower()
    return set(re.findall(r'[a-z0-9]{3,}', texto)) - {'hospital', 'del', 'los', 'las', 'santiago'}


def parecido(a, b):
    """Fracción de palabras del nombre más corto que aparecen en el otro (0 a 1)."""
    pa, pb = normalizar(a), normalizar(b)
    return len(pa & pb) / min(len(pa), len(pb)) if pa and pb else 0.0


def main():
    grd = pd.read_parquet(PROYECTO / 'BD' / 'GRD_grupos_estudio_2019_2025.parquet', columns=['COD_HOSPITAL', 'ANIO'])
    uso = grd.groupby('COD_HOSPITAL')['ANIO'].agg(['size', 'min', 'max'])

    deis = pd.read_csv(AQUI / 'establecimientos_deis_20261020.csv', sep=';', dtype=str).set_index('EstablecimientoCodigo')

    # Fuente 2: filas "| 101100 | Nombre | Nombre |" del CodeSystem FHIR
    fhir = dict(re.findall(r'^\| (\d{6}) \| ([^|]+?) \|', (FUENTES / 'minsal-fhir-codigodeis.md').read_text(encoding='utf-8'),
                           re.M))
    # Fuente 3: en las tablas del informe el código y el nombre van en celdas seguidas (<td>101100</td><td>Hospital ...</td>).
    # Un mismo código aparece en varias tablas; se toma el nombre más repetido (la conversión del PDF desordena algunas celdas).
    texto_huap = (FUENTES / 'huap-casuistica-grd.md').read_text(encoding='utf-8')
    pares = pd.DataFrame(re.findall(r'<td>(\d{6})</td><td>([^<]{5,150})</td>', texto_huap), columns=['cod', 'nombre'])
    huap = pares.groupby('cod')['nombre'].agg(lambda s: s.str.strip().value_counts().index[0]).to_dict()

    filas = []
    for cod, u in uso.iterrows():
        d = deis.loc[cod] if cod in deis.index else None
        nombre = d['EstablecimientoGlosa'].strip() if d is not None else ''
        n_fhir, n_huap = fhir.get(cod, ''), huap.get(cod, '')
        filas.append({
            'codigo': cod,
            'codigo_antiguo': d['EstablecimientoCodigoAntiguo'] if d is not None else '',
            'nombre': nombre,
            'ss_codigo': int(d['SeremiSaludCodigo_ServicioDeSaludCodigo']) if d is not None else None,
            'servicio_salud': d['SeremiSaludGlosa_ServicioDeSaludGlosa'].replace('Servicio de Salud ', '') if d is not None else '',
            'comuna': d['ComunaGlosa'] if d is not None else '',
            'region_codigo': int(d['RegionCodigo']) if d is not None else None,
            'tipo': d['TipoEstablecimientoGlosa'] if d is not None else '',
            'estado_deis': d['EstadoFuncionamiento'] if d is not None else 'NO ENCONTRADO',
            'egresos_grd': u['size'], 'anios_grd': f"{u['min']}–{u['max']}",
            'nombre_fhir_minsal': n_fhir, 'coincide_fhir': round(parecido(nombre, n_fhir), 2) if n_fhir else None,
            'nombre_informe_grd': n_huap, 'coincide_informe_grd': round(parecido(nombre, n_huap), 2) if n_huap else None,
        })
    t = pd.DataFrame(filas)
    t.to_csv(AQUI / 'hospitales_grd.csv', index=False, encoding='utf-8-sig')

    print(f'Códigos en la base GRD: {len(t)} | en el listado DEIS: {(t["estado_deis"] != "NO ENCONTRADO").sum()}')
    for fuente in ['fhir', 'informe_grd']:
        c = t[f'coincide_{fuente}']
        print(f'  {fuente}: aparece {c.notna().sum()} | nombre coincide (≥ 0,5) {(c >= 0.5).sum()} | '
              f'no coincide {(c < 0.5).sum()}')
    revisar = t[(t['coincide_fhir'].fillna(1) < 0.5) | (t['coincide_informe_grd'].fillna(1) < 0.5)]
    if len(revisar):
        print('Revisar a mano:')
        print(revisar[['codigo', 'nombre', 'nombre_fhir_minsal', 'nombre_informe_grd']].to_string(index=False))


if __name__ == '__main__':
    main()
