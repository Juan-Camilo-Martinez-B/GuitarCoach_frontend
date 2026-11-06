import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const TAB_PATH = fileURLToPath(new URL("../fixtures/rasgueo-prueba.gp", import.meta.url));
const API = "http://localhost:8000";
const PASSWORD = "secreto-largo-de-prueba";

test("un alumno usa toda la app contra la API real", async ({ page }) => {
  const email = `vivo-${Date.now()}@example.com`;
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith(API) && response.status() >= 500) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });

  await test.step("crea la cuenta y entra", async () => {
    await page.goto("/entrar?alta=1");
    await page.getByLabel("Nombre").fill("Alumna");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).last().click();
    await expect(page).toHaveURL(/\/aprendizaje$/);
  });

  await test.step("el curso guarda el avance y desbloquea el siguiente módulo", async () => {
    await expect(page.locator(".course-progress strong")).toHaveText("0 de 9");
    await page.getByRole("button", { name: "Marcar como visto" }).click();
    await expect(page.locator(".course-progress strong")).toHaveText("1 de 9");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByRole("button", { name: "Marcar como visto" }).click();
    await expect(page.locator(".course-progress strong")).toHaveText("2 de 9");
  });

  await test.step("el micrófono reconoce el acorde que suena", async () => {
    await page.goto("/biblioteca");
    await page.locator(".song-card", { hasText: "Cambios abiertos" }).click();
    await expect(page.locator(".song-detail .chord-card").first()).toBeVisible();
    await page.getByRole("button", { name: "Practicar esta canción" }).click();
    await page.getByRole("button", { name: "Escuchar mi guitarra" }).click();
    // La carta empieza en Sol y el micrófono falso toca Sol.
    await expect(page.locator(".verdict")).toContainText("Bien", { timeout: 10_000 });
    await page.getByRole("button", { name: "Dejar de escuchar" }).click();
  });

  await test.step("la modalidad de notas abre y cierra el micrófono", async () => {
    await page.getByRole("button", { name: /Notas y melodía/ }).click();
    await page.getByRole("button", { name: "Escuchar mi guitarra" }).click();
    await expect(page.getByRole("button", { name: "Dejar de escuchar" })).toBeVisible();
    await page.getByRole("button", { name: "Dejar de escuchar" }).click();
  });

  await test.step("un intento a tiempo se guarda en la cuenta", async () => {
    await page.getByRole("button", { name: /^Progresión/ }).click();
    await page.getByRole("button", { name: "Empezar" }).click();
    await expect(page.locator(".verdict")).toContainText("Empieza en", { timeout: 5_000 });
    await expect(page.locator(".verdict")).toContainText("Intento guardado", { timeout: 40_000 });
  });

  await test.step("el informe y el tutor responden", async () => {
    await page.goto("/informe");
    const attempt = page.locator(".attempt-list li").first();
    await expect(attempt).toContainText("Cambios abiertos");
    await attempt.getByRole("button", { name: "Ver informe" }).click();
    await expect(page.locator(".report")).toContainText("Plan de la semana");
    await page.getByRole("button", { name: "Quiz del curso" }).click();
    await page.getByRole("button", { name: "Pedir el quiz" }).click();
    await expect(page.locator(".report")).toContainText("quiz");
    await page.getByRole("button", { name: "Progresión", exact: true }).click();
    await page.getByRole("button", { name: "Pedir la progresión" }).click();
    await expect(page.locator(".report")).toContainText("progresión");
  });

  await test.step("una tablatura se vuelve guía y se puede corregir", async () => {
    await page.goto("/canciones");
    await page.locator('input[type="file"]').setInputFiles(TAB_PATH);
    await expect(page).toHaveURL(/\/canciones\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Rasgueo de prueba" })).toBeVisible();
    await page.getByRole("button", { name: "Ajustar la carta" }).click();
    await page.getByRole("button", { name: "Guardar como revisada" }).click();
    await expect(page.locator(".guide-saved")).toContainText("Guía revisada");
    await page.getByRole("button", { name: "Partitura" }).click();
    await page.locator(".tab-viewport").scrollIntoViewIfNeeded();
    await expect(page.locator(".tab-viewport svg").first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Acordes y rasgueo" }).click();
    await page.getByRole("button", { name: "Practicar con el micrófono" }).click();
    await expect(page).toHaveURL(/\/practica$/);
  });

  await test.step("los logros quedan en la cuenta y vuelven al entrar en limpio", async () => {
    await page.goto("/informe");
    await expect(page.locator(".badge.is-won", { hasText: "A tocar" })).toBeVisible();
    await expect(page.locator(".badge.is-won", { hasText: "Mi propia canción" })).toBeVisible();

    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page.locator(".badge.is-won")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("guitarcoach-journey"))).toContain(
      '"milestones":[]',
    );

    await page.goto("/entrar");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/aprendizaje$/);
    await page.getByRole("link", { name: "Mi progreso" }).first().click();
    await page.getByRole("link", { name: "Informe y logros" }).click();
    await expect(page.locator(".badge.is-won", { hasText: "A tocar" })).toBeVisible();
    await expect(page.locator(".badge.is-won", { hasText: "Mi propia canción" })).toBeVisible();
  });

  expect(failures).toEqual([]);
});
