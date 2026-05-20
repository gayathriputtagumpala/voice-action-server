const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function run() {
  const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const oracleAuth = process.env.ORACLE_AUTH || 'Basic Q1JNLlNUVURFTlQwNzpmdXNpb24xMiM=';
  const agent = new https.Agent({ rejectUnauthorized: false });

  // Query Person 10 first
  const getUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber=10&expand=workRelationships.assignments.managers`;
  console.log('GET URL:', getUrl);

  try {
    const res = await axios.get(getUrl, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    const worker = res.data.items?.[0];
    if (!worker) {
      console.log('Worker 10 not found!');
      return;
    }

    console.log('Worker found:', worker.DisplayName);
    const assignment = worker.workRelationships?.[0]?.assignments?.[0];
    console.log('Assignment details:');
    console.log('- AssignmentId:', assignment?.AssignmentId);
    console.log('- Managers count:', assignment?.managers?.length);
    
    if (assignment?.managers) {
      for (const m of assignment.managers) {
        console.log('Manager item:', {
          ManagerAssignmentId: m.ManagerAssignmentId,
          ManagerAssignmentNumber: m.ManagerAssignmentNumber,
          ManagerName: m.ManagerName,
          ManagerType: m.ManagerType,
          self: m.links?.find(l => l.rel === 'self')?.href
        });
      }
    }

    // Try PATCHing the existing manager record
    const firstManager = assignment?.managers?.find(m => m.ManagerType === 'LINE_MANAGER');
    if (firstManager) {
      const selfLink = firstManager.links?.find(l => l.rel === 'self')?.href;
      console.log('\n--- Attempting PATCH on existing manager ---');
      console.log('PATCH URL:', selfLink);
      
      try {
        const patchRes = await axios.patch(selfLink, {
          "ManagerAssignmentId": 300000047627120, // Keep the same or change slightly
          "ActionCode": "MANAGER_CHANGE"
        }, {
          httpsAgent: agent,
          headers: {
            'Authorization': oracleAuth,
            'Content-Type': 'application/json',
            'Effective-Of': 'RangeMode=UPDATE;RangeStartDate=2025-05-01'
          }
        });
        console.log('PATCH Success! Status:', patchRes.status);
        console.log('Response:', JSON.stringify(patchRes.data, null, 2));
      } catch (patchErr) {
        console.log('PATCH Failed! Status:', patchErr.response?.status);
        console.log('Response body:', JSON.stringify(patchErr.response?.data, null, 2));
      }
    } else {
      console.log('No LINE_MANAGER found for Person 10.');
    }

  } catch (err) {
    console.log('Error:', err.message);
  }
}

run();
