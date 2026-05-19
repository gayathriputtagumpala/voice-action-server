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
    const url = `${cleanUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber=13`;
    const res = await axios.get(url, { httpsAgent: agent, headers: { Authorization: authHeader }});
    console.log('Result 1 items count:', res.data.items?.length);
    if (res.data.items?.length > 0) {
      console.log('Worker found:', res.data.items[0].DisplayName);
    } else {
      console.log('Worker NOT found in items!');
    }
  } catch(err) {
    console.log('Error status:', err.response?.status);
    console.log('Error data:', err.response?.data);
  }
}
test();
