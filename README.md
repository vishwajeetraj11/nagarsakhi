# NagarSakhi

NagarSakhi is a mobile-first municipal governance platform for tier-3 Indian cities. This repository contains the Phusro Nagar Parishad hackathon demo described in the product requirements document.

The municipality is the customer and residents are the users. Citizens can record and prioritize ward issues, follow work and budgets, and complete municipal tasks. Ward parshads manage issue status and escalation. Corporation officials publish alerts, budgets, and municipality-wide notices.

## Stack

- Next.js App Router and TypeScript
- Supabase Postgres, Row Level Security, Realtime, Storage, and Edge Functions
- CSS Modules and OKLCH design tokens, with Tailwind CSS available for future features
- OpenAI text-embedding-3-small for semantic duplicate detection
- OpenAI GPT-5.6 Luna for on-demand translation and summaries
- Sarvam Saaras v3 for Indic-language transcription

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Keep `NEXT_PUBLIC_DATA_MODE=demo` to run with synthetic local data.
3. Install dependencies with `pnpm install`.
4. Start the application with `pnpm dev`.

Live Supabase mode additionally requires the Supabase URL, publishable key, service-role key, and the migration in `supabase/migrations`. Set `NEXT_PUBLIC_DATA_MODE=supabase`; demo authentication is then disabled automatically.

For durable AI work, deploy `supabase/functions/process-ai-jobs`, add `OPENAI_API_KEY` and `SARVAM_API_KEY` as Edge Function secrets, and invoke the function on a one-minute authenticated schedule. Add `public.ai_jobs` to the `supabase_realtime` publication for immediate updates; the client also polls as a fallback.

## Synthetic demo accounts

All local development accounts use OTP `123456` by default. Production demo mode must explicitly enable `DEMO_AUTH`, use a non-default OTP, and set a random session secret of at least 32 characters.

| Role | Phone |
| --- | --- |
| Citizen, Ward 12 | `+910000000012` |
| Parshad, Ward 12 | `+910000001012` |
| Corporation official | `+910000002000` |

Every identity and civic record in the demo is synthetic. NagarSakhi is not an official government service and does not use government logos or imply endorsement.

## Security model

Public citizen identity and private household data are stored separately. The database migration enforces municipality and ward boundaries with Row Level Security plus validation triggers. Issue and escalation transitions go through narrowly scoped, forward-only RPCs with audit events, expenditure records are append-only, and AI jobs are server-created rather than client-inserted.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The architecture and parallel-work ownership boundaries are documented in `docs/architecture.md`.
