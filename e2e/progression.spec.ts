import { expect, test, type Page } from "@playwright/test";
import { mockApi, signedIn, type ApiState } from "./support/mockApi";

// Un acorde por compás: el ciclo de Lamento boliviano.
const LAMENTO_BARS = ["Am", "Am", "Em", "Em", "Dm", "Dm", "Am", "E7"];
const LAMENTO_SLOTS = ["Am", "Em", "Dm", "Am", "E7"];
const LAMENTO_BPM = 120;
const SESSION_TIMEOUT = 30_000;

async function openLamento(page: Page, bars: string[]): Promise<ApiState> {
  const api = await mockApi(page);
  await signedIn(page);
  await page.goto("/biblioteca");
  await page.evaluate(
    async (options) => {
      const module = (await import(/* @vite-ignore */ "/e2e/support/guitarMic.ts")) as {
        installGuitarMic: (value: { bars: string[]; bpm: number }) => Promise<void>;
      };
      await module.installGuitarMic(options);
    },
    { bars, bpm: LAMENTO_BPM },
  );
  await page.getByRole("button", { name: /Lamento boliviano/ }).click();
  await page.getByRole("button", { name: "Practicar esta canción" }).click();
  await expect(page).toHaveURL(/\/practica$/);
  await page.getByRole("button", { name: /^Progresión/ }).click();
  return api;
}

async function playSession(page: Page) {
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page.locator(".verdict")).toContainText("Empieza en", { timeout: 5_000 });
}

test.describe("la progresión con la página real", () => {
  test.setTimeout(90_000);

  test("oye los acordes de Lamento a tiempo, abre su informe y deja empezar otra", async ({
    page,
  }) => {
    const api = await openLamento(page, LAMENTO_BARS);
    await playSession(page);
    await expect(page.getByRole("button", { name: "Cerrar intento" })).toBeVisible();
    // El veredicto llega en vivo desde el primer acorde, sin esperar a que termine el tramo.
    await expect(page.locator(".verdict")).toContainText("Bien. Sonó", { timeout: 10_000 });
    await expect(page.locator(".chart li").first()).toHaveClass(/is-now/);
    await expect(page.locator(".chart li").first().locator("small")).toHaveText("Bien");
    await expect(page.locator(".verdict")).toContainText("Intento guardado", {
      timeout: SESSION_TIMEOUT,
    });

    const events = api.attempts[0].events;
    console.log("acordes correctos:", JSON.stringify(events));
    expect(events.map((event) => event.expected)).toEqual(LAMENTO_SLOTS);
    expect(events.map((event) => event.detected)).toEqual(LAMENTO_SLOTS);
    for (const event of events) {
      expect(Math.abs(event.delta_ms)).toBeLessThanOrEqual(150);
    }

    // Terminada la sesión ya no hay nada que cerrar y se puede volver a empezar.
    await expect(page.getByRole("button", { name: "Cerrar intento" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Empezar otra vez" })).toBeEnabled();
    await page.getByRole("link", { name: "Ver informe de esta sesión" }).click();
    await expect(page).toHaveURL(/\/informe$/);
    await expect(page.getByText("El cambio de Re a Mim llega tarde.")).toBeVisible();

    await page.goBack();
    await page.getByRole("button", { name: /^Progresión/ }).click();
    await page.getByRole("button", { name: "Empezar" }).click();
    await expect(page.locator(".verdict")).toContainText("Empieza en", { timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Cerrar intento" })).toBeVisible();
  });

  test("empieza otra sesión justo después de terminar la anterior", async ({ page }) => {
    const api = await openLamento(page, LAMENTO_BARS);
    await playSession(page);
    await page.getByRole("button", { name: "Cerrar intento" }).click();
    await expect(page.locator(".verdict")).toContainText("no se guardó");
    expect(api.attempts).toHaveLength(0);

    await page.getByRole("button", { name: "Empezar otra vez" }).click();
    await expect(page.locator(".verdict")).toContainText("Empieza en", { timeout: 5_000 });
    await expect(page.locator(".verdict")).toContainText("Intento guardado", {
      timeout: SESSION_TIMEOUT,
    });
    expect(api.attempts).toHaveLength(1);
  });

  test("no da por buenos los acordes equivocados", async ({ page }) => {
    const api = await openLamento(page, ["Dm", "Dm", "Am", "Am", "Em", "Em", "E7", "Am"]);
    await playSession(page);
    await expect(page.locator(".verdict")).toContainText("Intento guardado", {
      timeout: SESSION_TIMEOUT,
    });
    const events = api.attempts[0].events;
    console.log("acordes equivocados:", JSON.stringify(events));
    expect(events.filter((event) => event.detected === event.expected)).toHaveLength(0);
  });

  test("distingue Mi7 de Mim", async ({ page }) => {
    const api = await openLamento(page, ["Am", "Am", "Em", "Em", "Dm", "Dm", "Am", "Em"]);
    await playSession(page);
    await expect(page.locator(".verdict")).toContainText("Intento guardado", {
      timeout: SESSION_TIMEOUT,
    });
    const events = api.attempts[0].events;
    console.log("mim en lugar de mi7:", JSON.stringify(events));
    expect(events[4].expected).toBe("E7");
    expect(events[4].detected).not.toBe("E7");
  });

  test("con el micrófono en silencio no guarda un intento", async ({ page }) => {
    const api = await openLamento(page, []);
    await playSession(page);
    await expect(page.locator(".verdict")).toContainText("No se oyó ningún acorde", {
      timeout: SESSION_TIMEOUT,
    });
    expect(api.attempts).toHaveLength(0);
    await expect(page.getByRole("link", { name: "Ver informe de esta sesión" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Empezar otra vez" })).toBeEnabled();
  });
});

test("Práctica ya no ofrece Notas y melodía", async ({ page }) => {
  await mockApi(page);
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: /Lamento boliviano/ }).click();
  await page.getByRole("button", { name: "Practicar esta canción" }).click();
  await expect(page.getByRole("button", { name: /^Progresión/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Notas y melodía/ })).toHaveCount(0);
});
