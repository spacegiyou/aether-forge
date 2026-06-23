#!/usr/bin/env bash
# AetherForge — One-click Vercel deploy script
set -euo pipefail

echo "🚀 AetherForge — Deploying to Vercel…"

if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI…"
  npm i -g vercel
fi

echo "📦 Building production bundle…"
npm run build

echo "🌐 Deploying…"
vercel --prod --yes

echo "✅ Deploy complete! Share your AetherForge on X."