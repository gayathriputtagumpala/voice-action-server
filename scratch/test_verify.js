const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const username = 'CRM.STUDENT07';
  const password = 'fusion12#';
  const authToken = Buffer.from(`${username}:${password}`).toString('base64');
  const authHeader = `Basic ${authToken}`;
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  
  try {
    console.log('Testing root resource catalog...');
    const response = await axios.get(
      `${cleanUrl}/hcmRestApi/resources/11.13.18.05/`,
      {
        httpsAgent: agent,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    console.log('Root status:', response.status);
    console.log('Root headers:', Object.keys(response.headers));
  } catch (err) {
    console.error('Root error status:', err.response?.status);
    console.error('Root error message:', err.message);
  }
}

test();
