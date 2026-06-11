import http from 'node:http';

const BASE = 'http://localhost:3000';

async function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (cookie) opts.headers['Cookie'] = cookie;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), cookie: res.headers['set-cookie']?.[0] || cookie });
        } catch {
          resolve({ status: res.statusCode, body: data, cookie: res.headers['set-cookie']?.[0] || cookie });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== STEP 1: Login ===');
  const login = await request('POST', '/api/auth/login', {
    email: 'abhaykumark@alohatechnologydev.com',
    password: 'Abhay@123',
  });
  console.log('Status:', login.status);
  console.log('Response:', JSON.stringify(login.body, null, 2));
  if (login.status !== 200 || !login.body?.success) {
    console.log('❌ Login failed - cannot continue');
    return;
  }
  const cookie = login.cookie;
  console.log('✅ Logged in successfully');

  console.log('\n=== STEP 2: Check AI Config ===');
  const aiKey = await request('GET', '/api/auth/ai-key', null, cookie);
  console.log('Status:', aiKey.status);
  const cfg = aiKey.body?.config;
  if (cfg) {
    console.log('Provider:', cfg.provider);
    console.log('Model:', cfg.model);
    console.log('Endpoint:', cfg.endpoint);
    console.log('Has Key:', cfg.hasKey);
    console.log('Key preview:', cfg.keyPreview);
    if (cfg.fullKey) console.log('Full key (first 10 chars):', cfg.fullKey.substring(0, 10) + '...');
  } else {
    console.log('Response:', JSON.stringify(aiKey.body, null, 2));
  }

  console.log('\n=== STEP 3: Send AI Prompt ===');
  const aiResponse = await request('POST', '/api/ai/generate-dashboard', {
    prompt: 'Show me a summary of sales performance',
    apiProvider: cfg?.provider || 'openai',
    apiModel: cfg?.model || 'llama-3.3-70b-versatile',
    apiEndpoint: cfg?.endpoint || 'https://api.groq.com/openai/v1',
    apiKey: cfg?.fullKey || '',
  }, cookie);
  console.log('Status:', aiResponse.status);
  const body = aiResponse.body;
  if (aiResponse.status === 200 && body.success) {
    console.log('✅ AI prompt succeeded!');
    console.log('Dashboard name:', body.dashboard?.name);
    console.log('Widgets:', body.dashboard?.widgets?.length || 0);
    if (body.dashboard?.widgets) {
      body.dashboard.widgets.forEach((w, i) => {
        console.log(`  Widget ${i+1}: ${w.title} (${w.type})`);
      });
    }
    if (body.message) console.log('Message:', body.message.substring(0, 200));
  } else {
    console.log('❌ AI prompt failed');
    console.log('Response:', JSON.stringify(body, null, 2));
  }
}

main().catch(console.error);
