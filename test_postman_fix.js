const axios = require('axios');
const https = require('https');

async function test() {
  const workerUrl = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/workers/00020000000EACED00057708000110D936468C690000004AACED00057372000D6A6176612E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019DFFBBF00078/child/workRelationships/300000081251443/child/assignments/00020000000EACED00057708000110D936468C750000004AACED00057372000D6A6176612E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019DFFBBF00078';
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  const auth = 'Basic dXNlcl9yMTRfYTJmOnFvMkgqNlcj';
  
  const variations = [
    { name: 'Postman Body (Name only)', body: { "ActionCode": "ASG_CHANGE", "DepartmentName": "Consulting East US" } },
    { name: 'Fix (ID only)', body: { "ActionCode": "ASG_CHANGE", "DepartmentId": 300000047013630 } }
  ];

  for (const v of variations) {
    console.log(`--- Testing ${v.name} ---`);
    try {
      const res = await axios.patch(workerUrl, v.body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
          'Effective-Of': 'RangeMode=UPDATE;RangeStartDate=2025-05-01;RangeEndDate=4712-12-31'
        }
      });
      console.log(`SUCCESS: ${res.status}`);
    } catch (err) {
      console.log(`FAILED: ${err.response?.status}`);
      console.log(`ERROR: ${JSON.stringify(err.response?.data)}`);
    }
  }
}

test();
