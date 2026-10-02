import { NextRequest, NextResponse } from "next/server";
import { chromium, devices } from "playwright";
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

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext(
      mode === "mobile"
        ? { ...devices["iPhone 13"] }
        : { viewport: { width: 1440, height: 900 } }
    );
    const page = await context.newPage();
    await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

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
    await page.waitForTimeout(800);

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
    await browser.close();
  }
}
