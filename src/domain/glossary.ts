export interface GlossaryEntry {
  id: string;
  term: string;
  /** Formas en que la palabra aparece en los textos de la app. */
  aliases: string[];
  meaning: string;
  /** Una comparación o ejemplo cotidiano para fijar la idea. */
  example: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "acorde",
    term: "Acorde",
    aliases: ["acorde", "acordes"],
    meaning: "Varias notas que suenan a la vez. Es lo que tocas al pasar la mano por las cuerdas.",
    example: "Sol (G) y Mi menor (Em) son dos de los primeros acordes que se aprenden.",
  },
  {
    id: "acorde-menor",
    term: "Acorde menor",
    aliases: ["menor", "menores"],
    meaning: "Un acorde con un sonido más triste o cerrado. Se escribe con una m.",
    example: "Em se lee Mi menor; E, sin la m, es Mi mayor y suena más alegre.",
  },
  {
    id: "al-aire",
    term: "Al aire",
    aliases: ["al aire"],
    meaning: "Tocar una cuerda sin pisarla con ningún dedo.",
    example: "En los diagramas se marca con un círculo vacío o con el número 0.",
  },
  {
    id: "bpm",
    term: "BPM",
    aliases: ["BPM"],
    meaning: "Golpes por minuto: indica qué tan rápida va una canción.",
    example: "60 BPM es un golpe por segundo, como el segundero de un reloj.",
  },
  {
    id: "carta",
    term: "Carta de acordes",
    aliases: ["carta"],
    meaning: "El mapa de una canción: muestra qué acorde va en cada compás.",
    example: "| G | D | Em | C | se toca de izquierda a derecha.",
  },
  {
    id: "cejilla",
    term: "Cejilla",
    aliases: ["cejilla"],
    meaning:
      "Una pinza que se pone en el mástil y sube el tono de todas las cuerdas sin cambiar la forma de tus dedos.",
    example: "Con cejilla en el traste 2, una forma de Sol suena dos trastes más aguda.",
  },
  {
    id: "cejuela",
    term: "Cejuela",
    aliases: ["cejuela"],
    meaning: "La pieza con ranuras donde se apoyan las cuerdas, junto a las clavijas.",
    example: "Desde ella se empiezan a contar los trastes.",
  },
  {
    id: "cents",
    term: "Cents",
    aliases: ["cents"],
    meaning: "Una medida muy fina de cuánto se aleja una cuerda de su nota correcta.",
    example: "Cerca de 0 está afinada. Lo importante es que la aguja quede en el centro.",
  },
  {
    id: "clavija",
    term: "Clavija",
    aliases: ["clavija", "clavijas"],
    meaning: "La pieza que giras en la cabeza de la guitarra para tensar o aflojar una cuerda.",
    example: "Tensar sube el sonido; aflojar lo baja.",
  },
  {
    id: "compas",
    term: "Compás",
    aliases: ["compás", "compases"],
    meaning: "Un grupo pequeño de tiempos que se repite durante la canción.",
    example: "En un compás de 4 cuentas: uno, dos, tres, cuatro, y vuelves a empezar.",
  },
  {
    id: "cuenta-entrada",
    term: "Cuenta de entrada",
    aliases: ["cuenta de entrada"],
    meaning: "Unos clics antes de empezar para que entres a tiempo.",
    example: "Como cuando alguien dice «uno, dos, tres, cuatro» antes de arrancar.",
  },
  {
    id: "guia-armonica",
    term: "Guía armónica",
    aliases: ["guía armónica"],
    meaning:
      "Notas de apoyo sacadas de cada acorde. Ayudan a ubicarte, pero no son la melodía real.",
    example: "Sirve como referencia si el archivo no trae las notas de la canción.",
  },
  {
    id: "guitar-pro",
    term: "Guitar Pro (archivo)",
    aliases: ["Guitar Pro"],
    meaning:
      "Un archivo con la tablatura de una canción que la app sabe leer y hacer sonar. Termina en .gp3, .gp4, .gp5, .gpx o .gp.",
    example: "No es un audio: guarda qué cuerda y qué traste se toca en cada momento.",
  },
  {
    id: "intento",
    term: "Intento",
    aliases: ["intento", "intentos"],
    meaning: "Una vez que tocas la canción de principio a fin para ver cómo te fue.",
    example: "Se guarda con tu precisión para comparar tu avance.",
  },
  {
    id: "metronomo",
    term: "Metrónomo",
    aliases: ["metrónomo"],
    meaning: "Un clic constante que marca el pulso para que no te aceleres.",
    example: "Practica lento con él y sube la velocidad poco a poco.",
  },
  {
    id: "precision",
    term: "Precisión",
    aliases: ["precisión"],
    meaning: "El porcentaje de acordes que sonaron bien y a tiempo.",
    example: "75 % significa que acertaste 3 de cada 4.",
  },
  {
    id: "progresion",
    term: "Progresión",
    aliases: ["progresión"],
    meaning: "Una serie de acordes tocados en orden. Casi todas las canciones se construyen así.",
    example: "G, D, Em, C es una de las progresiones más usadas.",
  },
  {
    id: "rasgueo",
    term: "Rasgueo",
    aliases: ["rasgueo", "rasgueos", "rasguear"],
    meaning: "El movimiento de la mano que pasa por las cuerdas, hacia abajo o hacia arriba.",
    example: "Las flechas ↓ y ↑ te dicen hacia dónde mover la mano.",
  },
  {
    id: "seccion",
    term: "Sección",
    aliases: ["sección", "secciones"],
    meaning: "Una parte de la canción, como la intro, una estrofa o el coro.",
    example: "Estudiar por secciones es más fácil que tocar todo de una vez.",
  },
  {
    id: "tablatura",
    term: "Tablatura",
    aliases: ["tablatura", "tablaturas"],
    meaning:
      "Una forma simple de escribir música para guitarra: seis líneas son las cuerdas y cada número es el traste que debes pisar.",
    example: "No necesitas leer partituras para seguirla.",
  },
  {
    id: "tempo",
    term: "Tempo",
    aliases: ["tempo"],
    meaning: "La velocidad de la canción. Se mide en BPM.",
    example: "Un tempo bajo es ideal para empezar.",
  },
  {
    id: "traste",
    term: "Traste",
    aliases: ["traste", "trastes"],
    meaning: "Cada espacio entre dos barras de metal del mástil. Ahí se apoyan los dedos.",
    example: "El traste 1 es el más cercano a las clavijas.",
  },
];

const BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]));

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id);
}

export type GlossaryPiece = string | { id: string; text: string };

const ALIASES = GLOSSARY.flatMap((entry) => entry.aliases.map((alias) => ({ alias, id: entry.id })))
  // La forma más larga gana: "cuenta de entrada" antes que cualquier palabra suelta.
  .sort((first, second) => second.alias.length - first.alias.length);

const ID_BY_ALIAS = new Map(ALIASES.map(({ alias, id }) => [alias.toLowerCase(), id]));

const ALIAS_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(${ALIASES.map(({ alias }) => alias).join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);

/** Separa un texto y marca la primera aparición de cada término para poder explicarlo. */
export function splitGlossary(text: string): GlossaryPiece[] {
  const pieces: GlossaryPiece[] = [];
  const seen = new Set<string>();
  let cursor = 0;
  for (const match of text.matchAll(ALIAS_PATTERN)) {
    const id = ID_BY_ALIAS.get(match[0].toLowerCase());
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    pieces.push(text.slice(cursor, match.index));
    pieces.push({ id, text: match[0] });
    cursor = match.index + match[0].length;
  }
  pieces.push(text.slice(cursor));
  return pieces.filter((piece) => piece !== "");
}
