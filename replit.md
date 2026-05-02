# Alexia AI Companion

## Overview

An AI companion web app featuring Alexia — a Live2D 2D anime avatar with white hair, red eyes, and cat ears. The model tracks mouse movement, blinks, breathes, plays expressions, and responds using AI chat via OpenAI.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (artifact: `companion`)
- **Live2D**: pixi-live2d-display + PixiJS v6 (Cubism 4 models)
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini)

## Artifacts

- `artifacts/companion` — Main web app at `/` (Live2D viewer + AI chat)
- `artifacts/api-server` — Express API server at `/api`

## Live2D Model

- **Model**: Alexia (Cubism 4 .moc3 format)
- **Location**: `artifacts/companion/public/models/Alexia/`
- **Runtime**: Cubism 4 Core loaded via CDN in `index.html`
- **Features**: Mouse tracking, expressions, lip sync, physics

## AI Chat

- **Endpoint**: `POST /api/chat`
- **Model**: gpt-5-mini via Replit AI Integrations
- **Persona**: Alexia — cute cat-ear anime companion
- **Expressions**: AI selects appropriate expression JSON from response

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Live2D Expressions

Available expressions mapped from AI emotion responses:
- `lh` — blush/shy
- `xxy` — star eyes (excited)
- `y` — dizzy/surprised
- `bbt` — cute/moe
- `dyj` — glasses (smart)
- `h` — sweat (nervous)
- `k` — crying (sad)
- `yf`, `yfmz` — outfit variations
- `yjys1`, `yjys2` — eye color variations
- `zs1` — confident pose
