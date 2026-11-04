# Guion y preguntas posibles — Dashboard CUP Chile

Orden de las 17 diapositivas del archivo `Dashboard CUP Chile - Avance 2.pptx`. Cada guion está escrito para decirlo con palabras simples; cambien lo que no les suene natural. Los tiempos suman unos 10 minutos más unos 4 minutos de demostración en vivo del dashboard. Somos cuatro: Agustín Tapia, Bastián Campos, Maximiliano Mella y Renato Infante.

| Quién | Diapositivas | Tema | Tiempo |
|---|---|---|---|
| Maximiliano | 1, 2, 3 y 13 | Apertura, problema, objetivo y demostración del dashboard | ~1 min 40 s + 4 min de demo |
| Bastián | 4, 5, 6, 14 | Datos, grupos, metodología y plan | ~2 min 35 s |
| Agustín | 7, 8, 9 | Cuánto pesa el CUP, mortalidad y mortalidad ajustada | ~1 min 55 s |
| Renato | 10, 11, 12, 15 | Quién lo atiende, regiones, comorbilidades y roles | ~2 min 15 s |
| Los cuatro | 16 | Resumen, una idea cada uno | 40 s |
| (Maximiliano) | 17 | Referencias, no se presenta | — |

Orden de intervención: Max → Bastián → Agustín → Renato → Max (dashboard) → Bastián (plan) → Renato (roles) → los cuatro. Max abre y muestra el dashboard; si prefieren que el dashboard lo muestre otra persona, basta con cambiar la diapositiva 13.

---

## Guion por diapositiva

### 1 · Portada — Maximiliano (15 s)
"Buenas tardes. Somos Agustín Tapia, Bastián Campos, Renato Infante y yo, Maximiliano Mella. Hoy les contamos cómo es la hospitalización de un tipo de cáncer que se llama cáncer de origen primario desconocido, o CUP, en los hospitales públicos de Chile, y les mostramos el dashboard que construimos."

### 2 · Problemática en Chile — Maximiliano (45 s)
"El cáncer es una de las principales causas de muerte en Chile: en 2022 hubo casi 60 mil casos nuevos y más de 31 mil muertes. La red de salud se organiza por órgano: hay equipos para pulmón, mama, colon. El CUP es el paciente que llega con metástasis, o sea con el cáncer ya diseminado, pero nadie sabe en qué órgano empezó. Entonces no tiene un equipo propio y queda repartido entre especialidades. Además Chile no tiene un registro nacional de cáncer, así que casi no hay cifras de este grupo. Con nuestros datos vimos que en la red pública mueren 22 de cada 100 hospitalizados por CUP."

### 3 · Objetivo y preguntas — Maximiliano (40 s)
"Nuestro objetivo es medir cuánto pesa el CUP, cómo lo atiende la red y si le va peor que a otros cánceres con metástasis. Lo ordenamos en trece preguntas y cinco bloques: cuánto pesa, quién es el paciente, cómo lo atiende la red, si le va peor, y con qué enfermedades llega. Cada pregunta termina en un panel del dashboard. Bastián parte contándoles de dónde salieron los datos."

### 4 · Datos — Bastián (45 s)
"Usamos las bases de egresos hospitalarios de FONASA entre 2019 y 2025. Cada fila es una hospitalización. Son casi siete millones de filas. De ahí nos quedamos con 60.816 hospitalizaciones de adultos en los grupos que estudiamos, y 3.889 son CUP. Los datos vienen casi completos. Una limitación importante: son solo hospitales públicos y solo cuenta las muertes ocurridas dentro del hospital."

### 5 · Grupos de estudio — Bastián (35 s)
"El CUP es el código C80.0. Lo comparamos con cinco cánceres que también tienen metástasis, pero donde sí se sabe dónde empezó: pulmón, colorrectal, mama, próstata y gástrico. Dejamos aparte el código C80.9, que es otro tipo de categoría, y lo usamos solo para revisar que la conclusión no cambia."

