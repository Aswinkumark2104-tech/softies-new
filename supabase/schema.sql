-- SOFTIES starter schema for Supabase PostgreSQL.
-- Run in Supabase SQL Editor. Review policies before production launch.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  category text not null default 'Educational Toys',
  price numeric(10,2) not null check (price >= 0),
  old_price numeric(10,2) check (old_price is null or old_price >= price),
  stock integer not null default 0 check (stock >= 0),
  emoji text default '🧸',
  color text default '#fff0bd',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  currency text not null default 'INR',
  customer_name text,
  phone text,
  shipping_address jsonb,
  payment_provider text,
  payment_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- Enable RLS on every customer-facing table.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.reviews enable row level security;

-- Customers can read/update their own profile only.
create policy "profiles select own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Active products and categories are publicly readable.
create policy "active products readable" on public.products for select to anon, authenticated using (is_active = true);
create policy "categories readable" on public.categories for select to anon, authenticated using (true);

-- Users can see their own orders and create an order for themselves.
create policy "orders select own" on public.orders for select to authenticated using (auth.uid() = user_id);
create policy "orders insert own" on public.orders for insert to authenticated with check (auth.uid() = user_id);
create policy "order items select own order" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "order items insert own order" on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- Wishlist belongs to the signed-in customer.
create policy "wishlist select own" on public.wishlists for select to authenticated using (auth.uid() = user_id);
create policy "wishlist insert own" on public.wishlists for insert to authenticated with check (auth.uid() = user_id);
create policy "wishlist delete own" on public.wishlists for delete to authenticated using (auth.uid() = user_id);

-- Reviews are public to read; customers can manage their own reviews.
create policy "reviews readable" on public.reviews for select to anon, authenticated using (true);
create policy "reviews insert own" on public.reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "reviews update own" on public.reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews delete own" on public.reviews for delete to authenticated using (auth.uid() = user_id);

-- Seed sample catalogue records. Product photos can be added in Supabase Storage later.
insert into public.categories(name, slug) values
 ('Educational Toys','educational-toys'), ('Soft Toys','soft-toys'),
 ('RC Toys','rc-toys'), ('Outdoor Toys','outdoor-toys')
on conflict (slug) do nothing;

insert into public.products(name, slug, description, category, price, old_price, stock, emoji, color, is_active) values
 ('Rainbow Learning Blocks','rainbow-learning-blocks','Bright, chunky blocks for building, sorting and creative play.','Educational Toys',649,799,24,'🧱','#fff0bd',true),
 ('Cuddle Cloud Teddy','cuddle-cloud-teddy','A soft companion for story time, naps and everyday adventures.','Soft Toys',499,599,18,'🧸','#ffe0e8',true),
 ('Zoomster RC Racer','zoomster-rc-racer','A colourful remote-control racer for indoor and outdoor fun.','RC Toys',1199,1499,12,'🏎️','#dceaff',true),
 ('Little Artist Kit','little-artist-kit','An imaginative art set for making colourful little masterpieces.','Educational Toys',399,null,32,'🎨','#e4f6d8',true),
 ('Dino Explorer Buddy','dino-explorer-buddy','A friendly plush dinosaur ready for pretend-play adventures.','Soft Toys',549,649,16,'🦕','#d8f5e5',true),
 ('Mini Builder STEM Set','mini-builder-stem-set','A hands-on construction set that encourages problem-solving.','Educational Toys',899,999,10,'⚙️','#e9e0ff',true),
 ('Happy Hop Ball','happy-hop-ball','A bright play ball for active games and outdoor fun.','Outdoor Toys',349,null,27,'⚽','#ffedcf',true),
 ('Rocket Adventure Set','rocket-adventure-set','Launch imaginative space missions with this playful rocket set.','RC Toys',799,999,14,'🚀','#dff5ff',true)
on conflict (slug) do nothing;

-- IMPORTANT SECURITY NOTE:
-- Do not add broad public INSERT/UPDATE/DELETE policies for products or payments.
-- Create an admin role and secure server-side admin operations before enabling a real admin dashboard.
-- Payment verification and stock deduction should be implemented server-side (e.g. Supabase Edge Functions).
