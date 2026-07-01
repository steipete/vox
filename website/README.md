# Vox Landing Page

Marketing site for the Vox project — a self-hosted bridge between Twilio Media Streams and OpenAI Realtime.

## Stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS 4** (CSS-based config)
- **Framer Motion** for animations
- **Lenis** for smooth scrolling
- **Lucide React** for icons

## Local development

Requires Node.js 22+ and pnpm:

```bash
# from the repo root
cd website
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## Build

```bash
pnpm run build
```

Static output is written to `website/dist/`.

## Assets

- `public/vox-logo.svg` — app icon
- `public/vox-wordmark.svg` — gradient wordmark
- `public/favicon.svg` — browser favicon
- `public/vox-hero-illustration.svg` — hero / social illustration
- `public/og-image.svg` — social preview (SVG source)
- `public/og-image.png` — social preview raster fallback for Twitter/LinkedIn/Facebook
- `public/robots.txt` — allow-all robots policy

To regenerate the PNG fallback after editing `og-image.svg`:

```bash
pnpm run generate-og
```

This uses `sharp` to render the SVG to a 1200×630 PNG.

## Deploy

The canonical site is [voxcli.sh](https://voxcli.sh), deployed through GitHub
Pages by `.github/workflows/deploy-website.yml` whenever `website/` changes on
`main`. Repository Pages settings use **GitHub Actions** as the source and
`voxcli.sh` as the custom domain.

The workflow asks GitHub Pages for the active base path before building, so the
same artifact layout works for the custom domain (`/`) and the repository Pages
fallback (`/vox/`). `public/CNAME` records the canonical domain in the artifact.

To reproduce the project-path build locally:

```bash
VITE_BASE=/vox/ pnpm run build
VITE_BASE=/vox/ pnpm run verify:deploy
```
