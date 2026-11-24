'use strict';

process.env.JWT_SECRET = 'test-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const { _metrics } = require('../backend/admin');

test('annual subscriptions are normalized to monthly revenue', () => {
    assert.equal(_metrics.monthlyValue('explorer', 'year'), 9.99 / 12);
    assert.equal(_metrics.monthlyValue('observer', 'month'), 0);
});

test('revenue combines Stripe and committed Google Play subscriptions', () => {
    const result = _metrics.calculateRevenue(
        [{ plan: 'explorer', stripe_price_id: 'monthly', n: 2 }],
        [{ plan: 'observer', subscription_id: 'observer_annual', n: 1 }],
    );
    assert.deepEqual(result.bySource, { stripe: 3.98, play: 0 });
    assert.equal(result.mrrApprox, 3.98);
    assert.equal(result.arrApprox, 47.76);
});

test('unknown and institutional plans do not invent recurring revenue', () => {
    assert.equal(_metrics.calculateRevenue([{ plan: 'institutional', n: 4 }], []).mrrApprox, 0);
});

test('live Stripe data excludes manual membership rows and reflects cancellation timing', async () => {
    const stripe = { subscriptions:{ list:() => ({ async *[Symbol.asyncIterator]() {
        yield { status:'active', cancel_at_period_end:true, items:{data:[{price:{currency:'usd',unit_amount:199,recurring:{interval:'month'}}}]} };
        yield { status:'active', cancel_at_period_end:false, items:{data:[{price:{currency:'usd',unit_amount:999,recurring:{interval:'year'}}}]} };
    } }) } };
    const revenue = await _metrics.collectLiveRevenue(stripe, []);
    assert.equal(revenue.mrrApprox, 2.82);
    assert.equal(revenue.nextMrr, 0.83);
    assert.equal(revenue.providers.stripe.active, 2);
    assert.equal(revenue.complete, true);
});

test('Google cancellation remains current but is excluded from next MRR', async () => {
    const revenue = await _metrics.collectLiveRevenue(null, [
        { plan:'explorer', subscription_id:'explorer_monthly', auto_renewing:0, n:1 },
    ]);
    assert.equal(revenue.providers.play.current, 1.99);
    assert.equal(revenue.providers.play.next, 0);
    assert.equal(revenue.complete, false, 'missing Stripe verification must stay visible');
});
