const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ✅ Ensure request body is parsed safely
    let body = {};
    try {
      if (req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } else if (req.rawBody) {
        body = JSON.parse(req.rawBody.toString());
      }
    } catch (err) {
      console.error('Body parse error:', err);
    }

    const { topic = '', style = '' } = body;
    if (!topic) {
      console.error('Missing topic in request');
      return res.status(400).json({ error: 'Missing topic' });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY');
      return res.status(500).json({ error: 'No OpenAI API key configured' });
    }

    const systemPrompt = `You are a helpful marketing assistant. 
Given a topic and style, produce:
- social_posts (3 options)
- email_copies (2 options)
- ad_copies (2 options)
Return JSON with those keys.`;

    const userPrompt = `Topic: ${topic}
Style: ${style}
Output:
{
  "social_posts": ["...","...","..."],
  "email_copies": ["...","..."],
  "ad_copies": ["...","..."]
}`;

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 600
      })
    });

    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      console.error('OpenAI API error:', errText);
      return res.status(500).json({ error: 'OpenAI API failed', details: errText });
    }

    const data = await openaiResp.json();
    const reply = data.choices?.[0]?.message?.content || '';

    let parsed = null;
    try {
      const first = reply.indexOf('{');
      const last = reply.lastIndexOf('}');
      if (first !== -1 && last !== -1) {
        parsed = JSON.parse(reply.slice(first, last + 1));
      }
    } catch (e) {
      console.error('JSON parse error:', e);
    }

    res.status(200).json({ success: true, raw: reply, parsed });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
};
