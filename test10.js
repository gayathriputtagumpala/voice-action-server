const axios = require('axios');
require('dotenv').config({ path: './.env' });

async function test() {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    console.log(res.data.models.map(m => m.name).join('\n'));
  } catch (e) {
    console.log('Error:', e.message);
  }
}
test();
