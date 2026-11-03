# SOFTIES — Growing Through Play

A responsive SOFTIES toy-store website built with React + Vite, Supabase authentication/database/storage, EmailJS notifications, Razorpay Checkout, customer order tracking, and a separate administrator dashboard.

## Pages

- `/` — customer storefront, search, category filters, shopping cart, checkout, COD and Razorpay.
- `/account` — email/password or Google login, customer order history, tracking details and tracking history.
- `/admin` — private administrator login, overview, product photo upload/catalogue, customer order management and shipment updates.

## Start the website locally

1. Install Node.js 20 or newer.
2. Open this folder in Visual Studio Code.
3. Copy `.env.example` to `.env.local` and fill in the frontend values.
4. Open Terminal in this folder and run:

   ```bash
   npm install
   npm run dev
   ```

5. Open the localhost URL shown in the terminal.

## Read before deployment

Follow `SOFTIES_FINAL_SETUP_GUIDE.md` in order. In particular:

- Run `supabase/SOFTIES_COMPLETE_SETUP.sql` in the existing SOFTIES Supabase project.
- Register your admin user and add its Auth user UUID to `public.app_admins`.
- Deploy the three Supabase Edge Functions in `supabase/functions/`.
- Keep the Razorpay secret and Supabase service-role key on the server only. Never put them in `.env.local` or Netlify frontend variables.
- Add your EmailJS service, public key, order template and tracking template IDs to Netlify.
- Upload your real toy photos from `/admin` after the admin role and Storage bucket are ready.

## Build for Netlify

```bash
npm run build
```

Publish directory: `dist`.

The ZIP intentionally excludes `node_modules`, `.env.local`, and built `dist` files. Install dependencies after extracting it. The source package is provided; the website is not deployed to your Netlify account by this ZIP.
