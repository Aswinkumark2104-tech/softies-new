# SOFTIES Setup

Use the full, updated instructions in `SOFTIES_FINAL_SETUP_GUIDE.md`.

The required sequence is:
1. Run `supabase/SOFTIES_COMPLETE_SETUP.sql` in the existing Supabase project.
2. Create your admin login and add its Auth UID to `public.app_admins`.
3. Configure Supabase Google OAuth and redirect URLs if Google login is required.
4. Set the EmailJS template/environment variables and deploy the three Supabase Edge Functions.
5. Add frontend environment variables in Netlify and redeploy.
6. Open `/admin` to upload actual product photos and create the product catalogue.

Do not put a Razorpay secret or Supabase service-role key in frontend environment variables.
