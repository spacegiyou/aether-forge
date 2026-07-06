# Contributing

Thanks for improving AetherForge.

## Local Setup

```bash
npm install
npm run dev
```

The app runs in mock-safe mode without credentials. To test live xAI execution, copy `.env.example` to `.env.local`, set `XAI_API_KEY`, and use `AI_MODE=auto` or `AI_MODE=key`.

## Quality Checks

Run these before opening a pull request:

```bash
npm run lint
npm run build
npm run test:all
npm audit
```

## Pull Request Notes

- Keep mock mode working without credentials.
- Do not commit `.env*`, local OAuth tokens, `.next/`, `node_modules/`, or scratch evidence.
- Be explicit when a feature is simulated, mock-backed, or live.
- Include screenshots or a short GIF when changing visible UI.
