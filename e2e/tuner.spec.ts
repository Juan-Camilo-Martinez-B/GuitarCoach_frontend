import { expect, test } from "@playwright/test";

test("el afinador escucha un micrófono simulado", async ({ page }) => {
  await page.addInitScript(() => {
    const stream = { getTracks: () => [] };
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: async () => stream },
    });
  });
  await page.goto("/afinador");
  await page.getByRole("button", { name: "Activar micrófono" }).click();
  await expect(page.locator(".status-pill")).toHaveText("Escuchando");
  await expect(page.locator(".cents-readout")).toHaveText("Toca una cuerda");
  await expect(page.getByRole("button", { name: "Apagar micrófono" })).toBeVisible();
});
