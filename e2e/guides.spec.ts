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

  await page.getByRole("button", { name: "Partitura" }).click();
  // alphaTab dibuja solo lo que está en pantalla.
  await page.locator(".tab-viewport").scrollIntoViewIfNeeded();
  await expect(page.locator(".tab-viewport svg").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Escuchar", exact: true })).toHaveCount(0);
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

test("sin sesión, Mis canciones pide entrar", async ({ page }) => {
  await mockApi(page);
  await page.goto("/canciones");
  await expect(page.getByText("Tus guías se guardan en tu cuenta.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Iniciar sesión" }).last()).toBeVisible();
});
