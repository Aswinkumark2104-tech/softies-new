import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    if (!url || !anonKey || !serviceKey || !keyId || !secret) return json({ error: 'Server payment configuration is incomplete.' }, 500);

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please sign in again.' }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Your session is invalid.' }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const body = await req.json();
    const internalId = Number(body.internal_order_id);
    const rpOrderId = String(body.razorpay_order_id || '');
    const paymentId = String(body.razorpay_payment_id || '');
    const signature = String(body.razorpay_signature || '');
    if (!Number.isSafeInteger(internalId) || !rpOrderId || !paymentId || !signature) return json({ error: 'Missing payment verification details.' }, 400);

    const { data: order, error: orderError } = await admin.from('orders')
      .select('id,user_id,total_amount,payment_status,razorpay_order_id')
      .eq('id', internalId).eq('user_id', userData.user.id).maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.razorpay_order_id !== rpOrderId || order.user_id !== userData.user.id) return json({ error: 'Payment does not match this customer order.' }, 403);
    if (order.payment_status === 'PAID') {
      const { data: already } = await admin.from('orders').select('tracking_id').eq('id', internalId).maybeSingle();
      return json({ verified: true, order_id: order.id, tracking_id: already?.tracking_id, already_paid: true });
    }

    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${rpOrderId}|${paymentId}`)));
    if (expected.length !== signature.length) return json({ error: 'Payment signature is invalid.' }, 400);
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    if (diff !== 0) return json({ error: 'Payment signature is invalid.' }, 400);

    // Verify provider-side status, amount, currency and order relationship before recording payment.
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { 'Authorization': `Basic ${btoa(`${keyId}:${secret}`)}` },
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.order_id !== rpOrderId || payment.currency !== 'INR' || Number(payment.amount) !== Math.round(Number(order.total_amount) * 100)) {
      return json({ error: 'Razorpay payment details do not match this order.' }, 400);
    }
    if (payment.status !== 'captured') return json({ error: `Payment status is ${payment.status}. The order will remain unpaid until the payment is captured.` }, 409);

    const { data: finalized, error: finalizeError } = await admin.rpc('softies_mark_order_paid', {
      p_order_id: internalId,
      p_razorpay_payment_id: paymentId,
      p_razorpay_order_id: rpOrderId,
    });
    if (finalizeError) return json({ error: `Payment was captured, but SOFTIES could not finalize the order: ${finalizeError.message}. Please contact SOFTIES with order #${internalId}; do not pay again.` }, 409);
    return json({ verified: true, order_id: internalId, tracking_id: finalized?.tracking_id, total_amount: finalized?.total_amount });
  } catch (error) {
    console.error('verify-razorpay-payment:', error);
    return json({ error: error instanceof Error ? error.message : 'Payment verification failed.' }, 500);
  }
});
