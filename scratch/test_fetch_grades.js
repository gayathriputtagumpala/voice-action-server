const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function run() {
  const baseUrl = 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const oracleAuth = 'Basic Q1JNLlNUVURFTlQwNzpmdXNpb24xMiM='; // CRM.STUDENT07
  const agent = new https.Agent({ rejectUnauthorized: false });

  const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/grades?limit=5&onlyData=true`;
  console.log('GET URL:', url);

  try {
    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    console.log('Success! Count:', response.data.count);
    console.log('Sample item:', response.data.items?.[0]);
  } catch (err) {
    console.log('Error status:', err.response?.status);
    console.log('Error body:', JSON.stringify(err.response?.data, null, 2));
  }
}

run();
