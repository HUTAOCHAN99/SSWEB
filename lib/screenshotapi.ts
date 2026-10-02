// Klien ScreenshotAPI (https://screenshotapi.to). API key hanya dipakai di server.
const BASE = process.env.SCREENSHOTAPI_BASE_URL ?? "https://screenshotapi.to";

export class ApiShotError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function captureViaApi(url: string, mode: "desktop" | "mobile") {
  const key = process.env.SCREENSHOTAPI_KEY;
  if (!key) throw new ApiShotError("SCREENSHOTAPI_KEY belum diisi di .env.local", 500);

  const params = new URLSearchParams({
    url,
    type: "png",
    fullPage: "true",
    width: mode === "mobile" ? "390" : "1440",
    height: mode === "mobile" ? "844" : "900",
    waitUntil: "networkidle2",
    delay: "1500",
    removePopups: "true",
  });

  const res = await fetch(`${BASE}/api/v1/screenshot?${params}`, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string; message?: string }).error ?? (body as { message?: string }).message;
    if (res.status === 401 || res.status === 403) throw new ApiShotError("API key tidak valid atau dicabut.", res.status);
    if (res.status === 402) throw new ApiShotError("Kredit ScreenshotAPI habis.", res.status);
    throw new ApiShotError(msg ?? `ScreenshotAPI error ${res.status}`, res.status);
  }
  return {
    buf: new Uint8Array(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") ?? "image/png",
  };
}
