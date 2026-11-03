import emailjs from '@emailjs/browser';

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const orderTemplateId = import.meta.env.VITE_EMAILJS_ORDER_TEMPLATE_ID;
const trackingTemplateId = import.meta.env.VITE_EMAILJS_TRACKING_TEMPLATE_ID;
export const emailJsConfigured = Boolean(serviceId && publicKey && orderTemplateId && trackingTemplateId);

async function send(templateId, params) {
  if (!serviceId || !publicKey || !templateId) {
    return { sent: false, reason: 'EmailJS is not configured. Add the four VITE_EMAILJS values to the site environment variables.' };
  }
  await emailjs.send(serviceId, templateId, params, { publicKey });
  return { sent: true };
}

const formatMoney = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const recipient = order => order.email || order.customer_email || '';
const orderStatus = order => order.order_status || order.status || 'PLACED';
const formatItems = items => (Array.isArray(items) && items.length)
  ? items.map(item => {
      const name = item.product_name || item.name || 'Toy';
      const quantity = Number(item.quantity || item.qty || 1);
      const price = Number(item.unit_price ?? item.price ?? 0);
      return `${name} × ${quantity} — ${formatMoney(price * quantity)}`;
    }).join('\n')
  : 'See your order details in your SOFTIES account.';

export function sendOrderConfirmation(order) {
  return send(orderTemplateId, {
    to_email: recipient(order),
    customer_name: order.customer_name || 'SOFTIES customer',
    order_id: String(order.id),
    tracking_id: order.tracking_id || 'Will be updated by SOFTIES',
    order_status: orderStatus(order),
    total_amount: formatMoney(order.total_amount),
    order_items: formatItems(order.items || order.order_items),
    payment_method: order.payment_method || 'COD',
    payment_status: order.payment_status || 'PENDING',
    delivery_address: order.address || '',
    store_url: window.location.origin,
    message: `Your SOFTIES order #${order.id} has been received. Tracking ID: ${order.tracking_id || 'will be updated soon'}.`
  });
}

export function sendTrackingUpdate(order) {
  return send(trackingTemplateId, {
    to_email: recipient(order),
    customer_name: order.customer_name || 'SOFTIES customer',
    order_id: String(order.id),
    tracking_id: order.tracking_id || 'Not assigned yet',
    order_status: orderStatus(order),
    total_amount: formatMoney(order.total_amount),
    payment_method: order.payment_method || 'COD',
    payment_status: order.payment_status || 'PENDING',
    delivery_address: order.address || '',
    tracking_notes: order.tracking_notes || '',
    shipping_note: order.tracking_notes || '',
    store_url: `${window.location.origin}/account`,
    message: `Your SOFTIES order #${order.id} has a tracking update. Status: ${orderStatus(order)}. Tracking ID: ${order.tracking_id || 'Not assigned yet'}. ${order.tracking_notes || ''}`
  });
}
