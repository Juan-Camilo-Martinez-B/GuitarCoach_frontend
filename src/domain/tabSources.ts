export interface TabSource {
  name: string;
  url: string;
  access: string;
  text: string;
  tip: string;
}

/** Sitios externos donde se consiguen archivos de Guitar Pro sin pagar. */
export const TAB_SOURCES: TabSource[] = [
  {
    name: "GProTab",
    url: "https://gprotab.net/",
    access: "Gratis, sin cuenta",
    text: "Un archivo grande de tablaturas ordenado por artista.",
    tip: "Busca la canción y descarga el archivo.",
  },
  {
    name: "Ultimate Guitar",
    url: "https://www.ultimate-guitar.com/explore?type%5B%5D=Pro",
    access: "Gratis; puede pedir cuenta",
    text: "La comunidad más grande. El enlace ya filtra las tablaturas de Guitar Pro.",
    tip: "Elige la versión con mejores votos. Las marcadas como Official son de pago.",
  },
  {
    name: "Free Rock Pack",
    url: "https://www.guitar-pro.com/blog/p/11970-free-rock-guitar-pro-pack",
    access: "Gratis, del sitio oficial",
    text: "20 riffs de rock famosos, publicados por los creadores de Guitar Pro.",
    tip: "Llega en un .zip: descomprímelo y sube un archivo a la vez.",
  },
];
