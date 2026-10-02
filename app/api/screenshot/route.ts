import { NextRequest, NextResponse } from "next/server";
import { getContext } from "../../../lib/browser";
import { captureViaApi, ApiShotError } from "../../../lib/screenshotapi";
import { lookup } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const maxDuration = 60;

// Tolak alamat internal supaya server tidak dipakai untuk mengakses jaringan lokal (SSRF)
function isPrivateIp(ip: string) {
  if (net.isIPv6(ip)) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

const CF_SELECTOR = 'iframe[src*="challenges.cloudflare.com"]';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const mode = req.nextUrl.searchParams.get("mode") === "mobile" ? "mobile" : "desktop";

  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json({ error: "URL tidak valid." }, { status: 400 });
  }
  if (!["http:", "https:"].includes(target.protocol)) {
    return NextResponse.json({ error: "Hanya http/https yang didukung." }, { status: 400 });
  }
  try {
    const { address } = await lookup(target.hostname);
    if (isPrivateIp(address)) {
      return NextResponse.json({ error: "Alamat internal tidak diizinkan." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Domain tidak ditemukan." }, { status: 400 });
  }

  // Pilih mesin: ENGINE=api | local | auto (default).
  // auto: situs di LOCAL_HOSTS (default uma.moe) lewat Chrome lokal berprofil, sisanya lewat ScreenshotAPI kalau key tersedia.
  const localHosts = (process.env.LOCAL_HOSTS ?? "uma.moe").split(",").map((h) => h.trim().toLowerCase());
  const isLocalHost = localHosts.some((h) => target.hostname === h || target.hostname.endsWith("." + h));
  const engineEnv = req.nextUrl.searchParams.get("engine") ?? process.env.ENGINE ?? "auto";
  const useApi =
    engineEnv === "api" || (engineEnv === "auto" && !isLocalHost && !!process.env.SCREENSHOTAPI_KEY);

  if (useApi) {
    try {
      const { buf, contentType } = await captureViaApi(target.toString(), mode);
      return new NextResponse(buf, { headers: { "Content-Type": contentType, "Cache-Control": "no-store" } });
    } catch (e) {
      const status = e instanceof ApiShotError ? e.status : 500;
      return NextResponse.json({ error: (e as Error).message }, { status: status >= 400 && status < 600 ? status : 500 });
    }
  }

  let page;
  try {
    const context = await getContext();
    page = await context.newPage();
    // Mobile hanya mengubah ukuran viewport; user agent tetap sama dengan yang diverifikasi
    await page.setViewportSize(mode === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 });

    await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Kalau muncul verifikasi Cloudflare, beri waktu sebentar (kadang lolos sendiri di browser asli)
    if ((await page.locator(CF_SELECTOR).count()) > 0) {
      await page.locator(CF_SELECTOR).first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
      if ((await page.locator(CF_SELECTOR).count()) > 0) {
        return NextResponse.json(
          {
            error:
              "Situs meminta verifikasi Cloudflare. Buka /api/verify?url=" +
              target.origin +
              " , centang 'Verify you are human' sekali di jendela yang muncul, lalu coba lagi.",
          },
          { status: 403 }
        );
      }
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    }

    // Tutup popup "What's new" kalau muncul
    await page
      .locator("button.generic-button", { hasText: "Close" })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});

    // Scroll otomatis supaya gambar lazy-load ikut termuat
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let y = 0;
        const step = 600;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          y += step;
          if (y >= document.body.scrollHeight || y > 20000) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 150);
      });
    });
    await page.waitForTimeout(2000); // beri waktu chart selesai dirender

    const buf = await page.screenshot({ fullPage: true, type: "png" });
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Gagal mengambil screenshot: " + (e as Error).message },
      { status: 500 }
    );
  } finally {
    await page?.close().catch(() => {});
  }
}
