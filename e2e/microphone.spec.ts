import { expect, test, type Page } from "@playwright/test";
import { mockApi, signedIn } from "./support/mockApi";

interface MicWindow {
  micStreams: MediaStream[];
  micGate: Promise<void> | null;
  openMicGate: () => void;
}

/** Micrófono simulado con un stream real, para poder ver si sus pistas siguen vivas. */
async function fakeMicrophone(page: Page, options: { held: boolean } = { held: false }) {
  await page.addInitScript(({ held }) => {
    const mic = window as unknown as MicWindow;
    mic.micStreams = [];
    mic.micGate = held
      ? new Promise((resolve) => {
          mic.openMicGate = resolve;
        })
      : null;
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          await mic.micGate;
          const context = new AudioContext();
          const output = context.createMediaStreamDestination();
          const tone = context.createOscillator();
          tone.connect(output);
          tone.start();
          mic.micStreams.push(output.stream);
          return output.stream;
        },
      },
    });
  }, options);
}

function liveTracks(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as MicWindow).micStreams
        .flatMap((stream) => stream.getTracks())
        .filter((track) => track.readyState === "live").length,
  );
}

async function openPractice(page: Page) {
  await mockApi(page);
  await signedIn(page);
  await page.goto("/biblioteca");
  await page.locator(".song-card").first().click();
  await page.getByRole("button", { name: "Practicar esta canción" }).click();
  await expect(page).toHaveURL(/\/practica$/);
}

const SIGN_OUT = { name: "Salir" };

test("salir apaga el micrófono de la escucha libre", async ({ page }) => {
  await fakeMicrophone(page);
  await openPractice(page);
  await page.getByRole("button", { name: "Escuchar mi guitarra" }).click();
  await expect(page.getByRole("button", { name: "Dejar de escuchar" })).toBeVisible();
  await expect.poll(() => liveTracks(page)).toBe(1);

  await page.getByRole("button", SIGN_OUT).click();

  await expect.poll(() => liveTracks(page)).toBe(0);
  await expect(page.getByRole("button", { name: "Escuchar mi guitarra" })).toBeVisible();
  await expect(page.locator(".verdict")).toContainText("micrófono");
});

test("salir detiene la práctica con Empezar y no sigue contando", async ({ page }) => {
  await fakeMicrophone(page);
  await openPractice(page);
  await page.getByRole("button", { name: /Progresión/ }).click();
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect.poll(() => liveTracks(page)).toBe(1);

  await page.getByRole("button", SIGN_OUT).click();

  await expect.poll(() => liveTracks(page)).toBe(0);
  await expect(page.getByRole("button", { name: "Empezar" })).toBeVisible();
  const verdict = await page.locator(".verdict").innerText();
  await page.waitForTimeout(1500);
  await expect(page.locator(".verdict")).toHaveText(verdict);
});

test("salir mientras el navegador pide permiso no deja el micrófono abierto", async ({ page }) => {
  await fakeMicrophone(page, { held: true });
  await openPractice(page);
  await page.getByRole("button", { name: "Escuchar mi guitarra" }).click();

  await page.getByRole("button", SIGN_OUT).click();
  await page.evaluate(() => (window as unknown as MicWindow).openMicGate());

  await expect
    .poll(() => page.evaluate(() => (window as unknown as MicWindow).micStreams.length))
    .toBe(1);
  await expect.poll(() => liveTracks(page)).toBe(0);
  await expect(page.getByRole("button", { name: "Escuchar mi guitarra" })).toBeVisible();
});

test("salir apaga el micrófono del afinador", async ({ page }) => {
  await fakeMicrophone(page);
  await mockApi(page);
  await signedIn(page);
  await page.goto("/afinador");
  await page.getByRole("button", { name: "Activar micrófono" }).click();
  await expect(page.getByRole("button", { name: "Apagar micrófono" })).toBeVisible();
  await expect.poll(() => liveTracks(page)).toBe(1);

  await page.getByRole("button", SIGN_OUT).click();

  await expect.poll(() => liveTracks(page)).toBe(0);
  await expect(page.getByRole("button", { name: "Activar micrófono" })).toBeVisible();
});
