import http from 'node:http';
import { randomBytes, createDecipheriv } from 'crypto';
import { Pool } from 'pg';

const BASE = 'http://localhost:3000';

function getEncryptionKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (keyHex) return Buffer.from(keyHex, 'hex');
  return Buffer.from('dashvora-dev-encryption-key-32bytes!', 'utf-8').subarray(0, 32);
}

function decrypt(serialized) {
  const parts = serialized.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');
  const [iv, tag, ciphertext] = parts;
  const key = getEncryptionKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let plaintext = decipher.update(ciphertext, 'hex', 'utf-8');
  plaintext += decipher.final('utf-8');
  return plaintext;
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Read API key from database
  console.log('=== STEP 1: Fetch API key from DB ===');
  const pool = new Pool({
    host: '127.0.0.1', port: 5432, database: 'dashvora',
    user: 'postgres', password: 'root', ssl: false,
    connectionTimeoutMillis: 5000,
  });

  const userResult = await pool.query(
    'SELECT id, email, ai_provider, ai_model, ai_api_endpoint, ai_api_key FROM users WHERE id = 1'
  );
  const user = userResult.rows[0];
  console.log('User:', user.email);
  console.log('Provider:', user.ai_provider);
  console.log('Model:', user.ai_model);
  console.log('Endpoint:', user.ai_api_endpoint);

  // Decrypt the API key
  let apiKey = '';
  try {
    apiKey = decrypt(user.ai_api_key);
    console.log('API key (first 10 chars):', apiKey.substring(0, 10) + '...');
  } catch (e) {
    console.log('Decryption failed:', e.message);
  }
  await pool.end();

  if (!apiKey) {
    console.log('❌ No API key available');
    return;
  }

  // Step 2: Test the AI endpoint
  console.log('\n=== STEP 2: Test AI generate-dashboard endpoint ===');
  
  const testDataset = {
    name: 'Sales Data',
    tableName: 'sales',
    columns: [
      { name: 'id', type: 'INTEGER' },
      { name: 'product_name', type: 'VARCHAR' },
      { name: 'category', type: 'VARCHAR' },
      { name: 'region', type: 'VARCHAR' },
      { name: 'sales_amount', type: 'DECIMAL' },
      { name: 'quantity', type: 'INTEGER' },
      { name: 'sale_date', type: 'DATE' },
      { name: 'customer_name', type: 'VARCHAR' },
    ],
    rowCount: 1500,
    description: 'Product sales across regions with quantity and revenue',
  };

  console.log('Sending prompt: "Show me a summary of sales performance"');
  const start = Date.now();
  const aiResponse = await request('POST', '/api/ai/generate-dashboard', {
    prompt: 'Show me a summary of sales performance',
    dataset: testDataset,
    apiKey: apiKey,
    apiProvider: user.ai_provider || 'openai',
    apiModel: user.ai_model || 'llama-3.3-70b-versatile',
    apiEndpoint: user.ai_api_endpoint || 'https://api.groq.com/openai/v1',
  });
  const duration = Date.now() - start;

  console.log('\nStatus:', aiResponse.status);
  console.log('Duration:', (duration / 1000).toFixed(1) + 's');
  const body = aiResponse.body;

  if (body.success) {
    console.log('\n✅ AI PROMPT WORKING!');
    console.log('Dashboard title:', body.dashboard?.dashboardTitle);
    console.log('Widgets generated:', body.dashboard?.widgets?.length || 0);
    if (body.dashboard?.widgets) {
      body.dashboard.widgets.forEach((w, i) => {
        console.log(`  ${i + 1}. [${w.type}] ${w.title}`);
        if (w.query) console.log(`     Query: ${w.query.substring(0, 120)}...`);
      });
    }
    if (body.dashboard?.insights) {
      console.log('\nInsights:');
      body.dashboard.insights.forEach((ins, i) => console.log(`  ${i + 1}. ${ins}`));
    }
  } else {
    console.log('\n❌ AI PROMPT FAILED');
    console.log('Error:', body.error);
    if (body.useLocalAI) console.log('(Would fall back to local AI)');
  }
}

main().catch(console.error);
