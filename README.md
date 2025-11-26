# CCI Divergence Scanner

A real-time CCI divergence scanner built with Next.js and Polygon.io API.

## Features

- 🔍 Scan multiple symbols for CCI divergences
- 📊 Regular & Hidden divergence detection
- ⚡ Strength scoring system (1-10)
- 🕐 Multiple timeframes (5m, 15m, 60m)
- 🔄 Auto-refresh mode (60s intervals)
- 📱 Mobile-friendly responsive design
- 🔐 API key stored locally in browser

## Signal Types

| Signal | Meaning | Action |
|--------|---------|--------|
| REG BULL | Price Lower Low + CCI Higher Low | Potential reversal UP |
| REG BEAR | Price Higher High + CCI Lower High | Potential reversal DOWN |
| HID BULL | Price Higher Low + CCI Lower Low | Trend continuation UP |
| HID BEAR | Price Lower High + CCI Higher High | Trend continuation DOWN |

## Getting Started

### Prerequisites

- Node.js 18+
- Polygon.io API key (get one at [polygon.io](https://polygon.io))

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy to Vercel

1. Push this repo to GitHub
2. Connect to Vercel
3. Deploy - that's it!

Your API key is entered in the browser and stored in localStorage (never sent to any server except Polygon).

## Tech Stack

- [Next.js 14](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Polygon.io](https://polygon.io/) for market data
- [Lucide React](https://lucide.dev/) for icons

## License

MIT
