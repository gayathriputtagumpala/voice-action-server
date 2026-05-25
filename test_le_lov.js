const axios = require('axios');
const https = require('https');

async function run() {
  const oracleBaseUrl = 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const oracleAuth = 'Basic Q1JNLlNUVURFTlQwNzpmdXNpb24xMiM=';
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  const url = `${oracleBaseUrl}/hcmRestApi/resources/11.13.18.05/legalEmployersLov`;
  
  console.log('Querying:', url);
  
  try {
    const res = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });
    console.log('Success! Found', res.data.items?.length, 'items');
    console.log('Sample item:', res.data.items?.[0]);
  } catch (err) {
    console.error('Error details:', err.response?.data || err.message);
  }
}

run();
