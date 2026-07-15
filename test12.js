const axios = require('axios');
require('dotenv').config({ path: './.env' });

async function test() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const models = [
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-3.5-flash'
  ];

  for (const model of models) {
    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: 'Test' }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 10 } },
        { headers: { 'Content-Type': 'application/json' } }
      );
      console.log(`Success: ${model}`);
    } catch (e) {
      if (e.response && e.response.data) {
        console.log(`Error ${model}:`, e.response.data.error.message.split('\n')[0]);
      } else {
        console.log(`Error ${model}:`, e.message);
      }
    }
  }
}
test();
