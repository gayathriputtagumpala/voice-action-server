const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function run() {
  const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const oracleAuth = process.env.ORACLE_AUTH || 'Basic Q1JNLlNUVURFTlQwNzpmdXNpb24xMiM=';
  const agent = new https.Agent({ rejectUnauthorized: false });

  const urlNames = `${baseUrl.replace(/\/$/, '')}/hcmRestApi/resources/11.13.18.05/workers?limit=100&fields=PersonNumber,DisplayName&onlyData=true`;
  const urlAsgs = `${baseUrl.replace(/\/$/, '')}/hcmRestApi/resources/11.13.18.05/workers?limit=100&expand=workRelationships.assignments&onlyData=true`;

  console.log('Fetching names and assignments in parallel...');

  try {
    const [resNames, resAsgs] = await Promise.all([
      axios.get(urlNames, { httpsAgent: agent, headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' } }),
      axios.get(urlAsgs, { httpsAgent: agent, headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' } })
    ]);

    console.log('Names status:', resNames.status, 'Count:', resNames.data.items?.length || 0);
    console.log('Assignments status:', resAsgs.status, 'Count:', resAsgs.data.items?.length || 0);

    const nameMap = {};
    if (resNames.data.items) {
      resNames.data.items.forEach(item => {
        nameMap[item.PersonNumber] = item.DisplayName;
      });
    }

    const managers = [];
    if (resAsgs.data.items) {
      resAsgs.data.items.forEach(item => {
        const rels = item.workRelationships && item.workRelationships[0];
        const asg = rels && rels.assignments && rels.assignments[0];
        if (asg) {
          const name = nameMap[item.PersonNumber] || item.PersonNumber;
          managers.push({
            PersonNumber: item.PersonNumber,
            DisplayName: name,
            AssignmentId: asg.AssignmentId
          });
        }
      });
    }

    console.log('Merged Managers count:', managers.length);
    managers.slice(0, 5).forEach((mgr, idx) => {
      console.log(`Manager [${idx}]: Name: ${mgr.DisplayName}, Number: ${mgr.PersonNumber}, AssignmentId: ${mgr.AssignmentId}`);
    });

  } catch (err) {
    console.error('Request failed:', err.message);
  }
}

run();
