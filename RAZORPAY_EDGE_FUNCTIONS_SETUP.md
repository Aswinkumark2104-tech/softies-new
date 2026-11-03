# SOFTIES Razorpay Edge Functions

Deploy all three functions from the project root after running `supabase/SOFTIES_COMPLETE_SETUP.sql`:

```bash
supabase login
supabase link --project-ref YOUR_CURRENT_SUPABASE_PROJECT_REF
supabase functions deploy create-cod-order
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

Set server-only secrets in Supabase:

```bash
supabase secrets set RAZORPAY_KEY_ID=YOUR_RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_KEY_SECRET
```

Keep function JWT verification enabled. Full setup, testing and live-mode cautions are in `SOFTIES_FINAL_SETUP_GUIDE.md`.
