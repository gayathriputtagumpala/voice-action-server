const axios = require('axios');
const https = require('https');

async function test() {
  try {
    const url = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/departments?q=Name%3D%27Consulting%20West%20UK%27&onlyData=true';
    const agent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': 'Basic dXNlcl9yMTRfYTJmOnFvMkgqNlcj',
        'Content-Type': 'application/json'
      }
    });
    console.log(JSON.stringify(response.data.items, null, 2));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

test();
