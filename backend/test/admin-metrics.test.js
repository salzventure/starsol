'use strict';

process.env.JWT_SECRET = 'test-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const { _metrics } = require('../backend/admin');

test('annual subscriptions are normalized to monthly revenue', () => {
    assert.equal(_metrics.monthlyValue('explorer', 'year'), 39.99 / 12);
    assert.equal(_metrics.monthlyValue('observer', 'month'), 7.99);
});

test('revenue combines Stripe and committed Google Play subscriptions', () => {
    const result = _metrics.calculateRevenue(
        [{ plan: 'explorer', stripe_price_id: 'monthly', n: 2 }],
        [{ plan: 'observer', subscription_id: 'observer_annual', n: 1 }],
    );
    assert.deepEqual(result.bySource, { stripe: 9.98, play: 5.42 });
    assert.equal(result.mrrApprox, 15.4);
    assert.equal(result.arrApprox, 184.8);
});

test('unknown and institutional plans do not invent recurring revenue', () => {
    assert.equal(_metrics.calculateRevenue([{ plan: 'institutional', n: 4 }], []).mrrApprox, 0);
});
