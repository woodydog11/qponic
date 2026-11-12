# Qponic merchant pricing and scale — November 2026

## Approved commercial terms
- First 30 days: $29 (paid introductory month; not a free trial).
- Beginning day 31: $79/month, automatically billed monthly.
- No fixed-term commitment; cancel future renewals at any time. Access continues through the current paid period unless otherwise required by law.
- No Qponic commission on coupon redemptions.
- Taxes and refunds subject to checkout disclosures and applicable law.
- Avoid guaranteeing campaign performance or ROI.

## Self-service platform
Merchant signup -> verified business ownership -> Stripe Checkout -> merchant onboarding -> AI promotion builder -> offer draft -> review/approval -> publication -> redemption validation -> reporting.
Never trust the browser for subscription status, merchant identity, offer ownership, or redemption counts. Enforce server-side with authenticated endpoints and database RLS.

## Subscription lifecycle
Stripe recurring monthly subscription with first billing period priced $29 and subsequent billing periods $79. Implement with an explicit first-period pricing arrangement (e.g. introductory coupon applied once) and verify its behavior in Stripe test mode. Persist Stripe customer/subscription IDs, billing status and current period end; verify webhook signatures and deduplicate events. Do not grant paid merchant privileges solely from client redirects.
Use a billing grace period and dunning strategy for failed renewals. Allow self-service cancellation and billing portal.

## Unit economics and scale
- Measure activation: merchant completes first valid draft.
- Measure conversion: introductory $29 to first $79 renewal.
- Measure retention and contribution: paying merchants, churn, support cost, AI spend per active merchant, redemption rate, merchant-reported incremental contribution.
- Limit per-merchant AI requests and tokens; throttle burst traffic; provide abuse monitoring.
- Use pagination, indexed merchant_id/status queries, asynchronous email/QR jobs, and idempotent redemption records.
- Never issue reusable QR redemption codes without one-time validation, authorization and replay protection.
- Protect personal data and follow merchant email marketing and payment disclosure rules.

## Not yet implemented
Stripe Checkout, billing portal, webhook processor, billing tables, merchant provisioning, payment gating, redemption engine, automated approval, and billing tests. Do not advertise these as operational.
