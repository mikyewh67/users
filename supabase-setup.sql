-- Run this once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists inventory (
  id bigserial primary key,
  handle text not null,
  platform text not null check (platform in ('Instagram','TikTok')),
  kind text not null check (kind in ('3L','4L')),
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
  fulfilled_at timestamptz
);

create or replace function release_expired_reservations() returns void language plpgsql security definer as $$
begin
  update inventory i set status='available', reserved_until=null
  where status='reserved' and reserved_until < now()
  and not exists (select 1 from orders o where o.inventory_id=i.id and o.status='fulfilled');
  update orders set status='cancelled' where status='pending' and reserved_until < now();
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

insert into inventory(handle,platform,kind,source,cost,sale_price,status) values
('@sbd','Instagram','3L','Darkoo',2300,2999,'available'),
('@yfy','Instagram','3L','Darkoo',1800,2499,'available'),
('@xu_','Instagram','3L','Darkoo',1800,2299,'available'),
('@xob','Instagram','3L','Darkoo',1300,1999,'available'),
('@_y0','Instagram','3L','Darkoo',1300,1699,'available'),
('@y43','Instagram','3L','Darkoo',1300,1799,'available'),
('@gu_','Instagram','3L','Darkoo',1300,1699,'available'),
('@_ql','Instagram','3L','Darkoo',1300,1699,'available'),
('@p_w','Instagram','3L','Darkoo',1300,1699,'available'),
('@cka','Instagram','3L','Darkoo',1300,1999,'available'),
('@bzi','Instagram','3L','Darkoo',1300,1999,'available'),
('@4_y','Instagram','3L','Darkoo',1000,1399,'available'),
('@1vz','Instagram','3L','Darkoo',850,1199,'available'),
('@li4','Instagram','3L','Darkoo',850,1199,'available'),
('@2e7','Instagram','3L','Darkoo',850,1199,'available'),
('@n4z','Instagram','3L','Darkoo',850,1199,'available'),
('@qfk','Instagram','3L','Darkoo',800,1199,'available'),
('@3r1','Instagram','3L','Darkoo',800,1099,'available'),
('@z8i','Instagram','3L','Darkoo',700,999,'available'),
('@o7l','Instagram','3L','Darkoo',700,999,'available'),
('@bs6','Instagram','3L','Darkoo',650,949,'available'),
('@bq9','Instagram','3L','Darkoo',600,899,'available'),
('@3iy','Instagram','3L','Darkoo',600,899,'available'),
('@9pt','Instagram','3L','Darkoo',600,899,'available'),
('@wlcb','Instagram','4L','Darkoo',75,150,'available'),
('@ehgd','Instagram','4L','Darkoo',75,150,'available'),
('@ocbp','Instagram','4L','Darkoo',75,150,'available'),
('@gqit','Instagram','4L','Darkoo',75,150,'available'),
('@oqhy','Instagram','4L','Darkoo',75,150,'available'),
('@hywq','Instagram','4L','Darkoo',75,150,'available'),
('@jyab','Instagram','4L','Darkoo',75,150,'available'),
('@mbge','Instagram','4L','Darkoo',75,150,'available'),
('@kpxu','Instagram','4L','Darkoo',75,150,'available'),
('@afpu','Instagram','4L','Darkoo',75,150,'available'),
('@qztw','Instagram','4L','Darkoo',75,150,'available'),
('@pzlv','Instagram','4L','Darkoo',75,150,'available'),
('@dycg','Instagram','4L','Darkoo',75,150,'available'),
('@hufw','Instagram','4L','Darkoo',75,150,'available'),
('@cusj','Instagram','4L','Darkoo',75,150,'available'),
('@ukpr','Instagram','4L','Darkoo',75,150,'available'),
('@enat','Instagram','4L','Darkoo',190,399,'available'),
('@hepr','Instagram','4L','Darkoo',190,375,'available'),
('@wawr','Instagram','4L','Darkoo',190,375,'available'),
('@oex_','Instagram','4L','Darkoo',190,350,'available'),
('@wamr','Instagram','4L','Darkoo',135,299,'available'),
('@oxwr','Instagram','4L','Darkoo',135,275,'available'),
('@wsiv','Instagram','4L','Darkoo',135,275,'available'),
('@ladb','Instagram','4L','Darkoo',135,299,'available'),
('@btj','TikTok','3L','Tailgated',220,450,'available'),
('@dly','TikTok','3L','Tailgated',229,475,'available'),
('@xfp','TikTok','3L','Tailgated',229,450,'available'),
('@qdb','TikTok','3L','Tailgated',230,450,'available'),
('@msp','TikTok','3L','Tailgated',250,500,'available'),
('@qft','TikTok','3L','Tailgated',270,500,'available'),
('@dkz','TikTok','3L','Tailgated',275,525,'available'),
('@ulg','TikTok','3L','Tailgated',279,550,'available'),
('@hvw','TikTok','3L','Tailgated',300,550,'available'),
('@rkl','TikTok','3L','Tailgated',300,575,'available'),
('@tvb','TikTok','3L','Tailgated',300,575,'available'),
('@evx','TikTok','3L','Tailgated',300,600,'available'),
('@nzs','TikTok','3L','Tailgated',305,575,'available'),
('@hmz','TikTok','3L','Tailgated',320,600,'available'),
('@nzy','TikTok','3L','Tailgated',330,625,'available'),
('@mrf','TikTok','3L','Tailgated',330,625,'available'),
('@bavh','TikTok','4L','Tailgated',10,75,'available'),
('@gteb','TikTok','4L','Tailgated',10,75,'available'),
('@wpgr','TikTok','4L','Tailgated',10,80,'available'),
('@kgea','TikTok','4L','Tailgated',10,85,'available'),
('@hmlt','TikTok','4L','Tailgated',10,85,'available'),
('@mtso','TikTok','4L','Tailgated',10,90,'available'),
('@vgez','TikTok','4L','Tailgated',10,90,'available'),
('@kveb','TikTok','4L','Tailgated',10,90,'available'),
('@ymit','TikTok','4L','Tailgated',10,95,'available'),
('@mjab','TikTok','4L','Tailgated',10,95,'available'),
('@qorb','TikTok','4L','Tailgated',10,95,'available'),
('@gdav','TikTok','4L','Tailgated',10,100,'available'),
('@sjaw','TikTok','4L','Tailgated',10,100,'available'),
('@pmao','TikTok','4L','Tailgated',10,100,'available'),
('@jbon','TikTok','4L','Tailgated',10,110,'available'),
('@gwip','TikTok','4L','Tailgated',10,110,'available')
on conflict(handle,platform) do update set kind=excluded.kind,source=excluded.source,cost=excluded.cost,sale_price=excluded.sale_price;

-- Lock tables down from public clients; server routes use the service-role key.
alter table inventory enable row level security;
alter table orders enable row level security;
