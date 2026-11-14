import test from "node:test";import assert from "node:assert/strict";import {createHmac} from "node:crypto";import {verifyStripeSignature} from "../netlify/functions/stripe-webhook.mjs";
const secret="whsec_test_secret";const raw='{"id":"evt_test","type":"customer.subscription.updated"}';const now=1800000000;
const signature=(body,t=now)=>"t="+t+",v1="+createHmac("sha256",secret).update(t+"."+body).digest("hex");
test("valid Stripe signature",()=>assert.equal(verifyStripeSignature(raw,signature(raw),secret,now),true));
test("tampered body rejected",()=>assert.equal(verifyStripeSignature(raw+" ",signature(raw),secret,now),false));
test("expired signature rejected",()=>assert.equal(verifyStripeSignature(raw,signature(raw,now-400),secret,now),false));
test("malformed signature rejected",()=>assert.equal(verifyStripeSignature(raw,"t="+now+",v1=abc",secret,now),false));
