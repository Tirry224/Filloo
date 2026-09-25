import { defineConfig, devices } from "@playwright/test";

/**
 * Les parcours de Filloo dans un vrai navigateur, au format téléphone,
 * contre une pile Supabase locale. Mode d'emploi : `e2e/README.md`.
 */
export default defineConfig({
  testDir: ".",
  /* Les parcours s'enchaînent (le commerçant publie, puis le client lui
     écrit) : un seul navigateur à la fois. */
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "resultats",
  reporter: [["list"], ["html", { open: "never", outputFolder: "rapport" }]],
  use: {
    baseURL: process.env.BASE ?? "http://localhost:3000",
    ...devices["Pixel 7"],
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
  },
});
