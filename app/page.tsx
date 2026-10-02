"use client";

import { useState } from "react";

type Mode = "desktop" | "mobile";
type Shots = Partial<Record<Mode, string>>;

async function grab(url: string, mode: Mode): Promise<string> {
  const res = await fetch(`/api/screenshot?url=${encodeURIComponent(url)}&mode=${mode}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Terjadi kesalahan.");
  }
  return URL.createObjectURL(await res.blob());
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("desktop");
  const [shots, setShots] = useState<Shots>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setShots({});
    try {
      // Dua mode diambil sekaligus, jadi berpindah tab nanti langsung tampil
      const [desktop, mobile] = await Promise.all([grab(url, "desktop"), grab(url, "mobile")]);
      setShots({ desktop, mobile });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const current = shots[mode];

  return (
    <main className="wrap">
      <h1>Ambil SS Web</h1>
      <p className="sub">Tempel link, lalu lihat hasilnya dalam tampilan desktop atau mobile.</p>

      <div className="bar">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(e)}
          placeholder="https://contoh.com"
          aria-label="Link web"
        />
        <button onClick={submit} disabled={loading || !url.trim()}>
          {loading ? "Mengambil…" : "Ambil SS"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="sub">Halaman sedang dimuat dan di-scroll otomatis. Bisa sampai 30 detik.</p>}

      {current && (
        <section className="preview">
          <div className="tabs" role="tablist">
            {(["desktop", "mobile"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? "tab on" : "tab"}
                onClick={() => setMode(m)}
              >
                {m === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
            <a className="dl" href={current} download={`screenshot-${mode}.png`}>
              Unduh PNG
            </a>
          </div>

          <div className={mode === "mobile" ? "frame phone" : "frame"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current} alt={`Screenshot ${mode}`} />
          </div>
        </section>
      )}
    </main>
  );
}
