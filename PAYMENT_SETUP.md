# SOFTIES payments

The checkout offers Cash on Delivery and Razorpay.

Read `SOFTIES_FINAL_SETUP_GUIDE.md` → section 7 for the complete Razorpay setup, Supabase secrets and Edge Function deployment commands.

Payment security in this project:
- The browser does not calculate the trusted final product prices. The Supabase function reads current prices and stock from the database.
- Razorpay orders are created by a Supabase Edge Function using server-side `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` values.
- The verification function checks Razorpay's checkout signature and retrieves the payment from Razorpay to confirm order ID, amount, currency and captured status before marking the order paid.
- Razorpay secrets and `SUPABASE_SERVICE_ROLE_KEY` must never be added to `.env.local`, source code, GitHub or Netlify frontend variables.

The functions are not active until deployed to your own Supabase project. Test all order outcomes in Razorpay Test Mode before accepting live payments.
