const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function run() {
  const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const oracleAuth = process.env.ORACLE_AUTH || 'Basic Q1JNLlNUVURFTlQwNzpmdXNpb24xMiM=';
  const agent = new https.Agent({ rejectUnauthorized: false });

  const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/jobs?limit=100&fields=JobId,JobCode,Name&onlyData=true`;

  console.log('Fetching jobs from:', url);
  try {
    const res = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    console.log('Success! Status:', res.status);
    console.log('Count:', res.data.count);
    console.log('Sample item:', JSON.stringify(res.data.items?.[0], null, 2));
  } catch (err) {
    console.log('Failed! Status:', err.response?.status);
    console.log('Response body:', err.response?.data ? JSON.stringify(err.response.data) : err.message);
  }
}

run();
