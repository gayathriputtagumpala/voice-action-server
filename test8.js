const axios = require('axios');
require('dotenv').config({ path: './.env' });

async function test() {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const prompt = 'Test';

    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 200 } },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log(geminiRes.data);
  } catch (e) {
    if (e.response && e.response.data) {
      console.log('Error Data:', JSON.stringify(e.response.data, null, 2));
    } else {
      console.log('Error:', e.message);
    }
  }
}
test();
