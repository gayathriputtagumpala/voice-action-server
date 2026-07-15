const axios = require('axios');
require('dotenv').config({ path: './.env' });

async function test() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const model = 'gemini-2.5-flash-lite';
  
  for (let i = 0; i < 5; i++) {
    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: `Test ${i}` }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 10 } },
        { headers: { 'Content-Type': 'application/json' } }
      );
      console.log(`Success ${i}`);
    } catch (e) {
      if (e.response && e.response.data) {
        console.log(`Error ${i}:`, e.response.data.error.message.split('\n')[0]);
      } else {
        console.log(`Error ${i}:`, e.message);
      }
    }
  }
}
test();
