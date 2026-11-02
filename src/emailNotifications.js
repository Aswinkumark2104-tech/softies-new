import emailjs from '@emailjs/browser';

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const orderTemplateId = import.meta.env.VITE_EMAILJS_ORDER_TEMPLATE_ID;
const trackingTemplateId = import.meta.env.VITE_EMAILJS_TRACKING_TEMPLATE_ID;

export const emailJsConfigured = Boolean(serviceId && publicKey);

async function send(templateId, params) {
  if (!emailJsConfigured || !templateId) {
    return { sent: false, reason: 'EmailJS is not configured. Add the EmailJS IDs in .env.local.' };
  }
  await emailjs.send(serviceId, templateId, params, { publicKey });
  return { sent: true };
}

export function sendOrderConfirmation(order) {
  return send(orderTemplateId, {
    to_email: order.customer_email || order.email || '',
    customer_name: order.customer_name || 'SOFTIES customer',
    order_id: String(order.id),
    tracking_id: order.tracking_id || 'Will be updated by SOFTIES',
    order_status: order.status || 'pending',
    total_amount: `₹${Number(order.total_amount || 0).toLocaleString('en-IN')}`,
    payment_method: order.payment_method || 'COD',
    delivery_address: order.address || order.shipping_address?.address || '',
    store_url: window.location.origin,
    message: `Your SOFTIES order #${order.id} has been received. Tracking ID: ${order.tracking_id || 'will be updated soon'}.`
  });
}

export function sendTrackingUpdate(order) {
  return send(trackingTemplateId, {
    to_email: order.customer_email || order.email || '',
    customer_name: order.customer_name || 'SOFTIES customer',
    order_id: String(order.id),
    tracking_id: order.tracking_id || 'Not assigned yet',
    order_status: order.status || order.order_status || 'pending',
    total_amount: `₹${Number(order.total_amount || 0).toLocaleString('en-IN')}`,
    payment_method: order.payment_method || 'COD',
    delivery_address: order.address || order.shipping_address?.address || '',
    shipping_note: order.shipping_note || '',
    store_url: `${window.location.origin}/account`,
    message: `Your SOFTIES order #${order.id} has a tracking update. Status: ${order.status || 'pending'}. Tracking ID: ${order.tracking_id || 'Not assigned yet'}. ${order.shipping_note || ''}`
  });
}
