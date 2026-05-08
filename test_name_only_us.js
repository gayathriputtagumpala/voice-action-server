const axios = require('axios');
const https = require('https');

async function test() {
  const workerUrl = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/workers/00020000000EACED00057708000110D936468C690000004AACED00057372000D6A6176612E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019DFFBBF00078/child/workRelationships/300000081251443/child/assignments/00020000000EACED00057708000110D936468C750000004AACED00057372000D6A6176612E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019DFFBBF00078';
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  const auth = 'Basic dXNlcl9yMTRfYTJmOnFvMkgqNlcj';
  
  const body = { 
    "ActionCode": "ASG_CHANGE", 
    "DepartmentName": "Accounting US"
  };

  console.log(`--- Testing Change with DepartmentName ONLY (Valid US Dept) ---`);
  try {
    const res = await axios.patch(workerUrl, body, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        'Effective-Of': 'RangeMode=UPDATE;RangeStartDate=2025-05-01'
      }
    });
    console.log(`SUCCESS: ${res.status}`);
  } catch (err) {
    console.log(`FAILED: ${err.response?.status}`);
    console.log(`ERROR: ${JSON.stringify(err.response?.data)}`);
  }
}

test();
