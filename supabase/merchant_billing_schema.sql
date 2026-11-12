-- Run in Qponic only. This table is server-managed; do not grant browser access.
create table if not exists public.merchant_billing (
 merchant_id uuid primary key references public.merchants(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 stripe_customer_id text unique,
 stripe_subscription_id text unique,
 status text not null default 'incomplete',
 current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.merchant_billing enable row level security;
create index if not exists merchant_billing_user_id_idx on public.merchant_billing(user_id);
create table if not exists public.stripe_webhook_events (
 event_id text primary key,
 processed_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
-- No public policies: only trusted server-side service role may access billing data.
