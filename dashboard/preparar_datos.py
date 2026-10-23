"""Prepara los datos del dashboard a partir de la base del notebook.

Uso (desde la carpeta dashboard/):  python preparar_datos.py
Lee ../BD/GRD_grupos_estudio_2019_2025.parquet y ../BD/regiones_chile.geojson
y escribe datos/datos.js y datos/regiones.js (se cargan con <script>, así el
dashboard funciona abriendo index.html con doble clic, sin servidor).
"""
import json
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

AQUI = Path(__file__).parent
BD = AQUI.parent / 'BD'
SALIDA = AQUI / 'datos'

# Grupos (el orden define el código numérico que usa app.js)
GRUPOS = ['CUP', 'CUP potencial (C80.9)', 'Pulmón', 'Colorrectal', 'Mama', 'Próstata', 'Gástrico']

# Igual que en el notebook (sección P11)
REGION_DE_SERVICIO = {
    'ARICA': 15, 'IQUIQUE': 1, 'ANTOFAGASTA': 2, 'ATACAMA': 3, 'COQUIMBO': 4,
    'VALPARAISO SAN ANTONIO': 5, 'VIÑA DEL MAR QUILLOTA': 5, 'ACONCAGUA': 5,
    'METROPOLITANO CENTRAL': 13, 'METROPOLITANO NORTE': 13, 'METROPOLITANO OCCIDENTE': 13,
    'METROPOLITANO ORIENTE': 13, 'METROPOLITANO SUR': 13, 'METROPOLITANO SURORIENTE': 13,
    'LIBERTADOR B. O HIGGINS': 6, 'DEL MAULE': 7, 'ÑUBLE': 16,
    'CONCEPCIÓN': 8, 'TALCAHUANO': 8, 'BIOBIO': 8, 'ARAUCO': 8,
    'ARAUCANÍA NORTE': 9, 'ARAUCANÍA SUR': 9, 'VALDIVIA': 14,
    'OSORNO': 10, 'DEL RELONCAVÍ': 10, 'CHILOÉ': 10, 'AYSEN': 11, 'MAGALLANES': 12}
NOMBRE_REGION = {15: 'Arica y Parinacota', 1: 'Tarapacá', 2: 'Antofagasta', 3: 'Atacama', 4: 'Coquimbo',
                 5: 'Valparaíso', 13: 'Metropolitana', 6: "O'Higgins", 7: 'Maule', 16: 'Ñuble', 8: 'Biobío',
                 9: 'La Araucanía', 14: 'Los Ríos', 10: 'Los Lagos', 11: 'Aysén', 12: 'Magallanes'}
ORDEN_REG = [15, 1, 2, 3, 4, 5, 13, 6, 7, 16, 8, 9, 14, 10, 11, 12]   # de norte a sur

# Sitios de metástasis (mismos códigos que el notebook); cada uno es un bit
SITIOS = [('Hígado', ('C78.7',)), ('Peritoneo', ('C78.6',)), ('Pulmón', ('C78.0',)), ('Hueso', ('C79.5',)),
          ('Cerebro', ('C79.3',)), ('Ganglios linfáticos', ('C77',)), ('Pleura', ('C78.2',)),
          ('Suprarrenal', ('C79.7',))]
TRAMOS = ['18–39', '40–49', '50–59', '60–69', '70–79', '80+']
INGRESOS = ['Urgencia', 'Programada', 'Otro']