### 6 · Metodología — Bastián (45 s)
"Trabajamos en cinco pasos con Python. Uno: preparar los datos. Dos: armar los grupos. Tres: describir con frecuencias del tipo 'de cada 100', con su margen de error, y probar si las diferencias son reales. Cuatro: ver si la mortalidad cambia al igualar edad, sexo, gravedad e ingreso. Cinco: medir las enfermedades con las que llega el paciente y modelar cuántos días dura la hospitalización. De cada pregunta sale una figura en el notebook y un panel en el dashboard. Ahora Agustín les cuenta qué encontramos."

### 7 · ¿Cuánto pesa el CUP? — Agustín (40 s)
"Hay unas 560 hospitalizaciones por CUP al año. Bajaron con la pandemia y en 2025 ya superan a 2019. Sumando los días de cama, equivale a tener unas 22 camas ocupadas todo el año. A la derecha vemos la mortalidad: se mantiene entre 20 y 23 de cada 100 en los siete años, o sea no ha mejorado. Veamos ahora cómo le va frente a los otros cánceres."

### 8 · ¿El CUP muere más? — Agustín (35 s)
"Cada cuadrito es una hospitalización, y son 100 por grupo. Los naranjos son las que terminan en muerte. En el CUP son 22 de cada 100, igual que en pulmón, que es el de peor pronóstico, y más del doble que en mama o colorrectal. Esa diferencia no es casualidad: es estadísticamente significativa."

### 9 · ¿Es solo porque llega más grave? — Agustín (40 s)
"Alguien podría decir que el CUP muere más porque llega más viejo o más grave. Para probarlo, hicimos un ejercicio: si todos los grupos tuvieran la misma edad, el mismo sexo, la misma gravedad y el mismo tipo de ingreso, ¿cuántos morirían? El CUP bajaría a 15 de cada 100, pero colorrectal y próstata quedarían en 10. Aun con el mismo perfil, el CUP muere una vez y media más. Renato sigue con quién lo atiende."

### 10 · ¿Quién lo atiende? — Renato (35 s)
"Aquí vemos quién da el alta. En el CUP, 46 de cada 100 salen de medicina interna y solo 5 de cada 100 de oncología, que es la cifra más baja de los seis grupos; en colorrectal son 22. Es decir, el CUP casi no pasa por el circuito del cáncer."

### 11 · ¿Cambia según la región? — Renato (40 s)
"Son tres mapas: más oscuro significa más alto. En Antofagasta y Los Ríos, oncología atiende a 17 de cada 100 pacientes CUP; en la Región Metropolitana, a 2. La mortalidad cambia poco entre regiones, pero la atención por oncología depende de cómo se organiza cada red. En el extremo sur el CUP pesa el doble que en el resto del país."

### 12 · Comorbilidades y mortalidad — Renato (40 s)
"Una comorbilidad es otra enfermedad que el paciente ya tenía, como diabetes o hipertensión. Aquí vemos cuántos pacientes mueren según las enfermedades que tienen. En el CUP, los que no tienen ninguna de las diez enfermedades que medimos mueren 18 de cada 100; con hepatopatía crónica, que es daño crónico del hígado, mueren 42. A más enfermedades, más muertes. Max les muestra ahora todo esto en el dashboard."

### 13 · Dashboard en vivo — Maximiliano (unos 4 min)
Entrada: "Todo esto ya está en un dashboard que funciona. Se los muestro en vivo, pestaña por pestaña." Dejar la diapositiva unos segundos y pasar al navegador (abierto de antes, filtro en 2025).

Recorrido sugerido, una frase por panel:

