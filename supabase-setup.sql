-- Mikye Media — public database schema only.
-- IMPORTANT: supplier names, acquisition costs, and private inventory are intentionally NOT stored in this public repository.
-- Run the private inventory migration supplied separately in Supabase after this schema exists.

create extension if not exists pgcrypto;

create table if not exists inventory (
  id bigserial primary key,
  handle text not null,
  platform text not null check (platform in ('Instagram','TikTok','Twitter','Snapchat')),
  kind text not null check (kind in ('2L','3L','4L','Word','5+')),
  source text not null,
  cost numeric(10,2) not null,
  sale_price numeric(10,2) not null,
  status text not null default 'available' check (status in ('available','reserved','sold')),
  reserved_until timestamptz,
  unique(handle,platform)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  inventory_id bigint not null references inventory(id),
  buyer_email text not null,
  payment_method text not null,
  payer_name text not null,
  payment_ref text not null,
  buyer_note text,
  status text not null default 'pending' check (status in ('pending','fulfilled','cancelled')),
  created_at timestamptz not null default now(),
  reserved_until timestamptz not null,
  payment_verified_at timestamptz,
  secured_at timestamptz,
  fulfilled_at timestamptz
);

alter table orders add column if not exists payment_verified_at timestamptz;
alter table orders add column if not exists secured_at timestamptz;

create or replace function release_expired_reservations() returns void language plpgsql security definer as $$
begin
  update inventory i set status='available', reserved_until=null
  where status='reserved' and reserved_until < now()
  and not exists (
    select 1 from orders o
    where o.inventory_id=i.id
      and (o.status='fulfilled' or (o.status='pending' and o.payment_verified_at is not null))
  );
  update orders set status='cancelled'
  where status='pending' and payment_verified_at is null and reserved_until < now();
end;$$;

create or replace function create_order(
  p_inventory_id bigint, p_buyer_email text, p_payment_method text, p_payer_name text, p_payment_ref text, p_buyer_note text
) returns table(public_id text, handle text, platform text, kind text, source text, cost numeric, sale_price numeric, reserved_until timestamptz)
language plpgsql security definer as $$
declare item inventory%rowtype; oid text; until_ts timestamptz;
begin
  perform release_expired_reservations();
  update inventory set status='reserved', reserved_until=now()+interval '30 minutes'
    where id=p_inventory_id and status='available'
    returning * into item;
  if not found then raise exception 'ITEM_NOT_AVAILABLE'; end if;
  oid := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  until_ts := item.reserved_until;
  insert into orders(public_id,inventory_id,buyer_email,payment_method,payer_name,payment_ref,buyer_note,reserved_until)
    values(oid,item.id,p_buyer_email,p_payment_method,p_payer_name,p_payment_ref,nullif(p_buyer_note,''),until_ts);
  return query select oid,item.handle,item.platform,item.kind,item.source,item.cost,item.sale_price,until_ts;
end;$$;

alter table inventory enable row level security;
alter table orders enable row level security;
