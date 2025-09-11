const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ✅ Explicitly parse JSON body
    let body = {};
    if (req.body) {
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body;
      }
    }

    const { topic = '', style = '' } = body;
    if (!topic) {
      return res.status(400).json({ error: 'Missing topic' });
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
