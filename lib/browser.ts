import { chromium, type BrowserContext } from "playwright";
import path from "node:path";

// Profil browser disimpan di folder ini, jadi cookie verifikasi (cf_clearance) tetap ada
const PROFILE_DIR = process.env.PROFILE_DIR ?? path.join(process.cwd(), ".browser-profile");
// Default: jendela browser asli (lebih jarang memicu verifikasi). Set HEADLESS=true untuk server tanpa layar.
const HEADLESS = process.env.HEADLESS === "true";
// Pakai Chrome terpasang kalau ada. Set CHROME_CHANNEL=chromium untuk memakai Chromium bawaan Playwright.
const CHANNEL = process.env.CHROME_CHANNEL ?? "chrome";

// Satu context dipakai bersama supaya profil tidak terkunci oleh dua proses
const g = globalThis as unknown as { __ctx?: Promise<BrowserContext> };

export function getContext(): Promise<BrowserContext> {
  if (!g.__ctx) {
    const p: Promise<BrowserContext> = chromium
      .launchPersistentContext(PROFILE_DIR, {
        headless: HEADLESS,
        channel: CHANNEL === "chromium" ? undefined : CHANNEL,
        viewport: null,
      })
      .then((ctx) => {
        ctx.on("close", () => {
          g.__ctx = undefined;
        });
        return ctx;
      });
    p.catch(() => {
      g.__ctx = undefined;
    });
    g.__ctx = p;
  }
  return g.__ctx;
}
