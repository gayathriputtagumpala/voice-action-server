const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. Target single worker lookup route /api/oracle/worker
const oldWorkerSegment = `  const personNumber = req.query.person_number?.toString().trim();
  try {
    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\\/$/, '');
    const url = \`\${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D\${personNumber}&expand=workRelationships.assignments\`;
    
    console.log('1. Person number received:', personNumber);
    console.log('3. Full URL being called:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    const worker = response.data.items?.[0];
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    const workRel = worker.workRelationships?.[0];`;

const newWorkerSegment = `  const personNumber = req.query.person_number?.toString().trim();
  try {
    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\\/$/, '');
    const url = \`\${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D\${personNumber}&expand=workRelationships.assignments\`;
    const urlName = \`\${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D\${personNumber}&fields=PersonNumber,DisplayName&onlyData=true\`;
    
    console.log('1. Person number received:', personNumber);
    console.log('3. Full URL being called:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const [response, responseName] = await Promise.all([
      axios.get(url, {
        httpsAgent: agent,
        headers: {
          'Authorization': oracleAuth,
          'Content-Type': 'application/json'
        }
      }),
      axios.get(urlName, {
        httpsAgent: agent,
        headers: {
          'Authorization': oracleAuth,
          'Content-Type': 'application/json'
        }
      })
    ]);

    const worker = response.data.items?.[0];
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const workerName = responseName.data.items?.[0];
    if (workerName && workerName.DisplayName) {
      worker.DisplayName = workerName.DisplayName;
    }

    const workRel = worker.workRelationships?.[0];`;

// Normalize line endings to LF before replacing, then write back
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOldWorker = oldWorkerSegment.replace(/\r\n/g, '\n');
const normalizedNewWorker = newWorkerSegment.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedOldWorker)) {
  content = normalizedContent.replace(normalizedOldWorker, normalizedNewWorker);
  console.log("Successfully replaced single worker route segment!");
} else {
  console.error("Could not find the target single worker segment in server.js!");
}

// 2. Target managers lookup route /api/oracle/managers
const oldManagersSegment = `app.get('/api/oracle/managers', async (req, res) => {
  let oracleAuth = req.headers['x-oracle-auth'];
  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
    oracleAuth = process.env.ORACLE_AUTH;
  }
  let oracleBaseUrl = req.headers['x-oracle-url'];
  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
    oracleBaseUrl = process.env.ORACLE_BASE_URL;
  }
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\\/$/, '');
    const url = \`\${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?limit=200&expand=workRelationships.assignments&onlyData=true\`;

    console.log('Fetching managers from Oracle...');

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    console.log('Workers fetched count:', response.data.items?.length || 0);

    const managers = [];
    if (response.data.items) {
      response.data.items.forEach(item => {
        const rels = item.workRelationships && item.workRelationships[0];
        const asg = rels && rels.assignments && rels.assignments[0];
        if (asg && item.DisplayName) {
          managers.push({
            PersonNumber: item.PersonNumber,
            DisplayName: item.DisplayName,
            AssignmentId: asg.AssignmentId
          });
        }
      });
    }

    res.json({ managers });

  } catch (err) {
    console.error('Managers error:', err.response?.status);
    console.error('Managers error data:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ error: err.message });
  }
});`;

const newManagersSegment = `app.get('/api/oracle/managers', async (req, res) => {
  let oracleAuth = req.headers['x-oracle-auth'];
  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
    oracleAuth = process.env.ORACLE_AUTH;
  }
  let oracleBaseUrl = req.headers['x-oracle-url'];
  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
    oracleBaseUrl = process.env.ORACLE_BASE_URL;
  }
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\\/$/, '');
    
    const urlNames = \`\${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?limit=250&fields=PersonNumber,DisplayName&onlyData=true\`;
    const urlAsgs = \`\${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?limit=250&expand=workRelationships.assignments&onlyData=true\`;

    console.log('Fetching managers names and assignments in parallel from Oracle...');

    const [resNames, resAsgs] = await Promise.all([
      axios.get(urlNames, { httpsAgent: agent, headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' } }),
      axios.get(urlAsgs, { httpsAgent: agent, headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' } })
    ]);

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

    console.log(\`Successfully merged \${managers.length} active managers.\`);
    res.json({ managers });

  } catch (err) {
    console.error('Managers error:', err.response?.status);
    console.error('Managers error data:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ error: err.message });
  }
});`;

const currentContent = content.replace(/\r\n/g, '\n');
const normalizedOldManagers = oldManagersSegment.replace(/\r\n/g, '\n');
const normalizedNewManagers = newManagersSegment.replace(/\r\n/g, '\n');

if (currentContent.includes(normalizedOldManagers)) {
  content = currentContent.replace(normalizedOldManagers, normalizedNewManagers);
  console.log("Successfully replaced managers list route segment!");
} else {
  console.error("Could not find the target managers list segment in server.js!");
}

fs.writeFileSync(serverPath, content, 'utf8');
console.log("server.js updates completed successfully!");
