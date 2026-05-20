const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function run() {
  const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const oracleAuth = process.env.ORACLE_AUTH || 'Basic Q1JNLlNUVURFTlQwNzpmdXNpb24xMiM=';
  const agent = new https.Agent({ rejectUnauthorized: false });

  // Use worker 1405's details
  const encodedPersonId = "00020000000EACED00057708000110D9364688A90000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019DF56F380078";
  const WorkRelationshipId = "300000081250483";
  const encodedAssignmentId = "00020000000EACED00057708000110D9364688B50000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019DF56F380078";

  const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;

  console.log('PATCH URL:', url);
  try {
    const response = await axios.patch(url, {
      "ActionCode": "ASG_CHANGE",
      "DepartmentId": 300000047597383 // Consulting West UK
    }, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': oracleAuth,
        'Effective-Of': 'RangeMode=UPDATE;RangeStartDate=2025-05-01'
      }
    });

    console.log('SUCCESS! Status:', response.status);
  } catch (err) {
    console.log('FAILED! Status:', err.response?.status);
    console.log('Response body:', JSON.stringify(err.response?.data, null, 2));
  }
}

run();
