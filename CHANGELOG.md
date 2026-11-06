# Registro de cambios

## Sin publicar

- Rediseño para principiantes: modo claro y oscuro renovados, navegación en cuatro secciones con subnavegación y barra inferior en celular.
- Ruta guiada, guitarra interactiva, glosario emergente, página de diccionario, logros y racha guardados en el navegador.
- Mis canciones explica el flujo en tres pasos, enlaza sitios con archivos gratuitos de Guitar Pro y acepta arrastrar el archivo.
- Afinador con medidor visual y marca de cuerdas afinadas; la aguja solo aparece cuando hay una lectura.
- Práctica, Biblioteca, Guía e Informe con los botones ordenados por importancia. La Biblioteca ya permite practicar aunque falle el estudio de la canción.
- Espacio y Enter ya no inician la práctica cuando el foco está en otro control.
- Mis canciones solo acepta tablaturas de Guitar Pro (.gp3, .gp4, .gp5, .gpx, .gp). La app toma la guitarra y saca de ella acordes (formas sobre la cejilla), rasgueos con su dirección y duración reales, y punteos.
- La guía de una tablatura tiene dos vistas: Acordes y rasgueo (por defecto) y Partitura, con alphaTab, donde suena solo la guitarra.
- La guía armónica inventada ya no se presenta como melodía; la cejilla se aplica una sola vez y la melodía suena por encima del rasgueo.
- Corregir una guía ya no responde 422: el tempo se envía como `us_per_quarter`.
- Se quitaron Pegar acordes y Desde un audio.
- Guitarra más natural: muestras de acero alojadas, una voz por cuerda que apaga la nota anterior, rasgueo humanizado con acentos, caja, sala corta y limitador.
- Mis canciones: guías de canciones elegidas desde texto pegado, ChordPro, MusicXML o un audio propio, con reproductor por sección, velocidad, cuenta de entrada, metrónomo, melodía y editor.
- Práctica con reconocimiento de acordes por croma y micrófono solo a pedido.
- Biblioteca sin selección automática, informe con lista de intentos, afinador con cuerda objetivo y tonos de referencia, y "continuar donde quedaste".
- Pruebas de navegador con la API simulada, también en el CI.
- Se quitaron módulos de audio que la app no usaba.

## 1.0.0

- Afinador en el navegador: YIN, mediana, compuerta y aguja en canvas.
- Práctica con carta de acordes, ventana de 150 ms y telemetría sin audio.
- Biblioteca con búsqueda e importación, informe del tutor y curva de progreso.
- Imagen de nginx con COOP y COEP para poder usar memoria compartida.
