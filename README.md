# Bot Telegram Auto Order DitsStore

## Cara Install

1. Clone atau copy project ini ke server / VPS Anda.
2. Pastikan sudah menginstall **Node.js** (rekomendasi versi 18+).
3. Buka terminal/command prompt di dalam folder project ini.
4. Jalankan perintah instalasi dependency:
   ```bash
   npm install
   ```

## Setting Environment Variables

1. Copy file `.env.example` dan ubah namanya menjadi `.env`.
   ```bash
   cp .env.example .env
   ```
2. Buka file `.env` dan isi data yang dibutuhkan:
   - `BOT_TOKEN`: Token bot Anda dari @BotFather di Telegram
   - `ADMIN_PASSWORD`: Password untuk login admin di bot via /adminmenu
   - `OWNER_ID`: Telegram ID owner (opsional / untuk notifikasi)

## Cara Menjalankan Bot

Untuk menjalankan bot secara normal:
```bash
npm start
```

Untuk mode development (auto-restart saat ada perubahan code):
```bash
npm run dev
```

## Cara Deploy di VPS (Menggunakan PM2)

Agar bot tetap berjalan di latar belakang (background) meskipun terminal ditutup, gunakan PM2:

1. Install PM2 secara global:
   ```bash
   npm install -g pm2
   ```
2. Jalankan bot dengan PM2:
   ```bash
   pm2 start src/index.js --name "bot-ditsstore"
   ```
3. Agar PM2 otomatis berjalan saat VPS restart:
   ```bash
   pm2 startup
   pm2 save
   ```
4. Untuk melihat log bot:
   ```bash
   pm2 logs bot-ditsstore
   ```
