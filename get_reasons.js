const axios = require('axios');
const https = require('https');

async function test() {
  const url = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/actionReasonsLOV?q=ActionCode%3D%27ASG_CHANGE%27&onlyData=true';
  
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
    console.log(JSON.stringify(res.data.items.map(i => ({ code: i.ActionReasonCode, name: i.ActionReason })), null, 2));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

test();
