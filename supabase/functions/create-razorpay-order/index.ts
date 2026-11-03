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
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')!;
    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    if (!url || !anonKey || !serviceKey || !razorpayKeyId || !razorpaySecret) return json({ error: 'Server payment configuration is incomplete. Check Supabase Edge Function secrets.' }, 500);

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please sign in before checkout.' }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Your session is invalid. Please sign in again.' }, 401);

    const body = await req.json();
    const d = body.customer || {};
    const items = body.items;
    if (!d.customer_name?.trim() || !d.phone?.trim() || !d.address?.trim() || !d.city?.trim() || !d.state?.trim() || !/^\d{6}$/.test(d.pincode || '')) {
      return json({ error: 'Please provide complete delivery details and a valid 6-digit PIN code.' }, 400);
    }
    if (!Array.isArray(items) || !items.length || items.length > 30) return json({ error: 'Your cart is empty or contains too many different items.' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const fullAddress = `${d.address.trim()}${d.area?.trim() ? ', ' + d.area.trim() : ''}, ${d.city.trim()}, ${d.state.trim()} - ${d.pincode.trim()}`;
    const { data: order, error: orderError } = await admin.rpc('softies_create_order', {
      p_user_id: userData.user.id,
      p_email: userData.user.email || '',
      p_customer_name: d.customer_name.trim(),
      p_phone: d.phone.trim(),
      p_address: fullAddress,
      p_city: d.city.trim(),
      p_state: d.state.trim(),
      p_pincode: d.pincode.trim(),
      p_payment_method: 'RAZORPAY',
      p_items: items,
      p_reserve_stock: false,
    });
    if (orderError) return json({ error: orderError.message || 'Could not create the payment order.' }, /stock|available|active|product/i.test(orderError.message || '') ? 409 : 400);

    const receipt = `SOF-${order.id}`;
    const rpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${razorpayKeyId}:${razorpaySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: Math.round(Number(order.total_amount) * 100), currency: 'INR', receipt, notes: { softies_order_id: String(order.id), customer_email: userData.user.email || '' } }),
    });
    const rp = await rpResponse.json();
    if (!rpResponse.ok) {
      await admin.from('orders').update({ payment_status: 'FAILED', order_status: 'PAYMENT_FAILED' }).eq('id', order.id);
      return json({ error: rp.error?.description || 'Razorpay could not create the payment order.' }, 502);
    }
    const { error: saveError } = await admin.from('orders').update({ razorpay_order_id: rp.id }).eq('id', order.id);
    if (saveError) throw saveError;

    return json({
      internal_order_id: order.id,
      razorpay_order_id: rp.id,
      amount: rp.amount,
      currency: rp.currency,
      key_id: razorpayKeyId,
      customer: { name: d.customer_name.trim(), email: userData.user.email || '', contact: d.phone.trim() },
      description: `SOFTIES order #${order.id}`,
      total_amount: order.total_amount,
      address: fullAddress,
    });
  } catch (error) {
    console.error('create-razorpay-order:', error);
    return json({ error: error instanceof Error ? error.message : 'Could not start payment.' }, 500);
  }
});
