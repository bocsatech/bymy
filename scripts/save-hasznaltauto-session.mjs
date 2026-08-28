#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const output = resolve(process.argv[2] || "data/hasznaltauto-storage-state.json");
mkdirSync(dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto("https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto", { waitUntil: "domcontentloaded" });
console.log("Jelentkezz be a megnyílt Használtautó ablakban, majd nyomj Entert itt.");
process.stdin.setEncoding("utf8");
process.stdin.once("data", async () => {
  await context.storageState({ path: output });
  await browser.close();
  console.log(`Munkamenet mentve: ${output}`);
});
