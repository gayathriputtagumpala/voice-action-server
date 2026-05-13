const axios = require('axios');
const https = require('https');

async function test() {
  const workerUrl = 'https://dabiqy.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/workers/00020000000EACED00057708000110D936468C690000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019E04E24C0078/child/workRelationships/300000081251443/child/assignments/00020000000EACED00057708000110D936468C750000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019E04E24C0078';
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  const auth = 'Basic dXNlcl9yMTNfYTJmOkQ/Nj82dXVD';
  
  const body = {
    "ActionCode": "ASG_CHANGE",
    "DepartmentId": 300000047013620, // Benefits US
    "LocationId": 300000047013170   // Benefits US Location
  };

  console.log(`--- Testing with DepartmentId AND LocationId ---`);
  try {
    const res = await axios.patch(workerUrl, body, {
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

test();
