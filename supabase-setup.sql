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
  fulfilled_at timestamptz,
  list_price numeric(10,2),
  sale_amount numeric(10,2),
  discount_code text,
  discount_amount numeric(10,2) not null default 0
);

alter table orders add column if not exists payment_verified_at timestamptz;
alter table orders add column if not exists secured_at timestamptz;
alter table orders add column if not exists list_price numeric(10,2);
alter table orders add column if not exists sale_amount numeric(10,2);
alter table orders add column if not exists discount_code text;
alter table orders add column if not exists discount_amount numeric(10,2) not null default 0;

create table if not exists promo_claims (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  inventory_id bigint not null references inventory(id),
  discount_amount numeric(10,2) not null,
  final_amount numeric(10,2) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  order_public_id text
);
create index if not exists promo_claims_code_idx on promo_claims(code);
create index if not exists promo_claims_expires_idx on promo_claims(expires_at);

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
  insert into orders(public_id,inventory_id,buyer_email,payment_method,payer_name,payment_ref,buyer_note,reserved_until,list_price,sale_amount)
    values(oid,item.id,p_buyer_email,p_payment_method,p_payer_name,p_payment_ref,nullif(p_buyer_note,''),until_ts,item.sale_price,item.sale_price);
  return query select oid,item.handle,item.platform,item.kind,item.source,item.cost,item.sale_price,until_ts;
end;$$;

create or replace function claim_launch_promo(
  p_inventory_id bigint,
  p_code text
) returns table(promo_token uuid,code text,list_price numeric,discount_amount numeric,final_amount numeric,expires_at timestamptz,remaining integer)
language plpgsql security definer as $$
declare item inventory%rowtype; normalized text; active_count integer; discount numeric(10,2); final_price numeric(10,2); claim_id uuid; claim_expiry timestamptz;
begin
  normalized := upper(trim(coalesce(p_code,'')));
  if normalized <> 'LAUNCH15' then raise exception 'PROMO_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtext('MIKYE_MEDIA_LAUNCH15'));
  select * into item from inventory where id=p_inventory_id and status='available';
  if not found then raise exception 'ITEM_NOT_AVAILABLE'; end if;
  select count(*)::int into active_count
  from promo_claims pc left join orders o on o.public_id=pc.order_public_id
  where pc.code='LAUNCH15' and ((pc.used_at is null and pc.expires_at>now()) or (pc.used_at is not null and o.status in ('pending','fulfilled')));
  if active_count>=10 then raise exception 'PROMO_SOLD_OUT'; end if;
  discount:=least(round(item.sale_price*0.15,2),25.00); final_price:=greatest(item.sale_price-discount,0.01); claim_expiry:=now()+interval '20 minutes';
  insert into promo_claims(code,inventory_id,discount_amount,final_amount,expires_at) values('LAUNCH15',item.id,discount,final_price,claim_expiry) returning id into claim_id;
  return query select claim_id,'LAUNCH15'::text,item.sale_price,discount,final_price,claim_expiry,(9-active_count)::int;
end;$$;

create or replace function create_order_v2(
  p_inventory_id bigint,p_buyer_email text,p_payment_method text,p_payer_name text,p_payment_ref text,p_buyer_note text,p_promo_token uuid default null
) returns table(public_id text,handle text,platform text,kind text,source text,cost numeric,list_price numeric,discount_code text,discount_amount numeric,sale_amount numeric,reserved_until timestamptz)
language plpgsql security definer as $$
declare item inventory%rowtype; claim promo_claims%rowtype; oid text; until_ts timestamptz; applied_code text:=null; applied_discount numeric(10,2):=0; final_price numeric(10,2);
begin
  perform release_expired_reservations();
  if p_promo_token is not null then
    select * into claim from promo_claims where id=p_promo_token for update;
    if not found or claim.used_at is not null or claim.expires_at<=now() or claim.inventory_id<>p_inventory_id then raise exception 'PROMO_EXPIRED'; end if;
    applied_code:=claim.code; applied_discount:=claim.discount_amount;
  end if;
  update inventory set status='reserved',reserved_until=now()+interval '30 minutes' where id=p_inventory_id and status='available' returning * into item;
  if not found then raise exception 'ITEM_NOT_AVAILABLE'; end if;
  final_price:=greatest(item.sale_price-applied_discount,0.01);
  if p_promo_token is not null and abs(final_price-claim.final_amount)>0.01 then raise exception 'PROMO_PRICE_CHANGED'; end if;
  oid:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); until_ts:=item.reserved_until;
  insert into orders(public_id,inventory_id,buyer_email,payment_method,payer_name,payment_ref,buyer_note,reserved_until,list_price,sale_amount,discount_code,discount_amount)
  values(oid,item.id,p_buyer_email,p_payment_method,p_payer_name,p_payment_ref,nullif(p_buyer_note,''),until_ts,item.sale_price,final_price,applied_code,applied_discount);
  if p_promo_token is not null then update promo_claims set used_at=now(),order_public_id=oid where id=p_promo_token; end if;
  return query select oid,item.handle,item.platform,item.kind,item.source,item.cost,item.sale_price,applied_code,applied_discount,final_price,until_ts;
end;$$;

alter table inventory enable row level security;
alter table orders enable row level security;
alter table promo_claims enable row level security;
