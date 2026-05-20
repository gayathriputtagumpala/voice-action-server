const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function run() {
  const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const oracleAuth = process.env.ORACLE_AUTH || 'Basic Q1JNLlNUVURFTlQwNzpmdXNpb24xMiM=';
  const agent = new https.Agent({ rejectUnauthorized: false });

  // Get a list of workers and expand their assignments and managers
  const getUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?limit=25&expand=workRelationships.assignments.managers`;
  console.log('Fetching workers...');

  try {
    const res = await axios.get(getUrl, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    const workers = res.data.items || [];
    console.log(`Fetched ${workers.length} workers.`);

    for (const w of workers) {
      const assignment = w.workRelationships?.[0]?.assignments?.[0];
      const managers = assignment?.managers || [];
      if (managers.length > 0) {
        console.log(`\nFound worker with manager!`);
        console.log(`Worker: ${w.PersonNumber} - ${w.DisplayName}`);
        console.log(`AssignmentId: ${assignment.AssignmentId}`);
        for (const m of managers) {
          console.log(`- Manager Name: ${m.ManagerName}, Type: ${m.ManagerType}`);
          console.log(`  self: ${m.links?.find(l => l.rel === 'self')?.href}`);
        }
        return;
      }
    }
    console.log('No worker in the first 25 items has a manager.');
  } catch (err) {
    console.log('Error:', err.message);
  }
}

run();
