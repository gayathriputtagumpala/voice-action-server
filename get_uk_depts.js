const axios = require('axios');
const https = require('https');

async function test() {
  const url = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/hcmDepartmentsLOV?q=OrganizationName%20LIKE%20%27%25UK%25%27&onlyData=true&limit=5';
  
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
    console.log(JSON.stringify(res.data.items.map(i => ({ id: i.OrganizationId, name: i.OrganizationName })), null, 2));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

test();
