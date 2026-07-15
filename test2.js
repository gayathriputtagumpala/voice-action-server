
const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
require('dotenv').config({ path: './.env' });

async function test() {
  try {
    let baseUrl = process.env.ORACLE_BASE_URL;
    baseUrl = baseUrl.replace(/\/$/, '');
    const auth = process.env.ORACLE_AUTH;
    const url = baseUrl + '/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D1405&expand=workRelationships.assignments.managers';
    console.log('Fetching', url);
    const res = await axios.get(url, { headers: { 'Authorization': auth }, httpsAgent: agent });
    console.log('Success!', res.status);
  } catch (err) {
    console.error('Error!', err.response ? err.response.status : err.message);
    if (err.response) console.error(JSON.stringify(err.response.data));
  }
}
test();

