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
