import { expect, test } from "@playwright/test";
import { mockApi, signedIn } from "./support/mockApi";

test("pegar acordes crea la guía, se corrige y se guarda como revisada", async ({ page }) => {
  const api = await mockApi(page);
  await signedIn(page);
  await page.goto("/canciones");

  await page.getByLabel("Canción").fill("Mi canción");
  await page.getByLabel("Artista").fill("Ana");
  await page.getByLabel("Tempo (BPM)").fill("96");
  await page.getByLabel("Acordes").fill("[Intro]\nG D\n[Coro]\n| Am C |\nletra de prueba");
  await page.getByRole("button", { name: "Crear la guía" }).click();

  await expect(page).toHaveURL(/\/canciones\/g1$/);
  await expect(page.getByRole("heading", { name: "Mi canción" })).toBeVisible();
  await expect(page.getByText("Borrador: revisa los acordes")).toBeVisible();
  await expect(page.locator(".sheet-section header button")).toHaveText(["Intro", "Coro"]);
  expect(api.pastes[0]).toMatchObject({ title: "Mi canción", artist: "Ana", bpm: 96 });

  await page.getByRole("button", { name: "Corregir la guía" }).click();
  const coro = page.locator(".bars-input").nth(1);
  await expect(coro).toHaveValue("| Am C |");
  await coro.fill("| Am C | G |");
  await page.getByRole("button", { name: "Guardar como revisada" }).click();

  await expect(page.getByText("Guía revisada y guardada.")).toBeVisible();
  await expect(page.locator(".guide-status").first()).toHaveText("Revisada");
  const saved = api.puts[0];
  expect(saved.status).toBe("revisada");
  expect(saved.guide).not.toHaveProperty("lyrics");
  const chords = (saved.guide as { chords: Array<{ chord: string }> }).chords;
  expect(chords.map((chord) => chord.chord)).toEqual(["G", "D", "Am", "C", "G"]);
});

test("el editor avisa cuando un acorde no existe y no guarda", async ({ page }) => {
  const api = await mockApi(page);
  await signedIn(page);
  await page.goto("/canciones");
  await page.getByLabel("Canción").fill("Otra");
  await page.getByLabel("Artista").fill("Ana");
  await page.getByLabel("Acordes").fill("G D");
  await page.getByRole("button", { name: "Crear la guía" }).click();
  await page.getByRole("button", { name: "Corregir la guía" }).click();
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
