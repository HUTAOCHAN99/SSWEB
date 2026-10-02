import { NextRequest, NextResponse } from "next/server";
import { getContext } from "../../../lib/browser";

export const runtime = "nodejs";

// Membuka halaman di jendela browser asli supaya kamu bisa centang verifikasi sendiri.
// Cookie-nya tersimpan di profil yang sama dengan yang dipakai /api/screenshot.
export async function GET(req: NextRequest) {
  if (process.env.HEADLESS === "true") {
    return NextResponse.json({ error: "Verifikasi manual butuh HEADLESS=false." }, { status: 400 });
  }
  let target: URL;
  try {
    target = new URL(req.nextUrl.searchParams.get("url") ?? "");
  } catch {
    return NextResponse.json({ error: "URL tidak valid." }, { status: 400 });
  }
  if (!["http:", "https:"].includes(target.protocol)) {
    return NextResponse.json({ error: "Hanya http/https yang didukung." }, { status: 400 });
  }
  const context = await getContext();
  const page = await context.newPage();
  page.goto(target.toString()).catch(() => {});
  return new NextResponse(
    "Jendela browser dibuka. Centang verifikasi di sana, tunggu halaman termuat, lalu tutup tab itu dan kembali ke tool.",
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
