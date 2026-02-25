export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(500).json({ error: { message: 'Missing GEMINI_API_KEY on server' } });
    }

    // Pass-through the exact payload your frontend already builds
    const payload = req.body;

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' +
      encodeURIComponent(key);

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    // Forward status + body
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message || 'Server error' } });
  }
}
