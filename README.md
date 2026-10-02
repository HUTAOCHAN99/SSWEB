# Ambil SS Web (Next.js + Playwright)

## Jalankan
```bash
npm install
npx playwright install chromium
npm run dev
```
Buka http://localhost:3000, isi link, tekan **Ambil SS**, lalu pilih tab Desktop atau Mobile.

## Cara kerja
- `app/page.tsx`: form + preview. Dua mode diambil sekaligus, jadi pindah tab langsung tampil.
- `app/api/screenshot/route.ts`: membuka halaman dengan Chromium (Playwright), scroll otomatis untuk memuat gambar lazy-load, lalu mengembalikan PNG full page.
  - Desktop: viewport 1440x900. Mobile: emulasi iPhone 13.

## Deploy
- Jalankan di VPS/Docker (Playwright + Chromium terpasang): langsung jalan.
- Vercel/serverless: Chromium bawaan Playwright terlalu besar. Ganti `playwright` dengan `playwright-core` + `@sparticuz/chromium`.
