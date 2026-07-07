# Agent Notes

AetherForge uses Next.js 16, React 19, and the App Router. Before changing
framework APIs, verify behavior against the installed Next.js docs in
`node_modules/next/dist/docs/`.

Keep these checks green before opening a PR:

```bash
npm run lint
npm run build
npm run test:all
```

Do not commit secrets, OAuth token files, `.env.local`, Vercel project metadata,
or generated scratch evidence.
