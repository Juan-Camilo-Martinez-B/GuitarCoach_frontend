# GuitarCoach Frontend

Aplicación web del tutor de guitarra. El audio del micrófono se procesa en el navegador y no se envía al servidor.

## Cómo ejecutarlo

Requisitos: Node.js 22.

```powershell
npm ci
npm test
npm run build
npm run dev
```

La aplicación de desarrollo queda en `http://localhost:5173`.

```powershell
npm run dev
```

El afinador, la práctica y el informe viven en el navegador. Solo la telemetría y el texto del tutor salen hacia la API (`VITE_API_URL`).

```mermaid
flowchart LR
  microfono[Microfono]
  dsp[DSP en el navegador]
  api[API]
  microfono --> dsp
  dsp -->|telemetria| api
```

## Sonido de la guitarra

Los acordes, rasgueos y notas se tocan con muestras reales de guitarra de acero (FluidR3 GM, CC BY 3.0), alojadas en `public/samples/guitar-steel`. Si falta un archivo, se pide al CDN de midi-js-soundfonts. El motor vive en `src/audio/guitar/`:

| Módulo              | Qué hace                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sampleBank.ts`     | Descarga y decodifica las muestras antes de tocar y salta el silencio que el MP3 deja antes del ataque.                                                                   |
| `strumPerformer.ts` | Convierte un golpe en notas por cuerda: hacia abajo de la sexta a la primera, hacia arriba solo las cuatro agudas, con acentos por tiempo y pequeñas variaciones humanas. |
| `stringVoices.ts`   | Una voz por cuerda. Volver a tocar una cuerda apaga su nota anterior, como en una guitarra real. La intensidad cambia volumen y brillo.                                   |
| `outputChain.ts`    | Resonancia de la caja, una sala corta, compresión y un limitador para que seis cuerdas juntas no saturen.                                                                 |

`src/audio/guitarTone.ts` es la fachada que usan las pantallas. `playPattern` y `playSlots` devuelven los golpes ya alineados con el reloj de audio, para que las flechas del rasgueo se enciendan junto con el sonido.

## Mis canciones: guías de canciones elegidas

En `/canciones` el usuario crea una guía de estudio de cualquier canción:

- **Pegar acordes**: copia los acordes de un cancionero (LaCuerda, Cifra Club, Ultimate Guitar) y los pega con título, artista, tempo, compás, cejilla y rasgueo. La API ubica los acordes en compases y secciones y descarta la letra.
- **Subir archivo**: ChordPro o MusicXML sin comprimir.

`/canciones/:id` abre la guía:

- Reproductor por sección o de la canción entera, con velocidad del 50 al 100 %, cuenta de entrada, metrónomo, repetición y melodía si el archivo la trae. Cada sección suena con su propio rasgueo.
- La carta resalta el compás que suena, y el panel muestra el acorde actual y el siguiente.
- **Corregir la guía**: cada sección se edita como `| G | D . C . |` (un tramo por compás, el punto prolonga el acorde) con un rasgueo `D-DU-UDU`. Al guardar se puede marcar como revisada.
- **Practicar con el micrófono**: abre la práctica con la canción de la guía y su rasgueo; el intento queda para el informe.

La lógica pura vive en `src/domain/guide.ts` (golpes por sección, notación de compases y rasgueo, edición de secciones) y el audio en `playGuide` de `src/audio/guitarTone.ts`. El clic del metrónomo (`src/audio/guitar/metronome.ts`) no pasa por la reverberación, para sonar seco.

## Despliegue

La imagen escucha en el puerto 8080 y nginx envía COOP y COEP. El despliegue a Cloud Run es el workflow manual `desplegar`. La versión 1.0.0 está en `CHANGELOG.md`.
