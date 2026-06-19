exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const path = params.path || '/football';
  const key = params.key || '';
  const api = params.api || 'flashscore';

  if (!key) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing API key' }) };
  }

  const base = api === 'transfermarkt'
    ? 'https://api.sportdb.dev/api/transfermarkt'
    : 'https://api.sportdb.dev/api/flashscore';

  const url = base + path;

  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': key, 'Accept': 'application/json' }
    });

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: text
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
