const PATHS = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5V14h4v5.5",
  book: "M12 6.5C10 5 7 4.5 3.5 5v14c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Zm0 0v14",
  guitar:
    "m13.5 10.5 6-6M18 3l3 3M13.5 10.5a3.5 3.5 0 0 0-4.6.3c-.8.8-.8 1.8-1.6 2.3-.9.6-2.2.3-3.2 1.3a3.8 3.8 0 0 0 .3 5.3 3.8 3.8 0 0 0 5.3.3c1-1 .7-2.3 1.3-3.2.5-.8 1.5-.8 2.3-1.6a3.5 3.5 0 0 0 .3-4.7ZM9 15l1 1",
  chart: "M4 4v16h16M8 16v-4M12.5 16V8M17 16v-6.5",
  tuner: "M4 17a9 9 0 1 1 16 0M12 15l4-6M12 15h.01",
  library: "M5 4v16M10 4v16M14.5 4.5 19 20",
  mic: "M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3ZM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3",
  music:
    "M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.8 2.1c-.8.5-1.3 1-1.3 1.9M12 17h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c.7-4 3.7-6 7.5-6s6.8 2 7.5 6",
  logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9.5",
  sun: "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z",
  auto: "M4 5h16v11H4zM9 20h6M12 16v4",
  flame:
    "M12 21c-4 0-7-2.8-7-6.5 0-3 2-4.7 3.3-6.5.2 1.5 1 2.5 2.2 3C10.2 8 11 5 14 3c0 3 1.5 4.5 3 6.5 1.2 1.5 2 3 2 5C19 18.2 16 21 12 21Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  lock: "M6.5 10.5h11v10h-11zM8.5 10.5v-3a3.5 3.5 0 0 1 7 0v3",
  play: "M7 4.5v15l12-7.5z",
  stop: "M6.5 6.5h11v11h-11z",
  arrowRight: "M4.5 12h15M13.5 6l6 6-6 6",
  arrowLeft: "M19.5 12h-15M10.5 6l-6 6 6 6",
  external: "M14 4.5h5.5V10M19.5 4.5 11 13M18 14v5.5H4.5V6H10",
  upload: "M12 16V4.5M7 9.5l5-5 5 5M4.5 15v4.5h15V15",
  edit: "M4.5 19.5 5.5 15l10-10L19 8.5l-10 10zM13.5 7l3.5 3.5",
  sound: "M4 9.5v5h3.5l5 4.5V5l-5 4.5zM16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  star: "m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z",
  search: "M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20.5 20.5l-5-5",
} as const;

export type IconName = keyof typeof PATHS;

/** Iconos de trazo propios: el texto vecino da el nombre, por eso van ocultos al lector. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
