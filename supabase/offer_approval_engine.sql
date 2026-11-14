-- Qponic Offer Approval Engine. Apply only to Qponic.
create table if not exists public.qponic_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.qponic_admins enable row level security;
create table if not exists public.offer_revisions (
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.offers(id) on delete cascade,
 revision_number integer not null check(revision_number>0),
 submitted_by uuid not null references auth.users(id),
 role text not null check(role in ('merchant','admin')),
 title text not null, description text not null, type text not null check(type in ('FREE','BOGO','50% OFF')),
 terms text not null, expiration text not null, redemption_limit text not null, redemption_method text not null,
 created_at timestamptz not null default now(),
 unique(offer_id,revision_number)
);
create table if not exists public.offer_review_events (
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.offers(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('submitted','approved','changes_requested','revised','declined')),
 notes text,
 proposed_revision_id uuid references public.offer_revisions(id),
 created_at timestamptz not null default now()
);
create table if not exists public.offer_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 offer_id uuid not null references public.offers(id) on delete cascade,
 event_id uuid not null references public.offer_review_events(id) on delete cascade,
 read_at timestamptz,
 created_at timestamptz not null default now(),
 unique(recipient_id,event_id)
);
alter table public.offer_revisions enable row level security;
alter table public.offer_review_events enable row level security;
alter table public.offer_notifications enable row level security;
alter table public.offers add column if not exists review_version integer not null default 0;
alter table public.offers add column if not exists approved_version integer;
alter table public.offers add column if not exists updated_at timestamptz not null default now();
alter table public.offers drop constraint if exists offers_status_check;
alter table public.offers add constraint offers_status_check check(status in ('draft','pending_review','changes_requested','published','declined','paused','expired'));
create index if not exists offer_review_events_offer_idx on public.offer_review_events(offer_id,created_at desc);
create index if not exists offer_notifications_recipient_idx on public.offer_notifications(recipient_id,read_at);
create index if not exists offers_status_updated_idx on public.offers(status,updated_at desc);
-- All approval writes happen in one server-authorized RPC; no browser mutation of reviews.
revoke all on public.qponic_admins,public.offer_revisions,public.offer_review_events,public.offer_notifications from anon,authenticated;
-- Existing direct offer update policy is removed to prevent bypassing review.
drop policy if exists "merchant own drafts update" on public.offers;
drop policy if exists "merchant own drafts insert" on public.offers;
create policy "merchant own drafts insert" on public.offers for insert to authenticated
with check(status='draft' and review_version=0 and approved_version is null and exists(select 1 from public.merchant_memberships m where m.merchant_id=offers.merchant_id and m.user_id=(select auth.uid())));
-- Keep draft creation server-side for new flows; legacy browser insert remains limited to drafts.
create or replace function public.qponic_offer_transition(
 p_actor uuid,p_offer uuid,p_action text,p_notes text default null,p_proposal jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_offer public.offers%rowtype;v_admin boolean;v_owner boolean;v_revision uuid;v_event uuid;v_version int;v_proposal jsonb;v_user uuid;
begin
 if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
 select * into v_offer from public.offers where id=p_offer for update;
 if not found then raise exception 'Offer not found'; end if;
 select exists(select 1 from public.qponic_admins where user_id=p_actor) into v_admin;
 select exists(select 1 from public.merchant_memberships where user_id=p_actor and merchant_id=v_offer.merchant_id) into v_owner;
 if not (v_admin or v_owner) then raise exception 'Not authorized'; end if;
 if p_action='submit' then
   if not v_owner or v_offer.status not in ('draft','changes_requested') then raise exception 'Invalid submission'; end if;
   if p_proposal is not null then
     v_proposal:=p_proposal;
   else
     v_proposal:=jsonb_build_object('title',v_offer.title,'description',v_offer.description,'type',v_offer.type,'terms',v_offer.terms,'expiration',v_offer.expiration,'redemption_limit',v_offer.redemption_limit,'redemption_method',v_offer.redemption_method);
   end if;
   if exists(select 1 from jsonb_each_text(v_proposal) as kv(key,value) where lower(kv.value) like '%merchant to confirm%') then raise exception 'Complete all unconfirmed offer terms before submission'; end if;
   if (v_proposal->>'type') not in ('FREE','BOGO','50% OFF') or exists(select 1 from jsonb_array_elements_text(to_jsonb(array['title','description','terms','expiration','redemption_limit','redemption_method'])) as keys(value) where nullif(btrim(v_proposal->>keys.value), '') is null) then raise exception 'Incomplete offer'; end if;
   select coalesce(max(revision_number),0)+1 into v_version from public.offer_revisions where offer_id=p_offer;
   update public.offers set title=v_proposal->>'title',description=v_proposal->>'description',type=v_proposal->>'type',terms=v_proposal->>'terms',expiration=v_proposal->>'expiration',redemption_limit=v_proposal->>'redemption_limit',redemption_method=v_proposal->>'redemption_method',status='pending_review',review_version=v_version,approved_version=null,updated_at=now() where id=p_offer;
   insert into public.offer_revisions(offer_id,revision_number,submitted_by,role,title,description,type,terms,expiration,redemption_limit,redemption_method)
   values(p_offer,v_version,p_actor,'merchant',v_proposal->>'title',v_proposal->>'description',v_proposal->>'type',v_proposal->>'terms',v_proposal->>'expiration',v_proposal->>'redemption_limit',v_proposal->>'redemption_method') returning id into v_revision;
   insert into public.offer_review_events(offer_id,actor_id,action,notes,proposed_revision_id) values(p_offer,p_actor,case when v_offer.review_version=0 then 'submitted' else 'revised' end,null,v_revision) returning id into v_event;
   insert into public.offer_notifications(recipient_id,offer_id,event_id) select user_id,p_offer,v_event from public.qponic_admins on conflict do nothing;
 elsif p_action='approve' then
   if not v_admin or v_offer.status<>'pending_review' then raise exception 'Invalid approval'; end if;
   update public.offers set status='published',approved_version=review_version,updated_at=now() where id=p_offer;
   insert into public.offer_review_events(offer_id,actor_id,action,notes) values(p_offer,p_actor,'approved',p_notes) returning id into v_event;
   insert into public.offer_notifications(recipient_id,offer_id,event_id) select user_id,p_offer,v_event from public.merchant_memberships where merchant_id=v_offer.merchant_id on conflict do nothing;
 elsif p_action in ('request_changes','decline') then
   if not v_admin or v_offer.status<>'pending_review' or nullif(btrim(p_notes),'') is null then raise exception 'Notes and pending offer required'; end if;
   if p_action='request_changes' and p_proposal is not null then
     v_proposal:=p_proposal;
     if exists(select 1 from jsonb_each_text(v_proposal) as kv(key,value) where lower(kv.value) like '%merchant to confirm%') then raise exception 'Complete all unconfirmed offer terms before submission'; end if;
   if (v_proposal->>'type') not in ('FREE','BOGO','50% OFF') or exists(select 1 from jsonb_array_elements_text(to_jsonb(array['title','description','terms','expiration','redemption_limit','redemption_method'])) as keys(value) where nullif(btrim(v_proposal->>keys.value), '') is null) then raise exception 'Incomplete proposed revision'; end if;
     select coalesce(max(revision_number),0)+1 into v_version from public.offer_revisions where offer_id=p_offer;
     insert into public.offer_revisions(offer_id,revision_number,submitted_by,role,title,description,type,terms,expiration,redemption_limit,redemption_method)
     values(p_offer,v_version,p_actor,'admin',v_proposal->>'title',v_proposal->>'description',v_proposal->>'type',v_proposal->>'terms',v_proposal->>'expiration',v_proposal->>'redemption_limit',v_proposal->>'redemption_method') returning id into v_revision;
   end if;
   update public.offers set status=case when p_action='decline' then 'declined' else 'changes_requested' end,updated_at=now() where id=p_offer;
   insert into public.offer_review_events(offer_id,actor_id,action,notes,proposed_revision_id) values(p_offer,p_actor,case when p_action='decline' then 'declined' else 'changes_requested' end,p_notes,v_revision) returning id into v_event;
   insert into public.offer_notifications(recipient_id,offer_id,event_id) select user_id,p_offer,v_event from public.merchant_memberships where merchant_id=v_offer.merchant_id on conflict do nothing;
 else raise exception 'Unsupported transition'; end if;
 return jsonb_build_object('offer_id',p_offer,'status',(select status from public.offers where id=p_offer),'event_id',v_event);
end $$;
revoke all on function public.qponic_offer_transition(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.qponic_offer_transition(uuid,uuid,text,text,jsonb) to service_role;
