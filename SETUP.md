# SOFTIES Toy Store — setup guide

A colourful React + Vite toy-store starter with responsive design, animations, category filters, search, sorting, local cart/wishlist, toy finder, Supabase authentication hooks, sample product catalogue, starter SQL schema, and an initial order-creation flow.

## 1. Requirements
- Node.js 20 or newer
- A Supabase project
- A code editor such as Visual Studio Code

## 2. Run locally
1. Extract this ZIP.
2. Open a terminal inside the extracted `SOFTIES_Toy_Store` folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Until Supabase is configured, you can run the visual demo with placeholder values left unchanged.
6. Run `npm run dev`.
7. Open the local address printed by Vite.

## 3. Connect Supabase
1. Create a project at https://supabase.com/.
2. Open the project's SQL Editor.
3. Copy and run `supabase/schema.sql`.
4. In Supabase Project Settings, find the Project URL and publishable/anon key.
5. Put them in `.env`:
   `VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co`
   `VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   `VITE_ADMIN_EMAIL=your-admin-email@example.com``
6. Restart the Vite server after editing `.env`.

Only the public/anon/publishable key belongs in frontend environment variables. NEVER place a Supabase service-role key, Razorpay secret, or email API secret in frontend code.

## 4. Authentication settings
In Supabase Authentication settings, configure allowed redirect URLs for localhost and your deployed Netlify site. Set up email confirmation and password reset flows before launch. This starter includes sign-in/sign-up hooks but not a complete production password-reset UI.

## 5. Netlify deployment
1. Push the project to a GitHub repository.
2. In Netlify, choose Add new site → Import an existing project.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under site environment variables.
6. Deploy. Add the production site URL to Supabase Auth's allowed URLs.

## 6. What works in this starter
- Responsive homepage and category navigation
- Search, category filters and price sorting
- Animated product cards
- Local browser cart and wishlist
- Toy Finder quiz with age/budget suggestions
- Supabase sign-in/sign-up hooks
- Reads active products from Supabase when configured
- Creates a pending order and order-item rows for a signed-in user
- Demo product manager UI for layout testing

## 7. Important: before taking real orders
This is a starter project, not a fully audited production commerce system. Do not accept real payments yet. Before launch, implement and test:
- Server-side trusted pricing and order-total calculation
- Atomic stock reservation/deduction and oversell prevention
- Razorpay order creation and signature/webhook verification on the server
- Proper admin roles and secure admin-only product/order management
- Customer address and phone collection/validation
- Order history and tracking page
- Email confirmation through a server-side email provider
- Refund/cancellation process and policies
- Product image uploads via Supabase Storage
- Password reset, error handling, logging and security review

The schema deliberately does not grant public product write permissions. The product manager is a starter UI only; production admin actions must use an authenticated server-side function and a verified admin role. The checkout creates a pending unpaid order only; it does NOT charge a customer.

## 8. Customise
- Main UI: `src/App.jsx`
- Styles and colours: `src/styles.css`
- Supabase connection: `src/supabase.js`
- Database schema and sample products: `supabase/schema.sql`
- Brand and SEO title: `index.html`

The sample product illustrations use emoji as placeholders. Replace these with licensed product photographs and add an image URL field/storage upload workflow before launch.

## 9. Admin route fix and security
- Open `/admin` to reach the admin sign-in/product-manager screen.
- Use the role-based setup described in “Separate admin dashboard and customer tracking” below. Admin permissions are granted by the `app_admins` table and enforced by Supabase Row Level Security; a frontend email string is not used as authorization.


## Separate admin dashboard and customer tracking

- Customer storefront: `/`
- Private admin dashboard: `/admin`
- Customer account and order tracking: `/account`

### Supabase setup for the new features
1. Create `.env.local` beside `package.json` using `.env.example` as the template. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your Supabase project URL and publishable/anon key. Do not use a service-role or secret key in frontend environment variables.
2. In Supabase SQL Editor, run `supabase/ADMIN_TRACKING_MIGRATION.sql` after your existing schema. It adds tracking fields and role-based admin policies.
3. Sign up for an administrator account through the customer account page, `/account`, and confirm the email if Supabase requests it. In Supabase Dashboard, open Authentication → Users, copy that account's UUID, then run the final commented `insert into public.app_admins...` statement in the migration after replacing the placeholder with that UUID. Only grant this role to trusted administrators.
4. Restart the local server after changing `.env.local`: stop with Ctrl+C, then run `npm run dev`.
5. Open `/admin` to manage products and update order status/tracking number/customer note. Customers sign in at `/account` using the same account that placed their order to see updates.

