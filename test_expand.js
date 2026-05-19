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
    const url = `${cleanUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber=10&expand=workRelationships.assignments.managers`;
    const res = await axios.get(url, { httpsAgent: agent, headers: { Authorization: authHeader }});
    console.log('managers expanded items:', res.data.items?.length);
  } catch(err) {
    console.log('managers expanded ERROR:', err.response?.status, err.response?.data);
  }
}
test();
