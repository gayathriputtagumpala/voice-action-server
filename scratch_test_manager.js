const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function run() {
  const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const oracleAuth = process.env.ORACLE_AUTH || 'Basic Q1JNLlNUVURFTlQwNzpmdXNpb24xMiM=';
  const agent = new https.Agent({ rejectUnauthorized: false });

  // Use the actual encoded IDs for worker 1405
  const encodedPersonId = "00020000000EACED00057708000110D9364688A90000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019DF56F380078";
  const WorkRelationshipId = "300000081250483";
  const encodedAssignmentId = "00020000000EACED00057708000110D9364688B50000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019DF56F380078";
  
  let managerAssignmentId = 300000047627120; // from the previous successful search

  const postUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}/child/managers`;

  const tests = [
    {
      name: "POST with Effective-Of: RangeStartDate=2025-05-01",
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json',
        'Effective-Of': 'RangeStartDate=2025-05-01'
      }
    },
    {
      name: "POST with Effective-Of: RangeMode=UPDATE;RangeStartDate=2025-05-01",
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json',
        'Effective-Of': 'RangeMode=UPDATE;RangeStartDate=2025-05-01'
      }
    },
    {
      name: "POST with vnd.oracle media type and RangeStartDate=2025-05-01",
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/vnd.oracle.adf.resourceitem+json',
        'Effective-Of': 'RangeStartDate=2025-05-01'
      }
    }
  ];

  for (const t of tests) {
    console.log(`\n--- Running test: ${t.name} ---`);
    try {
      const res = await axios.post(postUrl, {
        "ManagerAssignmentId": Number(managerAssignmentId),
        "ManagerType": "LINE_MANAGER"
      }, {
        httpsAgent: agent,
        headers: t.headers
      });
      console.log('Success! Status:', res.status);
      console.log('Data:', JSON.stringify(res.data, null, 2));
      break; // stop on success
    } catch (err) {
      console.log('Failed! Status:', err.response?.status);
      console.log('Response body:', err.response?.data ? JSON.stringify(err.response.data) : err.message);
    }
  }
}

run();
