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
  await expect(page.getByRole("status")).toHaveText("Escuchando");
});