### Important behavior
- The dashboard can only display/manage records saved in this Supabase project. It does not automatically send email/SMS notifications; customer updates appear on their tracking page. Add a trusted email service or Supabase Edge Function later if you want automatic email notifications.
- This starter checkout creates unpaid orders; it does not verify online payments. Do not mark orders paid unless payment is verified by a secure payment-provider webhook/server-side function.
- Orders placed before the customer-email migration may not have `customer_email`; customers still see orders linked to their signed-in user ID.


## Latest upgrade: Google login, photos, COD and analytics
- The storefront, customer account, and admin login now offer Google OAuth alongside email/password. Configure Google provider credentials in Supabase and allowed redirect URLs; see `PAYMENT_SETUP.md`.
- Admin product editor supports product photo upload using the `product-images` Supabase Storage bucket. Run the updated migration and grant your admin UUID before using it.
- Checkout collects delivery name, phone and full address. Cash on Delivery order creation is available when database policies are configured.
- Razorpay online payments are intentionally not activated in browser code. Follow `PAYMENT_SETUP.md` to add secure server-side order creation and signature/webhook verification before accepting online payments.
- GA4 Measurement ID `G-PDD24T70PW` is configured in `index.html`. Verify it in Analytics Realtime after deploying. Do not send customer PII to Analytics.

## 10. Automatic order confirmation and tracking emails (EmailJS)

This project can send two emails with EmailJS:
- Order confirmation after a COD order is successfully created. The email includes the order number and tracking ID (`SOF-000123` format).
- Tracking update after an admin saves a changed order status, tracking number, or delivery note.

### Configure EmailJS
1. Create/sign in to an account at https://www.emailjs.com/.
2. Add and connect an email service. Copy its Service ID.
3. Create an **Order confirmation** email template and a separate **Tracking update** template. Copy both Template IDs.
4. In each template, set the recipient/To email field to `{{to_email}}`.
5. Add the template variables listed below to the subject/body. EmailJS template variable names are case-sensitive.
6. Copy `.env.example` to `.env.local` (or update your existing `.env.local`) and set:
   ```env
   VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
   VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
   VITE_EMAILJS_ORDER_TEMPLATE_ID=template_order_confirmation
   VITE_EMAILJS_TRACKING_TEMPLATE_ID=template_tracking_update
   ```
7. Restart Vite after saving environment variables (`Ctrl+C`, then `npm run dev`). For Netlify, add the same four variables in Site configuration → Environment variables, then redeploy.

Suggested **Order confirmation** template body:
```text
Hi {{customer_name}},

Thank you for shopping with SOFTIES! We have received your order.
Order number: {{order_id}}
Tracking ID: {{tracking_id}}
Order status: {{order_status}}
Order total: {{total_amount}}
Payment method: {{payment_method}}
Delivery address: {{delivery_address}}

Track your order: {{store_url}}
{{message}}

With love, SOFTIES
```

Suggested **Tracking update** template body:
```text
Hi {{customer_name}},

There is an update for your SOFTIES order.
Order number: {{order_id}}
Tracking ID: {{tracking_id}}
Current status: {{order_status}}
Delivery note: {{shipping_note}}
Order total: {{total_amount}}
Payment method: {{payment_method}}

View your order: {{store_url}}
{{message}}

With love, SOFTIES
```

Variables available to both templates: `to_email`, `customer_name`, `order_id`, `tracking_id`, `order_status`, `total_amount`, `payment_method`, `delivery_address`, `store_url`, and `message`. The tracking template also receives `shipping_note`.

Important: EmailJS sends from the connected service; the customer's email is the recipient. The app uses only the EmailJS public key in the browser. Never place a private email-service password, SMTP password, Supabase service-role key, or Razorpay secret in a `VITE_` variable. Configure EmailJS allowed origins/rate limits and test with your own email first. If email delivery fails, the order/tracking database save remains in place and the admin sees a warning. Online Razorpay payment confirmation is separate and must be implemented/verified server-side before accepting real payments.
