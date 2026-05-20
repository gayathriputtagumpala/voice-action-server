const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function run() {
  const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const oracleAuth = process.env.ORACLE_AUTH || 'Basic Q1JNLlNUVURFTlQwNzpmdXNpb24xMiM=';
  const agent = new https.Agent({ rejectUnauthorized: false });

  const selfLink = 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com:443/hcmRestApi/resources/11.13.18.05/workers/00020000000EACED00057708000110D9344656550000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019E42AE9C0078/child/workRelationships/300000047683171/child/assignments/00020000000EACED00057708000110D9344656690000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019E42AE9C0078/child/managers/00020000000EACED00057708000000000000008B0000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019E42AE9C0078';
  
  const tests = [
    {
      name: "PATCH with no ActionCode",
      body: {
        "ManagerAssignmentId": 300000047627120
      }
    },
    {
      name: "PATCH with ActionCode = ASG_CHANGE",
      body: {
        "ManagerAssignmentId": 300000047627120,
        "ActionCode": "ASG_CHANGE"
      }
    }
  ];

  for (const t of tests) {
    console.log(`\n--- Running: ${t.name} ---`);
    try {
      const patchRes = await axios.patch(selfLink, t.body, {
        httpsAgent: agent,
        headers: {
          'Authorization': oracleAuth,
          'Content-Type': 'application/json',
          'Effective-Of': 'RangeMode=UPDATE;RangeStartDate=2025-05-01'
        }
      });
      console.log('Success! Status:', patchRes.status);
    } catch (patchErr) {
      console.log('Failed! Status:', patchErr.response?.status);
      console.log('Response body:', JSON.stringify(patchErr.response?.data, null, 2));
    }
  }
}

run();
