# zenaa-socials

A small self-hosted "link in bio" page: your social handles with follow buttons, your latest posts, and a section for resources, files and codes. It includes an admin editor and a QR code you can print on flyers.

## Deploy on your server

```bash
cp .env.example .env        # then edit: set ADMIN_PASSWORD and PUBLIC_URL
docker compose up -d --build
```

The site runs on port **3000**. Put it behind your reverse proxy (Nginx, Caddy, Traefik) with HTTPS and point your domain at it.

## Using it

| URL | What it is |
|---|---|
| `/` | Your public page (this is the link for the QR code) |
| `/admin` | Edit everything: profile, socials, sections, links, uploads |
| `/qr.svg` / `/qr.png?size=2048` | QR code for `PUBLIC_URL`, ready for flyers |

- **Socials**: choose the platform and type your username. The app builds the follow link for you.
  - **X**, **YouTube** and **Snapchat** open a real follow, subscribe or add prompt.
  - **Instagram**, **TikTok**, **Facebook** and the rest open your profile in their app, where Follow is one tap away. These platforms don't let outside websites follow on someone's behalf.
- **Sections**: add as many as you like, such as "Latest Posts", "Resources & Code" or "Merch". Each item can have:
  - a link, or an uploaded file such as a PDF or zip
  - a description
  - a thumbnail
  - a **code** box with a Copy button, for promo codes, snippets or commands
- Your data and uploaded files are kept in the `socials-data` Docker volume (`/app/data/site.json` and `/app/data/uploads/`). They survive rebuilds and updates.

## Deploy on Coolify

1. Push this project to GitHub with `publish-to-github.ps1` (instructions are at the top of that file).
2. In Coolify, go to **Projects → (your project) → + New → Resource**.
   - If the repo is **Public**, choose **Public Repository** and paste the repo URL.
   - If it's **Private**, choose **Private Repository (with GitHub App)**. Follow the prompts to connect GitHub, then pick the repo.
3. Set **Branch** to `main` and **Build Pack** to **Dockerfile**. Click **Continue**.
4. In **Configuration → General**:
   - **Ports Exposes**: `3000`
   - **Domains**: `https://links.yourdomain.com`. Coolify gets the HTTPS certificate automatically.
5. In **Environment Variables**, add:
   - `ADMIN_PASSWORD` = a strong password
   - `PUBLIC_URL` = `https://links.yourdomain.com` (the same domain as above)
6. In **Persistent Storage**, click **+ Add** and create a volume:
   - **Name**: `socials-data`
   - **Destination Path**: `/app/data`

   Without this, any edits you make in /admin are lost on every redeploy.
7. At your domain provider, add a DNS **A record** for `links` (or `@`) pointing to your Coolify server's IP.
8. Click **Deploy**. Then open `https://links.yourdomain.com/admin` and download the QR code for your flyers.

On the first start, the server copies in the content saved in `seed/`. After that, the content you edit in /admin on the server is the live version. To update the code later, run the publish script again and click **Redeploy** in Coolify. Your saved data stays.

## Run without Docker

```bash
npm install
ADMIN_PASSWORD=secret node server.js
```
