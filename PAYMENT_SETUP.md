# SOFTIES payments and login setup

## Google sign-in
1. Supabase Dashboard → Authentication → Sign In / Providers → Google; enable Google.
2. In Google Cloud Console, configure the OAuth consent screen and create OAuth credentials.
3. Add the Google Client ID and Client Secret to the Supabase Google provider settings.
4. In Supabase Authentication → URL Configuration, add local and deployed site URLs to Site URL / Redirect URLs, for example `http://localhost:5173/**` and `https://YOUR-SITE.netlify.app/**`.
5. Email/password login remains available as an alternative.

## Product photos
1. Run the updated `supabase/ADMIN_TRACKING_MIGRATION.sql` after confirming the admin role has already been set up.
2. The migration creates the public `product-images` bucket and policies that restrict uploads/changes to the `app_admins` allow-list.
3. In `/admin` → Products, choose a photo and save the product. Recommended JPEG, PNG or WebP; max 5 MB.

## Google Analytics
GA4 Measurement ID `G-PDD24T70PW` is included in `index.html`. After deploying, open Google Analytics → Reports → Realtime and visit the website to verify incoming activity. Avoid sending names, emails, phone numbers, addresses, or other personally identifiable data to Analytics.

## Checkout and Razorpay (important)
Cash on Delivery order creation is implemented. The checkout currently asks for the delivery name, phone, address and payment method. Choosing RAZORPAY/ONLINE is intentionally blocked until a server-side payment flow is deployed. Do not put Razorpay Key Secret, Supabase service-role key, or any secret in `.env.local` or browser code.

To enable Razorpay for real payments, implement/deploy Supabase Edge Functions (or another trusted backend) that:
- verify the authenticated user and calculate the order amount from database prices/stock (never trust a browser-supplied total);
- create a Razorpay order using server-side `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`;
- return the order ID and public key ID to the browser to launch Razorpay Checkout;
- verify the returned payment signature on the server before setting `payment_status='PAID'`;
- verify webhook signatures and handle duplicate webhook delivery idempotently;
- only then confirm the order and store payment IDs.

Configure Razorpay secrets only in the backend/Edge Function secrets. Test with Razorpay test mode first, including failed/cancelled payments and duplicate webhook events. The current website does not claim that online payment has been processed.
