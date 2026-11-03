'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'admin-v2.html'), 'utf8');
const backend = fs.readFileSync(path.join(__dirname, '..', 'backend', 'admin.js'), 'utf8');

test('shared StarSol admin exposes the canonical dashboard surfaces', () => {
    for (const label of ['Overview','Users','Subscriptions','Revenue','Operations','Errors','Invite codes','Referrals','Email','Audit log']) {
        assert.match(html, new RegExp(`>${label}<`));
    }
    assert.match(html, /Star<span className="dot">·<\/span>Sol/);
    assert.doesNotMatch(html, />View<\/button>/);
});

test('user rows are clickable and keyboard accessible', () => {
    assert.match(html, /onClick=\{\(\)=>setSelected\(u\.id\)\}/);
    assert.match(html, /tabIndex="0"/);
});

test('revenue UI and backend preserve unknown provider values', () => {
    assert.match(html, /Lifetime gross collected/);
    assert.match(html, /Quarterly gross collected revenue bar chart/);
    assert.match(backend, /lifetimeGrossRevenue:null/);
    assert.match(backend, /Google Play lifetime transaction history is unavailable/);
});

test('StarSol-specific catalog APIs remain reachable', () => {
    for (const route of ["'/content'", "'/ambient'", "'/sky-events'"]) assert.ok(backend.includes(route));
});
