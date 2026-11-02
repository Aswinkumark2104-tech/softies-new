-- SOFTIES: compatibility migration for the current starter schema OR the earlier simple SQL setup.
-- Run in Supabase SQL Editor after the tables have already been created.

-- Add catalogue columns used by the React storefront/admin. stock_quantity is retained for the earlier schema.
alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists stock_quantity integer not null default 0;
alter table public.products add column if not exists old_price numeric(10,2);
alter table public.products add column if not exists emoji text default '🧸';
alter table public.products add column if not exists color text default '#fff0bd';
alter table public.products add column if not exists description text;
alter table public.products add column if not exists category text not null default 'Educational Toys';
alter table public.products add column if not exists is_active boolean not null default true;

-- Carry across stock counts from the earlier schema without overwriting an already populated stock value.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='stock_quantity') then
    update public.products set stock = stock_quantity where stock = 0 and stock_quantity > 0;
    update public.products set stock_quantity = stock where stock_quantity = 0 and stock > 0;
  end if;
end $$;

-- Order fields used by the customer tracking view. Additive so existing order data is preserved.
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists email text;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists phone text;
alter table public.orders add column if not exists address text;
alter table public.orders add column if not exists shipping_address jsonb;
alter table public.orders add column if not exists status text not null default 'pending';
alter table public.orders add column if not exists order_status text;
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists tracking_id text;
alter table public.orders add column if not exists shipping_note text;
alter table public.orders add column if not exists currency text not null default 'INR';

update public.orders set customer_email = email where customer_email is null and email is not null;
update public.orders set status = lower(order_status) where order_status is not null and (status is null or status = 'pending');

-- A private allow-list of administrator Auth user IDs.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- No direct client policies on app_admins. Membership is checked by a security-definer function.
create or replace function public.is_softies_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.app_admins a where a.user_id = auth.uid()); $$;
revoke all on function public.is_softies_admin() from public;
grant execute on function public.is_softies_admin() to authenticated;

-- Admin-only product management. Public active-product read policy from the original schema remains.
drop policy if exists "admin products select all" on public.products;
drop policy if exists "admin products insert" on public.products;
drop policy if exists "admin products update" on public.products;
drop policy if exists "admin products delete" on public.products;
create policy "admin products select all" on public.products for select to authenticated using (public.is_softies_admin());
create policy "admin products insert" on public.products for insert to authenticated with check (public.is_softies_admin());
create policy "admin products update" on public.products for update to authenticated using (public.is_softies_admin()) with check (public.is_softies_admin());
create policy "admin products delete" on public.products for delete to authenticated using (public.is_softies_admin());

-- Admins can see all orders and update delivery/customer fields; customers remain restricted to their own orders.
drop policy if exists "admin orders select all" on public.orders;
drop policy if exists "admin orders update" on public.orders;
create policy "admin orders select all" on public.orders for select to authenticated using (public.is_softies_admin());
create policy "admin orders update" on public.orders for update to authenticated using (public.is_softies_admin()) with check (public.is_softies_admin());

drop policy if exists "admin order items select all" on public.order_items;
create policy "admin order items select all" on public.order_items for select to authenticated using (public.is_softies_admin());

-- After the administrator account has been created and confirmed, copy its UUID from Authentication > Users and run:
-- insert into public.app_admins (user_id) values ('PASTE-ADMIN-AUTH-USER-UUID-HERE') on conflict do nothing;
-- Never put a Supabase service-role/secret key in the browser.


-- Additional fields for product photos and checkout/payment selection.
alter table public.products add column if not exists image_url text;
alter table public.orders add column if not exists payment_method text not null default 'COD';
alter table public.orders add column if not exists razorpay_order_id text;
alter table public.orders add column if not exists razorpay_payment_id text;

-- Public image bucket. Uploads and deletes are restricted to registered admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];
drop policy if exists "Public can view SOFTIES product images" on storage.objects;
create policy "Public can view SOFTIES product images" on storage.objects for select to public using (bucket_id = 'product-images');
drop policy if exists "Admins upload SOFTIES product images" on storage.objects;
create policy "Admins upload SOFTIES product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_softies_admin());
drop policy if exists "Admins update SOFTIES product images" on storage.objects;
create policy "Admins update SOFTIES product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_softies_admin()) with check (bucket_id = 'product-images' and public.is_softies_admin());
drop policy if exists "Admins delete SOFTIES product images" on storage.objects;
create policy "Admins delete SOFTIES product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_softies_admin());

-- Allow signed-in customers to create their own COD orders and order lines.
drop policy if exists "customers create own orders" on public.orders;
create policy "customers create own orders" on public.orders for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "customers create own order items" on public.order_items;
create policy "customers create own order items" on public.order_items for insert to authenticated with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
