import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { databaseService, getPersistentConnection } from '@/lib/database';
import { decrypt, parseEncrypted } from '@/lib/crypto/encryption';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

interface GenerateRequest {
  prompt: string;
  dataset: {
    name: string;
    tableName: string;
    columns: { name: string; type: string }[];
    rowCount: number;
    description?: string;
  };
  apiKey?: string;         // Allow passing API key directly in request body
  apiProvider?: string;     // 'openai' | 'anthropic' | etc.
  apiModel?: string;        // Model name override
  apiEndpoint?: string;     // Custom endpoint override
}

/**
 * POST /api/ai/generate-dashboard
 *
 * Calls an AI provider to generate a dashboard configuration from a user prompt.
 *
 * The API key can come from:
 *   1. The request body (apiKey field) — for users who provide it on the fly
 *   2. The user's stored settings in the database (encrypted) — for logged-in users
 *
 * If no API key is available, returns { success: false, useLocalAI: true }
 * so the client falls back to the local AI orchestrator.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse the request body
    const parsed: GenerateRequest = await request.json();
    const { prompt, dataset, apiKey: bodyApiKey, apiProvider, apiModel, apiEndpoint } = parsed;

    if (!prompt || !dataset) {
      return NextResponse.json(
        { success: false, error: 'Prompt and dataset are required.' },
        { status: 400 }
      );
    }

    // 2. Resolve AI configuration — prefer body params, fall back to DB-stored settings
    let apiKey = bodyApiKey || '';
    let provider = apiProvider || 'openai';
    let model = apiModel || 'gpt-4o';
    let endpoint = apiEndpoint || 'https://api.openai.com/v1';

    if (!apiKey) {
      // Try to get API key from the user's stored settings
      const token = request.cookies.get('dashvora_token')?.value;
      if (token) {
        try {
          const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
          const userId = payload.userId;

          const connectionId = await getPersistentConnection();
          const userResult = await databaseService.executeWriteQuery(
            connectionId,
            'SELECT ai_provider, ai_model, ai_api_endpoint, ai_api_key FROM users WHERE id = $1',
            [userId]
          );

          if (userResult.rows.length > 0) {
            const userRow = userResult.rows[0];
            if (userRow.ai_api_key) {
              try {
                apiKey = decrypt(parseEncrypted(userRow.ai_api_key));
                provider = userRow.ai_provider || provider;
                model = userRow.ai_model || model;
                endpoint = userRow.ai_api_endpoint || endpoint;
              } catch {
                // Decryption failed — continue without API key
              }
            }
          }
        } catch {
          // Token invalid — continue without API key
        }
      }
    }

    // 3. If we still have no API key, tell the client to use local AI
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No AI API key available. Please add one in Settings or pass it in the request.',
          useLocalAI: true,
        },
        { status: 400 }
      );
    }

    // 4. Build the prompt for the AI provider
    const schemaDescription = dataset.columns
      .map(c => `  - ${c.name} (${c.type})`)
      .join('\n');

    const systemPrompt = `You are a dashboard-generation AI. Given a dataset schema and a user request, generate a JSON dashboard configuration.

The dashboard should contain 4-8 widgets including:
- KPI cards (for key metrics)
- Charts (area, bar, line, pie/donut based on data)
- Tables for detailed breakdowns

Return ONLY valid JSON with this exact structure:
{
  "dashboardTitle": "string",
  "filters": ["array of filterable column names"],
  "widgets": [
    {
      "title": "string",
      "type": "kpi|area|bar|line|pie|donut|table",
      "query": "SELECT ... SQL query (use the exact table name: ${dataset.tableName})",
      "xAxis": "column name for x-axis",
      "yAxis": "column name for y-axis",
      "yAxis2": "optional second y-axis column",
      "w": number (grid width 4 or 6 or 8 or 12),
      "h": number (grid height 2 for kpi, 4 for others)
    }
  ],
  "insights": ["3 business insights as bullet points"]
}

Use the EXACT table name "${dataset.tableName}" in all SQL queries.
Use aggregation functions (SUM, AVG, COUNT, MAX, MIN) with GROUP BY as needed.
Match the actual column names from the schema.`;

    const userPrompt = `Dataset: ${dataset.name} (${dataset.tableName})\nSchema:\n${schemaDescription}\nRow count: ${dataset.rowCount}\n\nUser request: "${prompt}"\n\nGenerate a comprehensive dashboard JSON.`;

    // 5. Call the AI provider
    let apiUrl: string;
    let response: Response;

    if (provider === 'anthropic') {
      apiUrl = endpoint.trim().replace(/\/+$/, '') + '/messages';
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        return NextResponse.json(
          { success: false, error: `AI API error (${response.status}): ${errText}` },
          { status: 502 }
        );
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';
      const dashboardJson = extractJson(content);

      if (!dashboardJson) {
        return NextResponse.json(
          { success: false, error: 'AI response did not contain valid JSON.' },
          { status: 502 }
        );
      }

      return NextResponse.json({ success: true, dashboard: dashboardJson });
    } else {
      // Default: OpenAI-compatible API (works with OpenAI, Groq, Together, etc.)
      apiUrl = endpoint.trim().replace(/\/+$/, '') + '/chat/completions';
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        return NextResponse.json(
          { success: false, error: `AI API error (${response.status}): ${errText}` },
          { status: 502 }
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const dashboardJson = extractJson(content);

      if (!dashboardJson) {
        return NextResponse.json(
          { success: false, error: 'AI response did not contain valid JSON.' },
          { status: 502 }
        );
      }

      return NextResponse.json({ success: true, dashboard: dashboardJson });
    }
  } catch (err: any) {
    console.error('[API/AI/GenerateDashboard] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

/**
 * Extract a JSON object from a string that might contain markdown.
 */
function extractJson(text: string): any {
  // Try to find JSON between ```json and ``` markers
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch { /* fall through */ }
  }

  // Try to find a JSON object directly
  try {
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      return JSON.parse(text.substring(startIdx, endIdx + 1));
    }
  } catch { /* fall through */ }

  return null;
}
