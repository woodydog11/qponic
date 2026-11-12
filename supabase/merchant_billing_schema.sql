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

-- Webhook updates are atomic and idempotent. Only service_role may execute.
alter table public.merchant_billing add column if not exists last_event_created bigint not null default 0;
create or replace function public.apply_stripe_billing_event(
 p_event_id text, p_event_created bigint, p_merchant_id uuid, p_user_id uuid,
 p_customer_id text, p_subscription_id text, p_status text,
 p_period_end timestamptz, p_cancel_at_period_end boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if p_event_id is null or length(p_event_id)>255 or p_event_created<1 then raise exception 'Invalid event'; end if;
 if p_merchant_id is null or p_user_id is null then raise exception 'Missing merchant mapping'; end if;
 if not exists(select 1 from public.merchant_memberships where merchant_id=p_merchant_id and user_id=p_user_id) then raise exception 'Invalid merchant membership'; end if;
 insert into public.stripe_webhook_events(event_id) values(p_event_id) on conflict do nothing;
 if not found then return false; end if;
 insert into public.merchant_billing(merchant_id,user_id,stripe_customer_id,stripe_subscription_id,status,current_period_end,cancel_at_period_end,last_event_created)
 values(p_merchant_id,p_user_id,p_customer_id,p_subscription_id,p_status,p_period_end,p_cancel_at_period_end,p_event_created)
 on conflict(merchant_id) do update set
 stripe_customer_id=coalesce(excluded.stripe_customer_id,merchant_billing.stripe_customer_id),
 stripe_subscription_id=coalesce(excluded.stripe_subscription_id,merchant_billing.stripe_subscription_id),
 status=excluded.status,
 current_period_end=excluded.current_period_end,
 cancel_at_period_end=excluded.cancel_at_period_end,
 last_event_created=excluded.last_event_created,
 updated_at=now()
 where merchant_billing.last_event_created<=excluded.last_event_created;
 return true;
end; $$;
revoke all on function public.apply_stripe_billing_event(text,bigint,uuid,uuid,text,text,text,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.apply_stripe_billing_event(text,bigint,uuid,uuid,text,text,text,timestamptz,boolean) to service_role;
