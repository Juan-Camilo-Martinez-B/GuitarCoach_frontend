import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { mockApi, signedIn, TAB_FIXTURE } from "./support/mockApi";

const TAB_PATH = fileURLToPath(TAB_FIXTURE);

test("subir una tablatura arma la guía de la guitarra con sus rasgueos", async ({ page }) => {
  const api = await mockApi(page);
  await signedIn(page);
  await page.goto("/canciones");
  await expect(page.getByRole("button", { name: "Pegar acordes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Desde un audio" })).toHaveCount(0);

  await page.locator('input[type="file"]').setInputFiles(TAB_PATH);

  await expect(page).toHaveURL(/\/canciones\/g1$/);
  await expect(page.getByRole("heading", { name: "Rasgueo de prueba" })).toBeVisible();
  const guide = api.uploads[0] as {
    chords: Array<{ chord: string }>;
    events: Array<{ direction: string; contact: string }>;
    melody: unknown[];
  };
  // Solo la guitarra: los acordes salen de sus golpes y la voz no se vuelve melodía.
  expect(guide.chords.map((chord) => chord.chord)).toEqual(["Em", "C", "Em", "C"]);
  expect(guide.melody).toHaveLength(0);
  // Corcheas sin flechas: abajo en el tiempo, arriba en el contratiempo.
  expect(guide.events.slice(0, 4).map((event) => event.direction)).toEqual([
    "abajo",
    "arriba",
    "abajo",
    "arriba",
  ]);

  // Por defecto se ve la vista de acordes y rasgueo.
  await expect(page.getByRole("button", { name: "Acordes y rasgueo" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Escuchar", exact: true })).toBeVisible();

  await expect(page.getByRole("button", { name: "Acorde solo" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const chart = page.getByRole("list", { name: "Carta" });
  await expect(chart.getByRole("button", { name: /^Em/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Acorde y rasgueo" }).click();
  await expect(page.getByRole("group", { name: "Rasgueo abajo y arriba" })).toBeVisible();
  await chart.getByRole("button", { name: /^C/ }).first().click();
  await expect(chart.locator("li.is-now")).toContainText("C");

  await page.getByRole("button", { name: "Partitura" }).click();
  // alphaTab dibuja solo lo que está en pantalla.
  await page.locator(".tab-viewport").scrollIntoViewIfNeeded();
  await expect(page.locator(".tab-viewport svg").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Escuchar", exact: true })).toHaveCount(0);
});

test("practicar con el micrófono una sección escucha solo esa parte", async ({ page }) => {
  const api = await mockApi(page);
  api.guides = [
    {
      id: "g1",
      song_id: 9,
      title: "Dos partes",
      artist: "Ana",
      bpm: 90,
      source_kind: "tablatura",
      status: "revisada",
      updated_at: "2026-10-30T10:00:00Z",
      guide: {
        version: 1,
        title: "Dos partes",
        artist: "Ana",
        song_key: "G",
        bpm: 90,
        beats_per_bar: 4,
        capo: 0,
        sections: [
          { name: "Intro", start: 0, beats: 8, strum: { directions: ["abajo"], beats: [4] } },
          { name: "Coro", start: 8, beats: 8, strum: { directions: ["abajo"], beats: [4] } },
        ],
        chords: [
          { start: 0, beats: 4, chord: "G" },
          { start: 4, beats: 4, chord: "D" },
          { start: 8, beats: 4, chord: "Am" },
          { start: 12, beats: 4, chord: "C" },
        ],
        melody: [],
      },
    },
  ];
  await signedIn(page);
  await page.goto("/canciones/g1");

  await page.getByLabel("Qué parte tocar").selectOption({ label: "Coro" });
  await page.getByRole("button", { name: "Practicar con el micrófono" }).click();

  await expect(page).toHaveURL(/\/practica$/);
  await expect(page.getByRole("heading", { name: "Dos partes · Coro" })).toBeVisible();
  const chart = page.getByRole("list", { name: "Carta" });
  await expect(chart.getByRole("listitem")).toHaveCount(2);
  await expect(chart.getByRole("listitem").nth(0)).toContainText("Am");
  await expect(chart.getByRole("listitem").nth(1)).toContainText("C");
});

test("el editor avisa cuando un acorde no existe y no guarda", async ({ page }) => {
  const api = await mockApi(page);
  await signedIn(page);
  await page.goto("/canciones");
  await page.locator('input[type="file"]').setInputFiles(TAB_PATH);
  await expect(page).toHaveURL(/\/canciones\/g1$/);
  await page.getByRole("button", { name: "Ajustar la carta" }).click();
  await page.locator(".bars-input").first().fill("| G | H7 |");
  await page.getByRole("button", { name: "Guardar como revisada" }).click();
  await expect(page.getByRole("alert")).toContainText('"H7" no es un acorde');
  expect(api.puts).toHaveLength(0);
});

test("borrar la canción quita la guía y su archivo", async ({ page }) => {
  await mockApi(page);
  await signedIn(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/canciones");
  await page.locator('input[type="file"]').setInputFiles(TAB_PATH);
  await expect(page).toHaveURL(/\/canciones\/g1$/);
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page).toHaveURL(/\/canciones$/);
  await expect(page.getByRole("link", { name: /Rasgueo de prueba/ })).toHaveCount(0);
});

test("se puede quitar un informe de la lista", async ({ page }) => {
  await mockApi(page);
  await signedIn(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/informe");
  await expect(page.getByRole("button", { name: "Ver informe" })).toBeVisible();
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Cambios abiertos")).toHaveCount(0);
});

test("sin sesión, Mis canciones pide entrar", async ({ page }) => {
  await mockApi(page);
  await page.goto("/canciones");
  await expect(page.getByText("Tus guías se guardan en tu cuenta.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Iniciar sesión" }).last()).toBeVisible();
});
