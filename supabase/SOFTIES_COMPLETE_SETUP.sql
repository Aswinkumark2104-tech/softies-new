-- SOFTIES COMPLETE SETUP / MIGRATION
-- Run this in Supabase SQL Editor against the existing SOFTIES project.
-- This migration is additive and is designed for the current tables:
-- products(id,name,description,category,price,offer_price,image_url,stock_quantity,is_active,...)
-- orders(id,user_id,customer_name,email,phone,address,city,state,pincode,total_amount,payment_method,payment_status,order_status,tracking_id,tracking_notes,...)
-- order_items(id,order_id,product_id,product_name,quantity,unit_price,...)
-- tracking_updates(id,order_id,status,message,tracking_number,...)

-- -----------------------------------------------------------------------------
-- 1. Add the optional compatibility and commerce columns used by the storefront.
-- -----------------------------------------------------------------------------
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists offer_price numeric(10,2);
alter table public.products add column if not exists stock_quantity integer not null default 0;
alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists emoji text default '🧸';
alter table public.products add column if not exists color text default '#fff0bd';
alter table public.products add column if not exists rating numeric(2,1) default 4.8;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.products alter column stock_quantity set default 0;
alter table public.products alter column is_active set default true;
alter table public.products alter column created_at set default now();
alter table public.products alter column updated_at set default now();

-- Synchronize the older optional stock column if it already contains inventory.
update public.products set stock_quantity = stock where stock_quantity = 0 and stock > 0;
update public.products set stock = stock_quantity where stock = 0 and stock_quantity > 0;

alter table public.orders add column if not exists tracking_id text;
alter table public.orders add column if not exists tracking_notes text;
alter table public.orders add column if not exists payment_method text not null default 'COD';
alter table public.orders add column if not exists payment_status text not null default 'PENDING';
alter table public.orders add column if not exists order_status text not null default 'PLACED';
alter table public.orders add column if not exists razorpay_order_id text;
alter table public.orders add column if not exists razorpay_payment_id text;
alter table public.orders add column if not exists payment_verified_at timestamptz;
alter table public.orders add column if not exists stock_deducted boolean not null default false;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders alter column updated_at set default now();

-- -----------------------------------------------------------------------------
-- 2. Private admin allow-list and security-definer role check.
-- -----------------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

create or replace function public.is_softies_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_softies_admin() from public;
grant execute on function public.is_softies_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Enable RLS and create narrowly scoped policies.
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tracking_updates enable row level security;

-- Anyone may read active products. Only an authenticated admin can manage products.
drop policy if exists "SOFTIES public active products" on public.products;
create policy "SOFTIES public active products" on public.products for select to anon, authenticated using (is_active = true);
drop policy if exists "SOFTIES admin all products" on public.products;
create policy "SOFTIES admin all products" on public.products for all to authenticated using (public.is_softies_admin()) with check (public.is_softies_admin());

-- Remove earlier direct-client order creation policies. Order creation now goes through the trusted Edge Functions.
drop policy if exists "orders insert own" on public.orders;
drop policy if exists "customers create own orders" on public.orders;
drop policy if exists "order items insert own order" on public.order_items;
drop policy if exists "customers create own order items" on public.order_items;

-- Customers see only their own orders. Admins see and update all orders.
drop policy if exists "SOFTIES customer own orders" on public.orders;
create policy "SOFTIES customer own orders" on public.orders for select to authenticated using (user_id = auth.uid());
drop policy if exists "SOFTIES admin all orders" on public.orders;
create policy "SOFTIES admin all orders" on public.orders for select to authenticated using (public.is_softies_admin());
drop policy if exists "SOFTIES admin update orders" on public.orders;
create policy "SOFTIES admin update orders" on public.orders for update to authenticated using (public.is_softies_admin()) with check (public.is_softies_admin());

-- Customers see only line items belonging to their own order; admins can see all lines.
drop policy if exists "SOFTIES customer own order items" on public.order_items;
create policy "SOFTIES customer own order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));
drop policy if exists "SOFTIES admin all order items" on public.order_items;
create policy "SOFTIES admin all order items" on public.order_items for select to authenticated using (public.is_softies_admin());

-- Customer tracking timeline is visible only for their own orders; admins add updates.
drop policy if exists "SOFTIES customer own tracking updates" on public.tracking_updates;
create policy "SOFTIES customer own tracking updates" on public.tracking_updates for select to authenticated
  using (exists (select 1 from public.orders o where o.id = tracking_updates.order_id and o.user_id = auth.uid()));
