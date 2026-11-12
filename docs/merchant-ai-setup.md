# Merchant AI Offer Builder — Beta setup

## Configuration
1. Create a dedicated Qponic Supabase project and apply `supabase/merchant_schema.sql` in its SQL editor.
2. Set up Supabase Auth and provision a merchant plus a membership for the signed-in user.
3. In Netlify > Project configuration > Environment variables, add `OPENAI_API_KEY` as a **server-side secret**, plus `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Optionally set `OPENAI_MODEL=gpt-4.1-mini`.
4. Deploy branch `develop`. Do not commit real keys or use `VITE_OPENAI_API_KEY`.
5. Call POST `/.netlify/functions/merchant-offer` with an Authorization header `Bearer <Supabase access token>` and body `{"messages":[{"role":"user","content":"I want to offer a free coffee on Tuesdays"}]}`.
6. Display the returned reply; repeat with chat history. When ready, show the structured draft for review. Save it as status `draft` under the returned merchant ID, then submit for moderation. Never auto-publish.

## Security
This endpoint requires a valid Supabase session and merchant membership. The key stays server-side. Before public launch, add per-merchant quotas/rate limiting, abuse detection, structured audit logs, and a moderator approval workflow. All AI output is untrusted and must be validated again before database write. The database RLS policies prevent merchant-created offers from becoming published without a separate administrative process.
