# NagarSakhi architecture

## Product shape

NagarSakhi is a mobile-first municipal governance product with three role shells in one Next.js application: citizen, ward parshad, and corporation administrator. It is a modular monolith backed by Supabase.

## Runtime boundaries

- Next.js renders routes, validates sessions, enforces server-side authorization, and owns fast mutations.
- Supabase Postgres stores all durable state. Row Level Security mirrors server authorization.
- Supabase Realtime carries job status, with scoped HTTP polling as a fallback.
- Supabase Storage holds issue media; the current UI honestly marks media controls as preview-only until the direct-upload flow is enabled.
- The `ai_jobs` table is the durable retry queue, processed independently by a scheduled Supabase Edge Function.
- OpenAI embeddings perform same-ward semantic duplicate checks.
- OpenAI text models generate cached translations and short summaries.
- Sarvam transcribes citizen recordings in the original language.

## Fast and slow paths

Synchronous requests include authentication, voting, issue creation, status transitions, notices, and alert completion. The duplicate screen currently compares visible same-ward reports; semantic embeddings are available as an async job type for a later ranking pass. All external calls receive abort timeouts.

Audio transcription, long translations, summarization, and notification delivery are jobs. The browser receives a job ID immediately and observes status through Supabase Realtime. Jobs are idempotent and retryable.

## Privacy boundary

Public profiles and private citizen data are separate tables. Citizens see other citizens by name only. A parshad may read private details only for citizens in the parshad's own ward. Corporation administrators do not receive ward-private citizen details by default.

## Directory ownership for parallel work

- src/app and src/components/shell: lead integration
- src/features/citizen: citizen workstream
- src/features/admin: parshad and corporation workstream
- src/data and tests: fixtures and verification workstream
- supabase and src/lib/server: lead security work

Shared domain contracts live in src/lib/domain and are changed only by the lead during parallel implementation.
