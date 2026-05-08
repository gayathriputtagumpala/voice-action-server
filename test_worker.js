const axios = require('axios');
const https = require('https');

async function test() {
  try {
    const personNumber = '1405'; // Example person number
    const baseUrl = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com';
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&expand=workRelationships.assignments`;
    
    const agent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': 'Basic dXNlcl9yMTRfYTJmOnFvMkgqNlcj',
        'Content-Type': 'application/json'
      }
    });
    
    const worker = response.data.items?.[0];
    const assignment = worker?.workRelationships?.[0]?.assignments?.[0];
    console.log('Assignment details:', JSON.stringify(assignment, null, 2));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

test();
