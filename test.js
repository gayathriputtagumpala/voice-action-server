const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com';
  const username = 'user_r14_a2f';
  const password = 'Lvo4?j2?1';
  
  const authToken = Buffer.from(`${username}:${password}`).toString('base64');
  const authHeader = `Basic ${authToken}`;
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  
  try {
    const response = await axios.get(
      `${cleanUrl}/hcmRestApi/resources/11.13.18.05/workers?limit=1&fields=PersonId`,
      {
        httpsAgent: agent,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    console.log('Success!', response.status);
  } catch(err) {
    console.log('Error status:', err.response?.status);
    console.log('Error data:', err.response?.data);
    console.log('Error message:', err.message);
  }
}
test();
