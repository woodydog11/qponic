# Stripe test-mode integration
The merchant subscription is $79/month, with a $50 **one-time** introductory coupon applied to the first invoice, making it $29. The discount is NOT a free trial and is not recurring. Stripe taxes, proration and other adjustments must be checked in test mode.

1. In Stripe TEST mode, create product "Qponic Merchant Membership" with a recurring monthly price of $79. Copy its price ID into Netlify as STRIPE_MONTHLY_PRICE_ID.
2. Create a coupon for $50 off, duration **once**, restricted to the Qponic product if supported. Copy its coupon ID to STRIPE_INTRO_COUPON_ID.
3. Add STRIPE_SECRET_KEY as a Netlify secret (already configured by owner). Never expose to Vite.
4. Apply merchant_billing_schema.sql to Qponic Supabase.
5. Configure verified webhook processing and SUPABASE_SERVICE_ROLE_KEY before enabling real access. The portal endpoint requires the service role key and a webhook-populated billing record.
6. Use the authenticated POST /.netlify/functions/stripe-checkout endpoint. It returns a Stripe-hosted checkout URL. The checkout function requires an existing merchant membership.
7. Test first invoice $29, next invoice $79, failed payments, cancellations, repeat checkout, duplicate webhooks and access control.
8. DO NOT deploy this branch or enable paid access until webhook-based billing state, idempotency, duplicate subscription protection, and billing portal are tested.

Important: A successful redirect is NOT proof of payment. Never grant paid access based on the checkout success URL.
