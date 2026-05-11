const axios = require('axios');
const https = require('https');

async function test() {
  const buId = '300000046987012'; // US BU
  const url = `https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/departments?q=BusinessUnitId%3D${buId}&onlyData=true&limit=10`;
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  const auth = 'Basic dXNlcl9yMTRfYTJmOmhUOD8yc1U/';
  
  try {
    const res = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      }
    });
    console.log(`SUCCESS! Found ${res.data.items?.length || 0} departments.`);
    console.log(JSON.stringify(res.data.items?.[0], null, 2));
  } catch (err) {
    console.error('FAILED:', err.response?.status);
    console.error('ERROR DATA:', JSON.stringify(err.response?.data));
  }
}

test();
