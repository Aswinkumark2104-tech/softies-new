# SOFTIES EmailJS template content

Create two EmailJS templates. In each template, set the recipient / **To email** to `{{to_email}}`.

## 1. SOFTIES Order Confirmation

**Subject**

```text
SOFTIES Order Confirmed — #{{order_id}}
```

**Content**

```text
Hello {{customer_name}},

Thank you for shopping with SOFTIES — Growing Through Play!

Your order has been received successfully.

ORDER DETAILS
Order number: #{{order_id}}
Order status: {{order_status}}
Tracking ID: {{tracking_id}}
Payment method: {{payment_method}}
Payment status: {{payment_status}}
Order total: {{total_amount}}

ITEMS
{{order_items}}

DELIVERY ADDRESS
{{delivery_address}}

{{message}}

You can view your order and tracking updates here:
{{store_url}}

Thank you for choosing SOFTIES.
Little toys, big imagination!

SOFTIES Customer Support
WhatsApp: +91 90920 96062
Instagram: https://www.instagram.com/softies__uz/
```

Template ID goes into `VITE_EMAILJS_ORDER_TEMPLATE_ID`.

## 2. SOFTIES Tracking Update

**Subject**

```text
SOFTIES Delivery Update — Order #{{order_id}}
```

**Content**

```text
Hello {{customer_name}},

There is a new delivery update for your SOFTIES order.

ORDER DETAILS
Order number: #{{order_id}}
Current status: {{order_status}}
Tracking / courier ID: {{tracking_id}}
Payment method: {{payment_method}}
Payment status: {{payment_status}}
Order total: {{total_amount}}

LATEST MESSAGE FROM SOFTIES
{{tracking_notes}}

DELIVERY ADDRESS
{{delivery_address}}

{{message}}

View your latest order status here:
{{store_url}}

Thank you for shopping with SOFTIES — Growing Through Play!

SOFTIES Customer Support
WhatsApp: +91 90920 96062
Instagram: https://www.instagram.com/softies__uz/
```

Template ID goes into `VITE_EMAILJS_TRACKING_TEMPLATE_ID`.

## Important EmailJS details

- The `To email` field should be exactly `{{to_email}}` in both templates.
- Variable names are case-sensitive.
- Set the sender name to `SOFTIES` and use the connected email service's verified sender address.
- Add your production Netlify domain to EmailJS allowed origins / security settings when available.
