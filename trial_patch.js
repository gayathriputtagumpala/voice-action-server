const axios = require('axios');
const https = require('https');

async function test() {
  const workerUrl = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/workers/00020000000EACED00057708000110D9364688A90000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019E04E24C0078/child/workRelationships/300000081250483/child/assignments/00020000000EACED00057708000110D9364688B50000004AACED00057372000D6A6176612E73716C2E4461746514FA46683F3566970200007872000E6A6176612E7574696C2E44617465686A81014B597419030000787077080000019E04E24C0078';
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  const auth = 'Basic dXNlcl9yMTRfYTJmOnFvMkgqNlcj';
  
  const variations = [
    { name: 'DepartmentId as Number', body: { "ActionCode": "ASG_CHANGE", "DepartmentId": 300000047597368 } },
    { name: 'DepartmentId as String', body: { "ActionCode": "ASG_CHANGE", "DepartmentId": "300000047597368" } },
    { name: 'OrganizationId as Number', body: { "ActionCode": "ASG_CHANGE", "OrganizationId": 300000047597368 } },
    { name: 'OrganizationId as String', body: { "ActionCode": "ASG_CHANGE", "OrganizationId": "300000047597368" } }
  ];

  for (const v of variations) {
    console.log(`--- Testing ${v.name} ---`);
    try {
      const res = await axios.patch(workerUrl, v.body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
          'Effective-Of': 'RangeMode=UPDATE;RangeStartDate=2024-01-01'
        }
      });
      console.log(`SUCCESS: ${res.status}`);
      break; 
    } catch (err) {
      console.log(`FAILED: ${err.response?.status}`);
      console.log(`ERROR: ${JSON.stringify(err.response?.data)}`);
    }
  }
}

test();
