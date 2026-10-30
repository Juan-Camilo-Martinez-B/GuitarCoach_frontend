import { expect, test } from "@playwright/test";
import { mockApi, signedIn } from "./support/mockApi";

test("la biblioteca no elige sola y la práctica abre el micrófono solo con el botón", async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => {
    (window as unknown as { micRequests: number }).micRequests = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          (window as unknown as { micRequests: number }).micRequests += 1;
          throw new DOMException("denegado", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/biblioteca");

  const card = page.locator(".song-card").first();
  await expect(card).toContainText("Cambios abiertos");
  await expect(card).toContainText("Sol · Re · Mim · Do");
  await expect(page.locator('.song-card[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Importar" })).toHaveCount(0);

  await card.click();
  await page.getByRole("button", { name: "Practicar esta canción" }).click();
  await expect(page).toHaveURL(/\/practica$/);
  await expect(page.locator(".verdict")).toHaveText("Pulsa Escuchar mi guitarra y toca el acorde.");
  expect(
    await page.evaluate(() => (window as unknown as { micRequests: number }).micRequests),
  ).toBe(0);

  await page.getByRole("button", { name: "Escuchar mi guitarra" }).click();
  await expect(page.locator(".verdict")).toContainText("Permiso de micrófono denegado");
  expect(
    await page.evaluate(() => (window as unknown as { micRequests: number }).micRequests),
  ).toBe(1);
});

test("el informe lista los intentos y abre el del intento elegido", async ({ page }) => {
  await mockApi(page);
  await signedIn(page);
  await page.goto("/informe");
  const row = page.locator(".attempt-list li").first();
  await expect(row).toContainText("Cambios abiertos");
  await expect(row).toContainText("75 %");
  await row.getByRole("button", { name: "Ver informe" }).click();
  await expect(page.getByText("El cambio de Re a Mim llega tarde.")).toBeVisible();
});

test("el inicio ofrece seguir con la última guía abierta", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "guitarcoach-last-visit",
      JSON.stringify({ path: "/canciones/g1", label: "Seguir con Mi canción" }),
    );
  });
  await page.goto("/");
  await expect(page.locator(".resume-card")).toContainText("Seguir con Mi canción");
  await expect(page.locator(".resume-card")).toHaveAttribute("href", "/canciones/g1");
});

test("el inicio ignora una dirección guardada que sale de la app", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "guitarcoach-last-visit",
      JSON.stringify({ path: "//sitio-ajeno.example", label: "Trampa" }),
    );
  });
  await page.goto("/");
  await expect(page.locator(".resume-card")).toHaveCount(0);
});
