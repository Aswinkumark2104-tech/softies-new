import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!url || !anonKey || !serviceKey) return json({ error: 'Server order configuration is incomplete.' }, 500);

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please sign in before checkout.' }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Your session is invalid. Please sign in again.' }, 401);

    const body = await req.json();
    const d = body.customer || {};
    const items = body.items;
    if (!d.customer_name?.trim() || !d.phone?.trim() || !d.address?.trim() || !d.city?.trim() || !d.state?.trim() || !/^\d{6}$/.test(d.pincode || '')) {
      return json({ error: 'Please provide your name, phone, complete delivery address and a valid 6-digit PIN code.' }, 400);
    }
    if (!Array.isArray(items) || !items.length || items.length > 30) return json({ error: 'Your cart is empty or contains too many different items.' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: order, error } = await admin.rpc('softies_create_order', {
      p_user_id: userData.user.id,
      p_email: userData.user.email || '',
      p_customer_name: d.customer_name.trim(),
      p_phone: d.phone.trim(),
      p_address: `${d.address.trim()}${d.area?.trim() ? ', ' + d.area.trim() : ''}, ${d.city.trim()}, ${d.state.trim()} - ${d.pincode.trim()}`,
      p_city: d.city.trim(),
      p_state: d.state.trim(),
      p_pincode: d.pincode.trim(),
      p_payment_method: 'COD',
      p_items: items,
      p_reserve_stock: true,
    });
    if (error) {
      const message = error.message || 'Could not create the order.';
      const status = /stock|available|active|product/i.test(message) ? 409 : 400;
      return json({ error: message }, status);
    }
    return json({ order });
  } catch (error) {
    console.error('create-cod-order:', error);
    return json({ error: error instanceof Error ? error.message : 'Could not place your COD order.' }, 500);
  }
});
