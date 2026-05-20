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

  const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}/child/managers/describe`;

  try {
    const res = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    const resources = res.data.Resources || res.data.resources;
    const resName = Object.keys(resources)[0];
    const resource = resources[resName];
    console.log('Resource name:', resName);
    
    // Check if attributes are directly in resource or in resource.item
    const item = resource.item || resource;
    const attributes = item.attributes || [];
    console.log('Total attributes found:', attributes.length);
    for (const attr of attributes) {
      console.log(`- ${attr.name} (${attr.type}) [Required: ${attr.required}, Updatable: ${attr.updatable}]`);
    }
  } catch (err) {
    console.log('Failed! Status:', err.response?.status);
    console.log('Response body:', err.response?.data ? JSON.stringify(err.response.data) : err.message);
  }
}

run();
