const axios = require('axios');
const https = require('https');

async function test() {
  const personNumber = '1405'; // Actually I need the person number for the US worker.
  // I'll search for 'Consulting East US' and find a worker in it.
  const baseUrl = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com';
  const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=names.LastName%3D%27Jackman%27&expand=workRelationships.assignments&onlyData=true`;
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  const auth = 'Basic dXNlcl9yMTRfYTJmOnFvMkgqNlcj';
  
  try {
    const res = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      }
    });
    console.log(JSON.stringify(res.data.items?.[0]?.workRelationships?.[0]?.assignments?.[0]?.links, null, 2));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

test();