# Hospitales: COD_HOSPITAL cruzado con el listado del DEIS y corroborado (ver BD/referencias/README.md)
HOSPITALES = BD / 'referencias' / 'hospitales_grd.csv'
# Código de Servicio de Salud del DEIS → nombre en la columna SERVICIO_SALUD de la base GRD
SERVICIO_DE_CODIGO_DEIS = {
    1: 'ARICA', 2: 'IQUIQUE', 3: 'ANTOFAGASTA', 4: 'ATACAMA', 5: 'COQUIMBO', 6: 'VALPARAISO SAN ANTONIO',
    7: 'VIÑA DEL MAR QUILLOTA', 8: 'ACONCAGUA', 9: 'METROPOLITANO NORTE', 10: 'METROPOLITANO OCCIDENTE',
    11: 'METROPOLITANO CENTRAL', 12: 'METROPOLITANO ORIENTE', 13: 'METROPOLITANO SUR', 14: 'METROPOLITANO SURORIENTE',
    15: 'LIBERTADOR B. O HIGGINS', 16: 'DEL MAULE', 17: 'ÑUBLE', 18: 'CONCEPCIÓN', 19: 'TALCAHUANO', 20: 'BIOBIO',
    21: 'ARAUCANÍA SUR', 22: 'VALDIVIA', 23: 'OSORNO', 24: 'DEL RELONCAVÍ', 25: 'AYSEN', 26: 'MAGALLANES',
    28: 'ARAUCO', 29: 'ARAUCANÍA NORTE', 33: 'CHILOÉ'}
NOTA_HOSPITAL = {'107101': 'ex San Martín'}   # mismo código antes del traslado de oct. 2022


def sin_tildes(texto):
    return unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode().lower()


def nombre_hospital(fila):
    """Nombre del DEIS; se agrega la comuna si el nombre no la dice, y la nota de cambios de nombre."""
    nombre = ' '.join(fila['nombre'].split())
    extras = [fila['comuna']] if sin_tildes(fila['comuna']) not in sin_tildes(nombre) else []
    extras += [NOTA_HOSPITAL[fila['codigo']]] if fila['codigo'] in NOTA_HOSPITAL else []
    return nombre + (f' ({", ".join(extras)})' if extras else '')


