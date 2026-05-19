const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const username = 'CRM.STUDENT07';
  const password = 'fusion12#';
  
  const authToken = Buffer.from(`${username}:${password}`).toString('base64');
  const authHeader = `Basic ${authToken}`;
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  
  try {
    const url = `${cleanUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber=10&expand=workRelationships.assignments.managers`;
    const res = await axios.get(url, { httpsAgent: agent, headers: { Authorization: authHeader }});
    const worker = res.data.items?.[0];
    console.log('Worker found:', !!worker);
    const workRel = worker?.workRelationships?.[0];
    console.log('WorkRel found:', !!workRel);
    const assignment = workRel?.assignments?.[0];
    console.log('Assignment found:', !!assignment);
    const links = assignment?.links;
    console.log('Links found:', !!links);
    if (links) {
        console.log('Self link:', links.find(l => l.rel === 'self')?.href);
    }
  } catch(err) {
    console.log('Error status:', err.response?.status);
    console.log('Error data:', err.response?.data);
  }
}
test();
