const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('./server');

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const post = (url, body) => fetch(base + url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const customer = { name: 'Ali Khan', address: 'Hyderabad, Sindh' };

test('health check', async () => {
  const res = await fetch(base + '/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('serves the storefront page', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Voltix/);
});

test('lists 30+ products with unique ids', async () => {
  const list = await (await fetch(base + '/api/products')).json();
  assert.ok(list.length >= 30);
  assert.equal(new Set(list.map((p) => p.id)).size, list.length);
});

test('unknown product returns 404', async () => {
  assert.equal((await fetch(base + '/api/products/999')).status, 404);
});

test('placing an order totals correctly and reduces stock', async () => {
  const before = (await (await fetch(base + '/api/products/1')).json()).stock;
  const res = await post('/api/orders', { customer, items: [{ id: 1, qty: 2 }, { id: 4, qty: 1 }] });
  assert.equal(res.status, 201);
  const order = await res.json();
  assert.equal(order.total, 1999 * 2 + 2799);
  const after = (await (await fetch(base + '/api/products/1')).json()).stock;
  assert.equal(after, before - 2);
});

test('rejects an empty cart', async () => {
  assert.equal((await post('/api/orders', { customer, items: [] })).status, 400);
});

test('rejects missing customer details', async () => {
  assert.equal((await post('/api/orders', { items: [{ id: 1, qty: 1 }] })).status, 400);
});

test('rejects more than the available stock', async () => {
  assert.equal((await post('/api/orders', { customer, items: [{ id: 21, qty: 999 }] })).status, 409);
});

test('rejects invalid quantities and unknown products', async () => {
  assert.equal((await post('/api/orders', { customer, items: [{ id: 1, qty: 0 }] })).status, 400);
  assert.equal((await post('/api/orders', { customer, items: [{ id: 999, qty: 1 }] })).status, 404);
});