def main():
    df = pd.read_parquet(BD / 'GRD_grupos_estudio_2019_2025.parquet')
    df = df[df['GRUPO'].isin(GRUPOS)].copy()
    alta = pd.to_datetime(df['FECHAALTA'], errors='coerce')
    ingreso = pd.to_datetime(df['FECHA_INGRESO'], errors='coerce')
    diag = df[[f'DIAGNOSTICO{i}' for i in range(1, 36)]].fillna('')

    sitios = np.zeros(len(df), dtype=int)
    for bit, (_, prefijos) in enumerate(SITIOS):
        tiene = diag.apply(lambda s: s.str.startswith(prefijos)).any(axis=1).to_numpy()
        sitios |= tiene.astype(int) << bit

    tramo = pd.cut(df['EDAD'].astype(float), [18, 40, 50, 60, 70, 80, 200], right=False, labels=False)
    tipo = df['TIPO_INGRESO'].map({'URGENCIA': 0, 'PROGRAMADA': 1}).fillna(2)
    pacientes = {cip: i for i, cip in enumerate(df['CIP_ENCRIPTADO'].fillna('sin_id').unique())}

    # Hospitales de norte a sur y por nombre. La región y el Servicio de Salud de cada egreso son los del hospital
    # según el DEIS (no la columna SERVICIO_SALUD, que en ~5 % de los egresos no coincide con el hospital).
    hosp = pd.read_csv(HOSPITALES, dtype={'codigo': str})
    hosp = hosp[hosp['codigo'].isin(df['COD_HOSPITAL'].unique())].copy()
    hosp['orden'] = hosp['region_codigo'].map(ORDEN_REG.index)
    hosp['etiqueta'] = hosp.apply(nombre_hospital, axis=1)
    hosp['ss_grd'] = hosp['ss_codigo'].map(SERVICIO_DE_CODIGO_DEIS)
    hosp = hosp.sort_values(['orden', 'etiqueta']).reset_index(drop=True)
    servicios = sorted(hosp['ss_grd'].unique())
    indice_servicio = {s: i for i, s in enumerate(servicios)}
    columnas = {
        'anio': df['ANIO'].astype(int),
        'mes': alta.dt.month.fillna(0).astype(int),
        'grupo': df['GRUPO'].map(GRUPOS.index),
        'region': df['COD_HOSPITAL'].map(dict(zip(hosp['codigo'], hosp['region_codigo']))).fillna(0).astype(int),
        'servicio': df['COD_HOSPITAL'].map(dict(zip(hosp['codigo'], hosp['ss_grd'].map(indice_servicio))))
                                     .fillna(-1).astype(int),
        'hospital': df['COD_HOSPITAL'].map({c: i for i, c in enumerate(hosp['codigo'])}).fillna(-1).astype(int),
        'sexo': df['SEXO'].map({'HOMBRE': 0, 'MUJER': 1}).fillna(-1).astype(int),
        'tramo': tramo.fillna(-1).astype(int),
        'ingreso': tipo.astype(int),
        'fallece': (df['TIPOALTA'] == 'FALLECIDO').astype(int),
        'estada': (alta - ingreso).dt.days.fillna(0).astype(int),
        'peso': (pd.to_numeric(df['IR_29301_PESO'], errors='coerce').fillna(0) * 100).round().astype(int),
        'sev3': (pd.to_numeric(df['IR_29301_SEVERIDAD'], errors='coerce') == 3).astype(int),
        'sitios': pd.Series(sitios, index=df.index),
        'paciente': df['CIP_ENCRIPTADO'].fillna('sin_id').map(pacientes),
    }
    datos = {
        'generado': pd.Timestamp.now().strftime('%Y-%m-%d'),
        'grupos': GRUPOS,
        'regiones': {str(c): NOMBRE_REGION[c] for c in ORDEN_REG},
        'ordenRegiones': ORDEN_REG,
        'servicios': [{'nombre': s.title(), 'region': REGION_DE_SERVICIO[s]} for s in servicios],
        'hospitales': [{'codigo': h.codigo, 'nombre': h.etiqueta, 'region': int(h.region_codigo),
                        'servicio': indice_servicio[h.ss_grd]}
                       for h in hosp.itertuples()],
        'sitios': [s for s, _ in SITIOS],
        'tramos': TRAMOS,
        'ingresos': INGRESOS,
        'egresos': {k: v.tolist() for k, v in columnas.items()},
    }
    SALIDA.mkdir(exist_ok=True)
    texto = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
    (SALIDA / 'datos.js').write_text(f'// Generado por preparar_datos.py: no editar a mano\nconst DATOS = {texto};\n',
                                     encoding='utf-8')

    geo = json.loads((BD / 'regiones_chile.geojson').read_text(encoding='utf-8'))
    (SALIDA / 'regiones.js').write_text('// Contorno de las regiones (BD/regiones_chile.geojson)\nconst REGIONES_GEO = '
                                        + json.dumps(geo, ensure_ascii=False, separators=(',', ':')) + ';\n',
                                        encoding='utf-8')

    # Cifras de control para comparar con el dashboard
    cup = df[(df['GRUPO'] == 'CUP') & (df['ANIO'] == 2025)]
    estada = (alta - ingreso).dt.days[cup.index]
    print(f'Egresos en el archivo: {len(df):,}'.replace(',', '.'))
    print('Control 2025 (CUP, C80.0, sin filtros):')
    print(f'  egresos {len(cup)} | pacientes {cup["CIP_ENCRIPTADO"].nunique()} | '
          f'mortalidad {(cup["TIPOALTA"] == "FALLECIDO").mean() * 100:.1f} % | estada mediana {estada.median():.0f} días | '
          f'peso GRD {pd.to_numeric(cup["IR_29301_PESO"], errors="coerce").mean():.2f}')
    ss_hospital = df['COD_HOSPITAL'].map(dict(zip(hosp['codigo'], hosp['ss_codigo']))).map(SERVICIO_DE_CODIGO_DEIS)
    print(f'Hospitales: {len(hosp)} | egresos sin hospital identificado: {(columnas["hospital"] < 0).sum()} | '
          f'SERVICIO_SALUD igual al del hospital: {(df["SERVICIO_SALUD"] == ss_hospital).mean() * 100:.1f} %')
    for nombre in ['datos.js', 'regiones.js']:
        print(f'  {nombre}: {(SALIDA / nombre).stat().st_size / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