- **Inicio · filtros:** "Arriba se elige año, región, Servicio de Salud, hospital, sexo, edad y tipo de ingreso; todo lo de abajo cambia con eso."
- **Indicadores:** "Cinco números: egresos, pacientes, mortalidad, estadía y peso GRD, con su cambio frente al período anterior."
- **Botón 'CUP vs. metastásicos':** "La barra es el CUP y cada punto de color es uno de los otros cinco cánceres."
- **Sitios de metástasis:** "Dónde está diseminado el cáncer; en el CUP, hígado, hueso y peritoneo encabezan."
- **Evolución mensual:** "Cuántas hospitalizaciones hay cada mes, comparadas con el año anterior."
- **Sexo y edad:** "Quién es el paciente: mitad hombres y mitad mujeres, sobre todo entre 60 y 79 años."
- **Tabla comparativa:** "Los seis grupos lado a lado; el CUP tiene de las mortalidades más altas."
- **Comorbilidades:** "Las diez enfermedades crónicas más frecuentes; hipertensión y diabetes encabezan."
- **Mortalidad según comorbilidad:** "Cuántos mueren de cada 100 con cada enfermedad, frente a los que no tienen ninguna."
- **Índice de Charlson:** "Un puntaje que resume cuántas enfermedades crónicas tiene el paciente; a más puntos, más muertes."
- **Mapa:** "Más oscuro, más egresos; al hacer clic en una región, se filtra por ella."
- **Análisis · calculadora:** "Elijo un perfil y el modelo da la estadía esperada: 15,6 días en el perfil base, y la compara con los otros cánceres."
- **Coeficientes:** "Qué alarga la estadía: sobre todo la gravedad alta y el ingreso por urgencia."
- **Calidad del modelo:** "Explica cerca del 38 % de la variación; sirve para comparar perfiles y planificar camas, no para un paciente."
- **Correlaciones:** "Con este mapa de calor elegimos qué variables entraban al modelo."
- **Descargas y Metodología (breve):** "Se bajan los datos filtrados en CSV o una captura en PDF, y aquí está cómo se calcula cada indicador."

Salida: "Volvemos a la presentación; Bastián cuenta lo que viene."

### 14 · Plan de trabajo — Bastián (30 s)
"Nos quedan seis semanas. En paralelo avanzamos con la estadística y con el dashboard. La semana 12 es la revisión de avances, la 13 son pruebas y correcciones, y la 14 es la entrega final: presentación, informe y póster."

### 15 · Roles — Renato (20 s)
"Bastián se encarga de los datos y el análisis, Agustín de los gráficos y la interpretación, Max del dashboard y yo de las comorbilidades, los mapas por región y la revisión de las cifras. Trabajamos con un repositorio compartido y una reunión semanal."

### 16 · Resumen — los cuatro (40 s)
- Maximiliano: "Mueren 22 de cada 100, igual que en pulmón y más que en los otros cuatro cánceres."
- Bastián: "Solo 5 de cada 100 reciben el alta de oncología: casi no pasa por el circuito del cáncer."
- Agustín: "Aun igualando el perfil del paciente, el CUP muere una vez y media más que colorrectal y próstata."
- Renato: "La atención depende de dónde vive el paciente: en Antofagasta oncología atiende a 17 de cada 100, en la Región Metropolitana a 2."
- Cierre: "Gracias. ¿Preguntas?"

### 17 · Referencias — Maximiliano (no se presenta)
Dejarla en pantalla mientras se responde si preguntan por las fuentes.

---

## Preguntas posibles y respuestas sugeridas

Quién responde cada tema (quien presentó esa parte; los demás complementan):

| Tema | Responde | Apoya |
|---|---|---|
| Datos y metodología | Bastián | Maximiliano |
| Análisis (mortalidad, ajuste, significancia) | Agustín | Bastián |
| Regresión y modelo de estadía | Maximiliano | Agustín |
| Problema en Chile, atención y regiones | Renato | Maximiliano |
| Comorbilidades y Charlson | Renato | Agustín |
| Dashboard | Maximiliano | Renato |
| Preguntas difíciles de la especialista | Quien conozca el tema; el que más sabe responde y otro cierra con el límite del estudio | — |

### Sobre los datos
**¿Por qué solo hospitales públicos?**
Porque las bases GRD de FONASA que están disponibles son de la red pública. No tenemos clínicas privadas. Lo declaramos como limitación: los resultados valen para la red pública, no para todo Chile.

**¿Por qué solo muertes dentro del hospital?**
Porque la base registra la condición al alta (vivo o fallecido). No sabemos qué pasó después de que el paciente se fue a su casa. Por eso hablamos de "mortalidad hospitalaria", no de supervivencia.