drop policy if exists "SOFTIES admin insert tracking updates" on public.tracking_updates;
create policy "SOFTIES admin insert tracking updates" on public.tracking_updates for insert to authenticated with check (public.is_softies_admin());
drop policy if exists "SOFTIES admin read tracking updates" on public.tracking_updates;
create policy "SOFTIES admin read tracking updates" on public.tracking_updates for select to authenticated using (public.is_softies_admin());

-- -----------------------------------------------------------------------------
-- 4. Public image bucket with authenticated-admin-only uploads.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists "SOFTIES public product photos" on storage.objects;
create policy "SOFTIES public product photos" on storage.objects for select to public using (bucket_id = 'product-images');
drop policy if exists "SOFTIES admin upload product photos" on storage.objects;
create policy "SOFTIES admin upload product photos" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_softies_admin());
drop policy if exists "SOFTIES admin update product photos" on storage.objects;
create policy "SOFTIES admin update product photos" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_softies_admin()) with check (bucket_id = 'product-images' and public.is_softies_admin());
drop policy if exists "SOFTIES admin delete product photos" on storage.objects;
create policy "SOFTIES admin delete product photos" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_softies_admin());

-- -----------------------------------------------------------------------------
-- 5. Trusted order-creation function. It prices from the database, locks product
-- rows, checks quantity and inserts the order + order lines in one transaction.
-- COD orders deduct stock immediately. Razorpay orders are checked now and stock
-- is deducted only after provider-side payment verification.
-- -----------------------------------------------------------------------------
create or replace function public.softies_create_order(
  p_user_id uuid,
  p_email text,
  p_customer_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_state text,
  p_pincode text,
  p_payment_method text,
  p_items jsonb,
  p_reserve_stock boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_product public.products%rowtype;
  v_order_id bigint;
  v_qty integer;
  v_unit_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_tracking_id text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' and current_user <> 'postgres' then
    raise exception 'Not authorized to create store orders';
  end if;
  if p_user_id is null or coalesce(trim(p_email), '') = '' or coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Customer account details are missing';
  end if;
  if p_payment_method not in ('COD','RAZORPAY') then raise exception 'Unsupported payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'Your cart is empty or contains too many products';
  end if;
  if (p_payment_method = 'COD' and p_reserve_stock is distinct from true) or (p_payment_method = 'RAZORPAY' and p_reserve_stock is distinct from false) then
    raise exception 'Invalid inventory reservation mode';
  end if;

  -- Aggregate duplicates and lock in product-id order to reduce deadlock risk.
  for v_item in
    select (x.value->>'id')::bigint as product_id, sum((x.value->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as x(value)
    group by (x.value->>'id')::bigint
    order by (x.value->>'id')::bigint
  loop
    v_qty := v_item.quantity;
    if v_item.product_id is null or v_item.product_id <= 0 or v_qty < 1 or v_qty > 20 then raise exception 'A cart item is invalid'; end if;
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then raise exception 'A product in your cart no longer exists'; end if;
    if v_product.is_active is not true then raise exception '% is currently unavailable', v_product.name; end if;
    if coalesce(v_product.stock_quantity, 0) < v_qty then raise exception 'Only % unit(s) of % are available', coalesce(v_product.stock_quantity,0), v_product.name; end if;
    v_unit_price := case when v_product.offer_price is not null and v_product.offer_price > 0 and v_product.offer_price < v_product.price then v_product.offer_price else v_product.price end;
    if v_unit_price is null or v_unit_price <= 0 then raise exception 'Invalid price for %', v_product.name; end if;
    v_total := v_total + (v_unit_price * v_qty);
  end loop;

  insert into public.orders (
    user_id, customer_name, email, phone, address, city, state, pincode,
    total_amount, payment_method, payment_status, order_status, stock_deducted, created_at, updated_at
  ) values (
    p_user_id, trim(p_customer_name), lower(trim(p_email)), trim(p_phone), trim(p_address), trim(p_city), trim(p_state), trim(p_pincode),
    round(v_total, 2), p_payment_method, 'PENDING', case when p_payment_method = 'COD' then 'PLACED' else 'PAYMENT_PENDING' end, false, now(), now()
  ) returning id into v_order_id;

  for v_item in
    select (x.value->>'id')::bigint as product_id, sum((x.value->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as x(value)
    group by (x.value->>'id')::bigint
    order by (x.value->>'id')::bigint
  loop
    select * into v_product from public.products where id = v_item.product_id;
    v_qty := v_item.quantity;
    v_unit_price := case when v_product.offer_price is not null and v_product.offer_price > 0 and v_product.offer_price < v_product.price then v_product.offer_price else v_product.price end;
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, created_at)
    values (v_order_id, v_product.id, v_product.name, v_qty, v_unit_price, now());
    if p_reserve_stock then
      update public.products set stock_quantity = stock_quantity - v_qty, stock = greatest(stock_quantity - v_qty, 0), updated_at = now()
      where id = v_product.id;
    end if;
  end loop;

  v_tracking_id := 'SOF-' || lpad(v_order_id::text, 6, '0');
  update public.orders set tracking_id = v_tracking_id, stock_deducted = p_reserve_stock, updated_at = now() where id = v_order_id;
  if p_reserve_stock then
    update public.orders set payment_status = 'PENDING' where id = v_order_id;
  end if;
  return jsonb_build_object(
    'id', v_order_id, 'user_id', p_user_id, 'customer_name', trim(p_customer_name), 'email', lower(trim(p_email)),
    'phone', trim(p_phone), 'address', trim(p_address), 'city', trim(p_city), 'state', trim(p_state), 'pincode', trim(p_pincode),
    'total_amount', round(v_total, 2), 'payment_method', p_payment_method, 'payment_status', 'PENDING',
    'order_status', case when p_payment_method = 'COD' then 'PLACED' else 'PAYMENT_PENDING' end, 'tracking_id', v_tracking_id, 'created_at', now()
  );
end;
$$;
revoke all on function public.softies_create_order(uuid,text,text,text,text,text,text,text,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.softies_create_order(uuid,text,text,text,text,text,text,text,text,jsonb,boolean) to service_role;

-- -----------------------------------------------------------------------------
-- 6. Mark a verified Razorpay payment as paid and deduct stock atomically.
-- This function is idempotent: retrying the same paid order does not double
-- deduct inventory.
-- -----------------------------------------------------------------------------
create or replace function public.softies_mark_order_paid(
  p_order_id bigint,
  p_razorpay_payment_id text,
  p_razorpay_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_rows integer;
  v_tracking_id text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' and current_user <> 'postgres' then
    raise exception 'Not authorized to finalize store payments';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order does not exist'; end if;
  if v_order.payment_status = 'PAID' then
    return jsonb_build_object('tracking_id', v_order.tracking_id, 'total_amount', v_order.total_amount, 'already_paid', true);
  end if;
  if v_order.payment_method <> 'RAZORPAY' or v_order.razorpay_order_id <> p_razorpay_order_id then
    raise exception 'Payment does not match this Razorpay order';
  end if;
  if coalesce(p_razorpay_payment_id, '') = '' then raise exception 'Razorpay payment ID is missing'; end if;

  if not coalesce(v_order.stock_deducted, false) then
    for v_item in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = p_order_id and product_id is not null
      group by product_id
      order by product_id
    loop
      update public.products
      set stock_quantity = stock_quantity - v_item.quantity,
          stock = greatest(stock_quantity - v_item.quantity, 0),
          updated_at = now()
      where id = v_item.product_id and stock_quantity >= v_item.quantity;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then raise exception 'Stock changed before payment completed. Contact SOFTIES for assistance with this captured payment.'; end if;
    end loop;
  end if;
  v_tracking_id := coalesce(v_order.tracking_id, 'SOF-' || lpad(p_order_id::text, 6, '0'));
  update public.orders set
    payment_status = 'PAID', order_status = 'CONFIRMED', razorpay_payment_id = p_razorpay_payment_id,
    payment_verified_at = now(), stock_deducted = true, tracking_id = v_tracking_id, updated_at = now()
  where id = p_order_id;
  return jsonb_build_object('tracking_id', v_tracking_id, 'total_amount', v_order.total_amount, 'already_paid', false);
end;
$$;
revoke all on function public.softies_mark_order_paid(bigint,text,text) from public, anon, authenticated;
grant execute on function public.softies_mark_order_paid(bigint,text,text) to service_role;

-- -----------------------------------------------------------------------------
-- 7. Unique payment identifiers and updated timestamps.
-- -----------------------------------------------------------------------------
create unique index if not exists orders_razorpay_order_id_unique on public.orders (razorpay_order_id) where razorpay_order_id is not null;
create unique index if not exists orders_razorpay_payment_id_unique on public.orders (razorpay_payment_id) where razorpay_payment_id is not null;
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists tracking_updates_order_id_created_idx on public.tracking_updates (order_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 8. IMPORTANT: register the admin user after creating it through /account.
-- Replace the UUID below in a separate query after you copy it from
-- Supabase Dashboard > Authentication > Users. Never make every customer admin.
-- Example:
-- insert into public.app_admins (user_id)
-- values ('YOUR-ADMIN-AUTH-USER-UUID-HERE')
-- on conflict (user_id) do nothing;
