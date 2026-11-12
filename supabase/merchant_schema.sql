-- Apply to a dedicated Qponic Supabase project, not another app's database.
create extension if not exists pgcrypto;
create table if not exists public.merchants (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 2 and 150),
 created_at timestamptz not null default now()
);
create table if not exists public.merchant_memberships (
 merchant_id uuid not null references public.merchants(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key (merchant_id,user_id)
);
create table if not exists public.offers (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete cascade,
 title text not null,
 description text not null,
 type text not null check(type in ('FREE','BOGO','50% OFF')),
 terms text not null,
 expiration text not null,
 redemption_limit text not null,
 redemption_method text not null,
 status text not null default 'draft' check(status in ('draft','pending_review','published','paused','expired')),
 created_at timestamptz not null default now()
);
alter table public.merchants enable row level security;
alter table public.merchant_memberships enable row level security;
alter table public.offers enable row level security;
create policy "merchant membership self read" on public.merchant_memberships for select to authenticated using (user_id=(select auth.uid()));
create policy "merchant own records read" on public.merchants for select to authenticated using (exists(select 1 from public.merchant_memberships mm where mm.merchant_id=id and mm.user_id=(select auth.uid())));
create policy "merchant own offers read" on public.offers for select to authenticated using (exists(select 1 from public.merchant_memberships mm where mm.merchant_id=offers.merchant_id and mm.user_id=(select auth.uid())));
create policy "merchant own drafts insert" on public.offers for insert to authenticated with check(status='draft' and exists(select 1 from public.merchant_memberships mm where mm.merchant_id=offers.merchant_id and mm.user_id=(select auth.uid())));
create policy "merchant own drafts update" on public.offers for update to authenticated using(status='draft' and exists(select 1 from public.merchant_memberships mm where mm.merchant_id=offers.merchant_id and mm.user_id=(select auth.uid()))) with check(status in ('draft','pending_review') and exists(select 1 from public.merchant_memberships mm where mm.merchant_id=offers.merchant_id and mm.user_id=(select auth.uid())));
-- Merchant and membership creation is administrator-managed during beta.
-- Public offer discovery will require a separate read-only policy for published offers.
