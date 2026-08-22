-- Run this ONCE in Supabase SQL Editor before enabling the Telegram control-center webhook.
-- Safe to run again because the columns use IF NOT EXISTS.

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
  where status='pending'
    and payment_verified_at is null
    and reserved_until < now();
end;$$;
