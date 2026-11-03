# SOFTIES — Complete setup and deployment guide

This package keeps the existing colourful SOFTIES storefront and connects its customer, admin, database, image, email and payment features. Follow these steps in order.

## 1. What is included

| Feature | Website implementation |
|---|---|
| Customer shop | Product catalogue, categories, search, sorting, cart and wishlist |
| Real product photos | Admin uploads the actual toy photo to Supabase Storage; the image appears on the storefront and in the cart |
| Customer login | Email/password and Google sign-in |
| Admin dashboard | Separate `/admin` route, protected by `app_admins` and Supabase RLS |
| Product management | Add, edit, hide/show, change price/offer price, update stock and upload a new photo |
| Checkout | Customer name, phone, full delivery address and 6-digit PIN code; press-and-hold confirmation |
| Payment | Cash on Delivery and server-created Razorpay orders with signature + captured-payment verification |
| EmailJS | Order confirmation after successful order creation/payment; tracking update after an admin saves shipment status/number |
| Customer tracking | `/account` shows order, payment, tracking number, store message and tracking history |
| Analytics | GA4 `G-PDD24T70PW` plus page, scroll, search, item, cart, checkout and purchase events |
| SEO | SOFTIES title/description, search phrase and sitemap/robots files |

## 2. Update the existing Supabase database

Use the SAME Supabase project currently connected to SOFTIES.

1. Open Supabase Dashboard → SQL Editor.
2. Open the file `supabase/SOFTIES_COMPLETE_SETUP.sql` from this ZIP.
3. Copy all its contents into a new SQL query and click **Run**.
4. It is an additive migration: it adds missing columns, admin permissions, product image storage, secure order functions and customer-only order/tracking access. It does not delete your current products or orders.
5. If SQL Editor shows an error, stop and share the exact error text before trying to remove or recreate any tables.

The new storefront order functions calculate product prices from the database. COD orders reduce stock at order creation. Razorpay orders check stock before checkout and reduce stock only after the server verifies that payment is captured.

## 3. Register the SOFTIES admin account

1. Open `https://softiestoy.netlify.app/account` (or your local `/account`).
2. Create an account with the email address you will use as the SOFTIES administrator. You can use Google login after Google is configured, or email/password.
3. Confirm the email if Supabase asks you to.
4. Supabase Dashboard → Authentication → Users. Find that admin account and copy its **User UID**.
5. In SQL Editor run this query after replacing the sample UUID with the UID you copied:

   ```sql
   insert into public.app_admins (user_id)
   values ('PASTE-ADMIN-USER-UUID-HERE')
   on conflict (user_id) do nothing;
   ```

6. Open `/admin`, sign in with that same account, and check the dashboard.

Only add your own trusted admin UID. Customers who create accounts must not be added to `app_admins`.

## 4. Add the real product photographs

The files you previously shared contain the SOFTIES logo, but not individual product photos. I have therefore built a real-photo upload feature instead of pretending sample/emoji images are photographs of your products.

1. Sign in at `/admin`.
2. Open **Products** → **Add a new product**.
3. Enter the real toy name, category, description, regular price, optional offer price and available stock.
4. Under **Real product photo**, choose the photograph of that exact toy from your computer or phone. Use JPG, PNG, WEBP or AVIF; maximum 5 MB.
5. Click **Add product**. The photo is saved in the Supabase `product-images` public bucket. The website displays the saved product image automatically.
6. Repeat for every real toy. You can edit an existing product later to replace its photo, price or stock, or hide it when unavailable.

For best results, use a clear, well-lit product photo with a plain background. Upload only images you own or have permission to use.

## 5. Configure email/password and Google login

### Email/password

Supabase → Authentication → URL Configuration:

- Site URL: `https://softiestoy.netlify.app`
- Add redirect URLs:
  - `https://softiestoy.netlify.app/**`
  - `http://localhost:5173/**`

Adjust the Netlify URL if your deployment uses a different domain. These redirects are used for Google login and password recovery.

### Google login

Supabase → Authentication → Sign In / Providers → Google:

1. Enable Google.
2. Paste your Google OAuth **Client ID** and **Client Secret**.
3. In Google Cloud Console, add the Supabase callback URL shown by Supabase as an Authorized redirect URI. It usually looks like:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
4. Save the provider and test Google login at `/account` and `/admin`.

The earlier `Unsupported provider: missing OAuth secret` error means the Google provider was not fully configured in Supabase. The website code cannot replace the Google OAuth credentials.

## 6. Configure EmailJS order and tracking emails

Create or use your EmailJS account at https://www.emailjs.com/.

1. Add an Email Service and copy its Service ID.
2. Create two email templates:
   - **SOFTIES Order Confirmation**
   - **SOFTIES Tracking Update**
3. Set the **To email** field in BOTH templates to `{{to_email}}`.
4. Use the template text from `EMAILJS_TEMPLATES.md`.
5. Copy your Service ID, Public Key and both Template IDs. These are the only EmailJS values needed in the frontend.
6. In Netlify → Site configuration → Environment variables add:
   - `VITE_EMAILJS_SERVICE_ID`
   - `VITE_EMAILJS_PUBLIC_KEY`
   - `VITE_EMAILJS_ORDER_TEMPLATE_ID`
   - `VITE_EMAILJS_TRACKING_TEMPLATE_ID`
