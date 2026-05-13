const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function testWorker() {
  const personNumber = '10';
  const baseUrl = (process.env.ORACLE_BASE_URL || 'https://dabiqy.ds-fa.oraclepdemos.com').replace(/\/$/, '');
  
  // Try without quotes
  const url1 = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}`;
  // Try with quotes
  const url2 = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D'${personNumber}'`;

  const agent = new https.Agent({ rejectUnauthorized: false });
  const headers = {
    'Authorization': process.env.ORACLE_AUTH,
    'Content-Type': 'application/json'
  };

  console.log('Testing URL 1 (no quotes):', url1);
  try {
    const res1 = await axios.get(url1, { httpsAgent: agent, headers });
    console.log('URL 1 Success! Items found:', res1.data.items?.length);
  } catch (err) {
    console.log('URL 1 Failed:', err.response?.status, err.message);
  }

  console.log('\nTesting URL 2 (with quotes):', url2);
  try {
    const res2 = await axios.get(url2, { httpsAgent: agent, headers });
    console.log('URL 2 Success! Items found:', res2.data.items?.length);
  } catch (err) {
    console.log('URL 2 Failed:', err.response?.status, err.message);
  }
}

testWorker();