**¿Cómo saben que es CUP?**
Por el código C80.0 de la clasificación internacional CIE-10, buscado en los 35 diagnósticos de cada hospitalización. Excluimos a los que tenían además otro cáncer con origen conocido.

**¿Y el C80.9?**
Es una categoría de cáncer sin especificar, distinta. La analizamos aparte como prueba de que la conclusión no cambia si se suma.

**¿Por qué solo hasta 2025 y qué pasa con la edad?**
En 2025 la edad viene en tramos de 5 años, no exacta, y excluimos el tramo de 15 a 19. Está en las limitaciones del notebook.

**¿Los datos tienen valores faltantes o errores?**
Menos de 0,02 % de faltantes. Las estadías muy largas las dejamos, y por eso usamos medianas.

### Sobre el análisis
**¿Qué significa "de cada 100"?**
Es un porcentaje dicho de forma más fácil: 22 de cada 100 es 22 %. Lo usamos para que se entienda sin estadística.

**¿Qué quiere decir "diferencia significativa"?**
Que es muy poco probable que sea casualidad (probabilidad menor a 5 %). En el CUP frente a los otros cuatro cánceres, p < 0,001.

**¿Qué es la mortalidad ajustada?**
Es el ejercicio de igualar a todos los grupos en edad, sexo, gravedad y tipo de ingreso, y ver cuántos morirían. Sirve para descartar que el CUP muera más solo porque sus pacientes sean distintos.

**En la mortalidad ajustada, ¿el CUP muere menos que pulmón?**
No necesariamente: pulmón queda en 16 y el CUP en 15 de cada 100, pero sus márgenes de error se traslapan. Lo correcto es decir que el CUP muere tanto como pulmón.

**¿Qué es el índice de Charlson?**
Un puntaje internacional que suma puntos por cada enfermedad crónica (1, 2, 3 o 6 según gravedad). Lo calculamos sin contar el cáncer, porque todos los pacientes lo tienen.

**¿Cambia la conclusión si se suman las comorbilidades?**
No. Al agregar el Charlson al modelo de mortalidad, los resultados casi no se mueven. El CUP llega con más enfermedades que algunos grupos, pero eso no explica su mortalidad.

**Las comorbilidades, ¿son confiables?**
Las sacamos de los diagnósticos secundarios que anotan los hospitales. Si un hospital registra menos, aparecen menos. Puede haber subregistro y lo dejamos dicho.

### Sobre la regresión
**¿Qué es una regresión lineal?**
Una ecuación que relaciona un resultado (los días de hospitalización) con características del paciente (edad, gravedad, tipo de ingreso). Nos dice cuánto cambia la estadía por cada característica, manteniendo las demás iguales.

**¿Qué son las variables dummy?**
Para meter una categoría (por ejemplo, el tipo de cáncer) en una ecuación, se convierte en una variable de 0 o 1: "¿es pulmón? sí o no". Una categoría queda como referencia; en nuestro caso, el CUP.

**¿Por qué usaron logaritmo de la estadía?**
Porque la mayoría de las estadías son cortas y unas pocas son larguísimas. El logaritmo evita que esas pocas distorsionen el modelo. Después volvemos a días con una corrección (smearing de Duan).

**¿El R² de 0,38 no es bajo?**
Es moderado. Explica casi 4 de cada 10 de la variación de la estadía en escala logarítmica; si se mide en días baja a 0,13. Lo decimos con honestidad: el modelo ordena bien (los que predice más cortos estuvieron 1,1 días y los más largos 16,1), pero cada paciente varía mucho. El error medio es de 6,4 días contra 6,8 sin modelo. Sirve para comparar perfiles y planificar camas, no para predecir un paciente.

**¿Por qué no incluyeron variables como UCI o complicaciones?**
Porque queríamos usar solo lo que se sabe al ingreso. Lo que ocurre durante la hospitalización no se conoce al principio y haría trampa en una predicción. Tampoco incluimos la muerte, porque acorta la estadía y no se conoce al ingreso.