7. Save and redeploy the site.

Order emails are triggered after a COD order is saved or Razorpay payment is verified. Tracking emails are triggered when an admin saves a changed status, tracking ID or customer message. Set the correct EmailJS sending limits and allowed website origins in your EmailJS account. The EmailJS public key is intended for browser use; do not put a private email-server key in the website.

## 7. Configure Razorpay securely

The code uses Razorpay Standard Checkout. The Razorpay secret is only read by Supabase Edge Functions; it is not included in the website ZIP or client-side variables.

### A. Save server secrets

Open a terminal in the extracted project folder. Install/use the Supabase CLI and run:

```bash
supabase login
supabase link --project-ref YOUR_CURRENT_SUPABASE_PROJECT_REF
supabase secrets set RAZORPAY_KEY_ID=YOUR_RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_KEY_SECRET
```

Use the Test Mode key pair first. The project reference is the part before `.supabase.co` in your Supabase Project URL. Do not share the Razorpay secret or Supabase service-role key in chat, in GitHub, in `.env.local`, or in Netlify frontend variables.

If you already saved the two Razorpay secrets for this exact Supabase project, do not replace them. Check that they are the intended Test Mode or Live Mode pair.

### B. Deploy all three Edge Functions

From the project folder run:

```bash
supabase functions deploy create-cod-order
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

Keep JWT verification enabled. Customers must be signed in before calling checkout functions. The Supabase platform supplies the server-side Supabase environment values to Edge Functions.

### C. Test before going live

1. Confirm the Razorpay account is in Test Mode and the Test Mode key pair is saved as Edge Function secrets.
2. Place one COD test order and check the admin dashboard and `/account`.
3. Place one Razorpay test order and complete the test checkout.
4. Check Supabase `orders`: Razorpay order should show `payment_status = PAID`, `order_status = CONFIRMED`, `razorpay_payment_id` and a tracking ID only after server verification.
5. Try closing/failing a payment and verify that it is not marked PAID.
6. Test admin order status/tracking changes and verify the EmailJS update email arrives.

Before accepting live payments, enable automatic capture in Razorpay and complete a real low-value end-to-end test. Add a Razorpay webhook in the account for resilience if the browser closes after payment; the current package verifies the Checkout callback server-side but does not include a webhook receiver or automatic refund handling. If a customer reports money debited but an order still pending, check the Razorpay payment record before taking another payment.

## 8. Frontend environment variables

Copy `.env.example` to `.env.local` for local development. For Netlify, add the same `VITE_` values under Site configuration → Environment variables, then redeploy.

Required frontend values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_EMAILJS_SERVICE_ID=YOUR_EMAILJS_SERVICE_ID
VITE_EMAILJS_PUBLIC_KEY=YOUR_EMAILJS_PUBLIC_KEY
VITE_EMAILJS_ORDER_TEMPLATE_ID=YOUR_ORDER_TEMPLATE_ID
VITE_EMAILJS_TRACKING_TEMPLATE_ID=YOUR_TRACKING_TEMPLATE_ID
```

Do NOT add `RAZORPAY_KEY_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or any other server secret to frontend environment variables. Razorpay secrets belong only in Supabase Edge Function secrets.

## 9. Deploy to Netlify

1. Extract the ZIP.
2. Open the `SOFTIES_Toy_Store` folder and install dependencies:

   ```bash
   npm install
   npm run build
   ```

3. Push the project files to your GitHub repository (do not commit `.env.local`).
4. Netlify → Add new site → Import an existing project → choose the repository.
5. Build command: `npm run build`.
6. Publish directory: `dist`.
7. Add the frontend environment variables from section 8.
8. Deploy. Redeploy every time you change a `VITE_` variable.
9. Confirm Supabase Auth Site URL / redirect URLs use the final Netlify domain.

`public/_redirects` is included to support `/admin` and `/account` page routes on Netlify.

## 10. Analytics and SEO

Google Analytics 4 measurement ID `G-PDD24T70PW` remains configured in `index.html`. Events include `page_view` (GA4 config), `scroll`, `search`, `view_item`, `select_item`, `add_to_cart`, `view_cart`, `begin_checkout` and `purchase`. Do not send customer email, phone or delivery address to Analytics.

The page metadata is configured for the search phrase **softies toy shop online**. After deploying, submit `https://softiestoy.netlify.app/sitemap.xml` in Google Search Console. Indexing and ranking are controlled by Google and may take time; this ZIP cannot guarantee search placement.

## 11. Current important limitations

- The previous files contained the SOFTIES logo but no real photo of each toy. The admin photo uploader is ready; you need to select and upload the actual product images.
- The order flow requires the SQL migration and deployed Edge Functions. Checkout is not ready for live customer use until those steps are completed and tested.
- Razorpay payment callback verification is server-side and checks the captured payment amount/order/signature. A webhook receiver, refunds and automated abandoned-payment stock cleanup are not included in this build.
- EmailJS templates and account credentials must be configured in your own EmailJS account. The ZIP cannot send emails until your IDs and templates are connected.
