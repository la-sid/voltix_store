// Voltix store: a zero-dependency Node.js server (API + website).
const http = require('http');
const fs = require('fs');
const path = require('path');
const baseProducts = require('./products');

function createServer(options = {}) {
  const products = baseProducts.map((p) => ({ ...p }));
  const ordersFile = options.ordersFile || null;
  let orders = [];

  // Restore saved orders (and the stock they used) after a restart
  if (ordersFile && fs.existsSync(ordersFile)) {
    try {
      orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
      orders.forEach((o) => o.items.forEach((l) => {
        const p = products.find((x) => x.id === l.id);
        if (p) p.stock = Math.max(0, p.stock - l.qty);
      }));
    } catch (e) { orders = []; }
  }

  function send(res, status, body, type) {
    const isRaw = Buffer.isBuffer(body) || typeof body === 'string';
    res.writeHead(status, {
      'Content-Type': type || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(isRaw ? body : JSON.stringify(body));
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 100000) { reject(new Error('too large')); req.destroy(); }
      });
      req.on('end', () => {
        try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error('bad json')); }
      });
      req.on('error', reject);
    });
  }

  function placeOrder(body) {
    const customer = body.customer || {};
    const name = String(customer.name || '').trim().slice(0, 80);
    const address = String(customer.address || '').trim().slice(0, 200);
    if (!name || !address) return [400, { error: 'Name and address are required' }];

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return [400, { error: 'Cart is empty' }];

    const wanted = new Map();
    for (const it of items) {
      const id = Number(it.id);
      const qty = Number(it.qty);
      if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1) return [400, { error: 'Invalid item in cart' }];
      wanted.set(id, (wanted.get(id) || 0) + qty);
    }

    const lines = [];
    let total = 0;
    for (const [id, qty] of wanted) {
      const p = products.find((x) => x.id === id);
      if (!p) return [404, { error: `Product ${id} not found` }];
      if (qty > p.stock) return [409, { error: `Only ${p.stock} left of ${p.name}` }];
      lines.push({ id, name: p.name, price: p.price, qty });
      total += p.price * qty;
    }

    lines.forEach((l) => { products.find((x) => x.id === l.id).stock -= l.qty; });
    const order = {
      id: orders.length + 1,
      customer: { name, address },
      items: lines,
      total,
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    if (ordersFile) {
      try { fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2)); } catch (e) { /* ignore */ }
    }
    return [201, order];
  }

  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8');
      }
      if (req.method === 'GET' && pathname === '/health') return send(res, 200, { status: 'ok' });
      if (req.method === 'GET' && pathname === '/api/products') return send(res, 200, products);

      const one = pathname.match(/^\/api\/products\/(\d+)$/);
      if (req.method === 'GET' && one) {
        const p = products.find((x) => x.id === Number(one[1]));
        return p ? send(res, 200, p) : send(res, 404, { error: 'Product not found' });
      }
      if (req.method === 'GET' && pathname === '/api/orders') return send(res, 200, orders);
      if (req.method === 'POST' && pathname === '/api/orders') {
        const [status, payload] = placeOrder(await readBody(req));
        return send(res, status, payload);
      }
      return send(res, 404, { error: 'Not found' });
    } catch (err) {
      const bad = err.message === 'bad json' || err.message === 'too large';
      return send(res, bad ? 400 : 500, { error: bad ? 'Invalid request' : 'Server error' });
    }
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3001;
  createServer({ ordersFile: path.join(__dirname, 'orders.json') })
    .listen(port, () => console.log(`Voltix store running at http://localhost:${port}`));
}

module.exports = { createServer };
