const axios = require('axios');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'whatsapp_config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('Using Phone ID:', config.phoneId);
console.log('Using Token (First 15 chars):', config.token.substring(0, 15) + '...');

async function testSend() {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v18.0/${config.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: '919500057053', // A dummy/developer test number (or we can use any number)
        type: 'text',
        text: { body: 'Hello! This is a test message from your Voice Assistant server to verify the WhatsApp channel.' }
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('SUCCESS!');
    console.log('Status:', res.status);
    console.log('Data:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('FAILED!');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Error Details:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error:', err.message);
    }
  }
}

testSend();
