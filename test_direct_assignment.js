const axios = require('axios');
const https = require('https');

async function test() {
  // Using the direct assignments resource instead of the worker/child resource
  const assignmentUrl = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/assignments/00020000000EACED00057708000110D936468C750000004AACED00057372000D6A6176612E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019DFFBBF00078';
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  const auth = 'Basic dXNlcl9yMTRfYTJmOnFvMkgqNlcj';
  
  const body = { 
    "ActionCode": "ASG_CHANGE", 
    "DepartmentId": 300000047013600 // Accounting US
  };

  console.log(`--- Testing Direct Assignment PATCH ---`);
  try {
    const res = await axios.patch(assignmentUrl, body, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        'Effective-Of': 'RangeMode=UPDATE;RangeStartDate=2026-05-09'
      }
    });
    console.log(`SUCCESS: ${res.status}`);
  } catch (err) {
    console.log(`FAILED: ${err.response?.status}`);
    console.log(`ERROR: ${JSON.stringify(err.response?.data)}`);
  }
}

test();
