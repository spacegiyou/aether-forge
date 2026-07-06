# xAI model verification — 2026-07-06

Sources:

- https://docs.x.ai/developers/models
- https://docs.x.ai/developers/models/grok-build-0.1
- https://docs.x.ai/developers/migration/may-15-retirement

| Use | Model ID (env default) | Notes |
|-----|------------------------|-------|
| Chat / planning | `grok-4.3` | GROK_TEXT_MODEL, 1M context |
| Agentic coding | `grok-build-0.1` | GROK_FAST_MODEL; `grok-code-fast-1` is an alias/migration source |
| Image gen | `grok-imagine-image-quality` | GROK_IMAGE_MODEL, POST /v1/images/generations |

API base: `https://api.x.ai/v1` (OpenAI-compatible)