**¿Cómo mejoraron el modelo?**
Hicimos primero un mapa de calor de correlaciones entre las variables del ingreso y agregamos las que más se relacionaban con la estadía: comorbilidades, sitios de metástasis y gravedad. El R² subió de 0,32 a 0,38.

**¿Cómo evaluaron el modelo?**
Separamos 80 % de los egresos para ajustarlo y 20 % para evaluarlo (12.163 egresos que el modelo no había visto).

### Sobre el problema en Chile
**¿Existe una garantía GES para el CUP?**
*Revisar antes de presentar.* Nuestra diapositiva dice que no tiene garantía propia porque no tiene órgano. Es lo que afirmamos, pero no lo verificamos en una fuente oficial. Si preguntan, digan: "Entendemos que las garantías se organizan por órgano y el CUP no tiene uno propio; lo vamos a confirmar con el Ministerio de Salud".

**¿El cáncer es la primera causa de muerte en Chile?**
Está entre las dos primeras, junto con las enfermedades del sistema circulatorio, según el DEIS y la prensa. Para el año 2022 la cifra de GLOBOCAN es de 31.440 muertes por cáncer.

**¿Por qué el CUP importa si son pocos?**
Son unas 560 hospitalizaciones al año y unos 8.000 días-cama. No es un volumen enorme, pero tiene mortalidad de las más altas y no tiene equipo propio. Por eso es poco visible.

### Sobre el dashboard
**¿Para quién es?**
Para equipos de gestión clínica y oncológica de hospitales y Servicios de Salud: les dice cuánto pesa el CUP en su territorio y cómo se atiende.

**¿Se puede actualizar?**
Sí. Se regenera con un script de Python (`preparar_datos.py`) a partir de las bases nuevas, y el notebook entrega el modelo de estadía.

**¿Con qué está hecho?**
HTML con Chart.js. Se abre en cualquier navegador sin servidor ni conexión.

**¿La calculadora la podría usar un médico para decidir?**
No. Es un promedio de la población para planificar camas, no un pronóstico de un paciente.

**¿Qué falta?**
Una vista de la trayectoria del paciente (flujo de especialidades) y los detalles finales de interpretación. Está anotado en el plan de las semanas que quedan.

### Preguntas difíciles de la especialista
**¿Estos resultados sirven para cambiar algo?**
Muestran dos cosas medibles: la mortalidad del CUP es de las más altas y casi no pasa por oncología. Con eso se puede abrir la discusión de qué equipo debería recibirlo. Nuestro trabajo describe, no prueba que derivar a oncología baje la mortalidad.

**¿Descartaron que el CUP incluya cánceres mal clasificados?**
Es una limitación. Un código C80.0 puede incluir casos donde simplemente no se completó el estudio. Lo analizamos también con C80.9 y la conclusión se mantiene, pero no podemos separar completamente esos casos.

**¿Este patrón es causal?**
No. Es un estudio observacional: muestra asociaciones. Por ejemplo, que el CUP tenga más muertes no prueba que se deba a que oncología lo atienda poco.

**¿Qué sigue?**
Pruebas de hipótesis formales entre el CUP y cada grupo, ANOVA por Servicio de Salud, ajustes del dashboard y la entrega final con informe y póster.

---

## Consejos para el día
- Digan primero la conclusión y después el número. "El CUP muere tanto como pulmón: 22 de cada 100."
- Si no saben una respuesta: "Eso no lo medimos, pero lo anotamos como limitación." Es mejor que inventar.
- Ensayen la demostración del dashboard con el filtro del año 2025 y los botones "CUP vs. metastásicos" y "Análisis". Dejen el navegador abierto antes de empezar y cronométrenla: si pasa de 5 minutos, recorten Descargas y Metodología. Las pestañas Comparaciones y Territorio están en desarrollo: no las abran.
- Cuiden el tiempo: las diapositivas 4 a 6 y la demostración son las más fáciles de alargar. Con cuatro personas, cada traspaso es una frase corta ("ahora Bastián"); no más.
- Practiquen los traspasos: la diapositiva cambia justo cuando el siguiente empieza a hablar.
- Si alguien se bloquea, la persona que presentó esa parte retoma; las preguntas las toma quien las respondió en la tabla.
