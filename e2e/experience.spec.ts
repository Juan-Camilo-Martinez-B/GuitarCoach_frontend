import { expect, test } from "@playwright/test";
import { mockApi, signedIn } from "./support/mockApi";

test("Mis canciones enlaza sitios con archivos gratuitos, también sin sesión", async ({ page }) => {
  await mockApi(page);
  await page.goto("/canciones");
  const sources = page.getByRole("list", { name: "Sitios con archivos gratuitos de Guitar Pro" });
  const links = sources.getByRole("link");
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("href", /^https:\/\//);
  }
});

test("el glosario explica una palabra al tocarla y se cierra con Escape", async ({ page }) => {
  await mockApi(page);
  await page.goto("/canciones");
  await page.getByRole("button", { name: "tablatura", exact: true }).click();
  await expect(page.locator(".term-bubble")).toContainText("seis líneas son las cuerdas");
  await page.keyboard.press("Escape");
  await expect(page.locator(".term-bubble")).toHaveCount(0);
});

test("la navbar agrupa las páginas y la subnavegación muestra las de la sección", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  const main = page.getByRole("navigation", { name: "Principal", exact: true });
  await expect(main.getByRole("link")).toHaveCount(4);
  await main.getByRole("link", { name: "Practicar" }).click();
  await expect(page).toHaveURL(/\/biblioteca$/);
  const pages = page.getByRole("navigation", { name: "Páginas de Practicar" });
  await pages.getByRole("link", { name: "Afinador" }).click();
  await expect(page).toHaveURL(/\/afinador$/);
  await expect(main.getByRole("link", { name: "Practicar" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("en celular la navegación pasa a la barra inferior y nada desborda", async ({ page }) => {
  await mockApi(page);
  await signedIn(page);
  await page.setViewportSize({ width: 375, height: 760 });
  for (const path of ["/", "/aprendizaje", "/afinador", "/biblioteca", "/canciones", "/informe"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "Principal en celular" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal", exact: true })).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("ninguna pantalla desborda en tableta ni en escritorio", async ({ page }) => {
  await mockApi(page);
  await signedIn(page);
  for (const width of [768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of [
      "/",
      "/aprendizaje",
      "/afinador",
      "/biblioteca",
      "/canciones",
      "/informe",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} a ${width} px`).toBeLessThanOrEqual(0);
    }
  }
});

test("la ruta guiada avanza y gana un logro al afinar", async ({ page }) => {
  await mockApi(page);
  await page.goto("/afinador");
  await page.getByRole("link", { name: "Ya afiné, elegir canción" }).click();
  await expect(page.locator(".toast")).toContainText("Buen oído");
  await page.getByRole("link", { name: "GuitarCoach AI" }).click();
  await expect(page.locator(".path li.is-done")).toHaveCount(1);
  await expect(page.locator(".path li.is-current")).toContainText("Aprende tu primer acorde");
});

test("el tema oscuro cambia el fondo y se conserva al recargar", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const background = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  const light = await background();
  await page.getByRole("button", { name: /Tema Claro/ }).click();
  expect(await background()).not.toBe(light);
  await page.reload();
  await expect(page.getByRole("button", { name: /Tema Oscuro/ })).toBeVisible();
});
