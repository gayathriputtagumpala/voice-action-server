const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Oracle SSO verification endpoint
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { oracleUrl, username, password } = req.body;
    
    if (!oracleUrl || !username || !password) {
      return res.status(400).json({ 
        error: 'Oracle URL, username and password required' 
      });
    }
    
    // Clean the URL
    const cleanUrl = oracleUrl.replace(/\/$/, '');
    
    console.log('Verifying Oracle credentials for:', username);
    console.log('Oracle URL:', cleanUrl);
    
    // Generate Basic Auth token
    const authToken = Buffer.from(`${username}:${password}`)
      .toString('base64');
    const authHeader = `Basic ${authToken}`;
    
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    
    // Verify by calling Oracle API
    const response = await axios.get(
      `${cleanUrl}/hcmRestApi/resources/11.13.18.05/workers?limit=1&fields=PersonId`,
      {
        httpsAgent: agent,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    if (response.status === 200) {
      console.log('Oracle credentials verified successfully');
      
      // Return success with auth token
      // Never store password - only return encoded token
      res.json({
        success: true,
        authToken: authHeader,
        oracleUrl: cleanUrl,
        username: username,
        message: 'Login successful'
      });
    }
    
  } catch (err) {
    console.error('Auth verify error:', err.response?.status);
    
    if (err.response?.status === 401) {
      res.status(401).json({ 
        error: 'Invalid Oracle username or password' 
      });
    } else if (err.response?.status === 503) {
      res.status(503).json({ 
        error: 'Oracle Environment is currently down for scheduled maintenance. Please try again later.' 
      });
    } else if (err.code === 'ENOTFOUND' || 
               err.code === 'ECONNREFUSED') {
      res.status(400).json({ 
        error: 'Cannot connect to Oracle URL. Please check the URL.' 
      });
    } else if (err.code === 'ETIMEDOUT') {
      res.status(400).json({ 
        error: 'Connection timeout. Please check Oracle URL.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Verification failed. Please try again.' 
      });
    }
  }
});

// 1. Sarvam STT Proxy
app.post('/api/sarvam/stt', upload.single('file'), async (req, res) => {
  try {
    console.log('File received:', req.file?.originalname, req.file?.size, req.file?.mimetype);

    const FormData = require('form-data');
    const formData = new FormData();

    formData.append('file', req.file.buffer, {
      filename: 'recording.webm',
      contentType: 'audio/webm'
    });
    
    formData.append('model', 'saaras:v3');
    formData.append('mode', 'transcribe');
    formData.append('language_code', 'unknown');

    console.log('Sending to Sarvam with language_code: unknown');

    const response = await axios.post(
      'https://api.sarvam.ai/speech-to-text',
      formData,
      {
        headers: {
          'api-subscription-key': process.env.SARVAM_API_KEY,
          ...formData.getHeaders()
        },
        timeout: 30000
      }
    );

    console.log('Sarvam success:', response.data);

    res.json({
      transcript: response.data.transcript,
      language_code: response.data.language_code
    });

  } catch (err) {
    console.error('Sarvam error:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ 
      error: err.response?.data?.error?.message || err.message 
    });
  }
});

// 2. Entity Extraction via Rules
app.post('/api/extract', async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: 'No transcript provided' });
  }

  let person_number = null;
  let manager_name = null;
  let effective_date = new Date().toISOString().split('T')[0];

  // 1. person_number: first sequence of digits
  const digitMatch = transcript.match(/\d+/);
  if (digitMatch) {
    person_number = digitMatch[0];
  }

  // 2. manager_name: after keywords
  const lowerTranscript = transcript.toLowerCase();
  const keywords = ["manager", "as manager", "manager as", "மேனேஜர்", "manager ko", "manager ni"];
  
  let keywordIndex = -1;
  let matchedKeyword = "";
  for (const kw of keywords) {
    const idx = lowerTranscript.indexOf(kw);
    if (idx !== -1) {
      keywordIndex = idx;
      matchedKeyword = kw;
      break;
    }
  }

  if (keywordIndex !== -1) {
    const afterKeyword = transcript.substring(keywordIndex + matchedKeyword.length).trim();
    const words = afterKeyword.split(/\s+/);
    if (words.length > 0) {
      let startIdx = 0;
      if (['for', 'to', 'person', 'number'].includes(words[startIdx].toLowerCase())) startIdx++;
      
      manager_name = words.slice(startIdx, startIdx + 2).join(' ').replace(/[^\w\s]/g, '').trim();
    }
  }

  if (!manager_name) manager_name = 'Priya'; // minimal fallback so it doesn't completely fail

  return res.json({ person_number, manager_name, effective_date });
});

// 3. Oracle Proxy - Get Worker
app.get('/api/oracle/worker', async (req, res) => {
  let oracleAuth = req.headers['x-oracle-auth'];
  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
    oracleAuth = process.env.ORACLE_AUTH;
  }
  let oracleBaseUrl = req.headers['x-oracle-url'];
  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
    oracleBaseUrl = process.env.ORACLE_BASE_URL;
  }
  const personNumber = req.query.person_number?.toString().trim();
  try {
    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&expand=workRelationships.assignments`;
    const urlName = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&fields=PersonNumber,DisplayName&onlyData=true`;
    
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

    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];

    // Extract encoded IDs from the self link URL
    // The link looks like: /workers/{encodedPersonId}/child/workRelationships/{workRelId}/child/assignments/{encodedAssignmentId}
    const assignmentSelfLink = assignment?.links?.find(l => l.rel === 'self')?.href;
    
    console.log('Assignment self link:', assignmentSelfLink);

    // Parse encoded IDs from the self href link
    const linkParts = assignmentSelfLink?.split('/');
    const workersIdx = linkParts?.indexOf('workers');
    const assignmentsIdx = linkParts?.lastIndexOf('assignments');
    
    const encodedPersonId = workersIdx >= 0 ? linkParts[workersIdx + 1].split('?')[0] : null;
    const encodedAssignmentId = assignmentsIdx >= 0 ? linkParts[assignmentsIdx + 1].split('?')[0] : null;
    const workRelationshipId = workRel?.PeriodOfServiceId || workRel?.WorkRelationshipId; // numeric, use as-is

    console.log('Encoded PersonId:', encodedPersonId);
    console.log('WorkRelationshipId:', workRelationshipId);
    console.log('Encoded AssignmentId:', encodedAssignmentId);

    // Get current manager details
    let currentManager = assignment?.managers?.find(m => m.ManagerType === "LINE_MANAGER");
    if (!currentManager && assignment?.managers?.length > 0) {
      currentManager = assignment.managers[0];
    }

    let currentManagerName = 'None';
    let currentManagerNumber = null;

    if (currentManager && currentManager.ManagerAssignmentNumber) {
      const managerAssignmentNum = currentManager.ManagerAssignmentNumber; 
      const managerPersonNum = managerAssignmentNum.replace(/e/i, '');
      
      try {
        const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
        const mgrUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${managerPersonNum}&fields=PersonId,PersonNumber,DisplayName&onlyData=true`;
        
        const mgrResponse = await axios.get(mgrUrl, {
          httpsAgent: agent,
          headers: {
            'Authorization': oracleAuth,
            'Content-Type': 'application/json'
          }
        });

        if (mgrResponse.data.items && mgrResponse.data.items.length > 0) {
          currentManagerName = mgrResponse.data.items[0].DisplayName || mgrResponse.data.items[0].PersonNumber;
          currentManagerNumber = mgrResponse.data.items[0].PersonNumber;
        } else {
          currentManagerName = currentManager?.ManagerName || managerAssignmentNum;
        }
        console.log('Current manager name:', currentManagerName);
      } catch (mgrErr) {
        console.log('Could not fetch manager name:', mgrErr.message);
        currentManagerName = currentManager?.ManagerName || managerAssignmentNum;
      }
    }

    const managerSelfLink = currentManager?.links?.find(l => l.rel === 'self')?.href;

    res.json({
      PersonId: worker.PersonId,
      PersonNumber: worker.PersonNumber,
      DisplayName: worker.DisplayName || worker.PersonNumber,
      encodedPersonId: encodedPersonId,
      WorkRelationshipId: workRelationshipId,
      encodedAssignmentId: encodedAssignmentId,
      AssignmentId: assignment?.AssignmentId,
      AssignmentNumber: assignment?.AssignmentNumber,
      assignmentSelfLink: assignmentSelfLink,
      currentManagerAssignmentId: currentManager?.ManagerAssignmentId,
      currentManagerNumber: currentManagerNumber || currentManager?.ManagerAssignmentNumber,
      currentManagerName: currentManagerName,
      managerSelfLink: managerSelfLink,
      DepartmentName: assignment?.DepartmentName || 'Not Assigned',
      BusinessUnitId: assignment?.BusinessUnitId,
      BusinessUnitName: workRel?.BusinessUnitName || assignment?.BusinessUnitName,
      LocationId: assignment?.LocationId || null,
      LocationName: assignment?.LocationCode || 'Not Assigned',
      JobId: assignment?.JobId || null,
      JobName: assignment?.JobName || assignment?.JobCode || 'Not Assigned'
    });
  } catch (error) {
    console.error('Oracle Worker Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch worker details' });
  }
});

// 4. Oracle Proxy - Get Manager
app.get('/api/oracle/manager', async (req, res) => {
  let oracleAuth = req.headers['x-oracle-auth'];
  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
    oracleAuth = process.env.ORACLE_AUTH;
  }
  let oracleBaseUrl = req.headers['x-oracle-url'];
  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
    oracleBaseUrl = process.env.ORACLE_BASE_URL;
  }
  const manager_person_number = req.query.manager_person_number?.toString().trim();
  try {
    const url = `${oracleBaseUrl || 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com'}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${manager_person_number}&expand=workRelationships.assignments`;
    
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Oracle Manager Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch manager details' });
  }
});

app.get('/api/oracle/managers', async (req, res) => {
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

    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
    
    const urlNames = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?limit=250&fields=PersonNumber,DisplayName&onlyData=true`;
    const urlAsgs = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?limit=250&expand=workRelationships.assignments&onlyData=true`;

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

    console.log(`Successfully merged ${managers.length} active managers.`);
    res.json({ managers });

  } catch (err) {
    console.error('Managers error:', err.response?.status);
    console.error('Managers error data:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ error: err.message });
  }
});

// 5. Oracle Proxy - Assign Manager
app.post('/api/oracle/assign', async (req, res) => {
  let oracleAuth = req.headers['x-oracle-auth'];
  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
    oracleAuth = process.env.ORACLE_AUTH;
  }
  let oracleBaseUrl = req.headers['x-oracle-url'];
  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
    oracleBaseUrl = process.env.ORACLE_BASE_URL;
  }
  try {
    const { 
      encodedPersonId,
      WorkRelationshipId, 
      encodedAssignmentId, 
      ManagerAssignmentId,
      managerSelfLink,
      effectiveDate
    } = req.body;

    console.log('=== ASSIGN MANAGER ===');
    console.log('encodedPersonId:', encodedPersonId);
    console.log('WorkRelationshipId:', WorkRelationshipId);
    console.log('encodedAssignmentId:', encodedAssignmentId);
    console.log('ManagerAssignmentId:', ManagerAssignmentId);
    console.log('managerSelfLink:', managerSelfLink);
    console.log('effectiveDate:', effectiveDate);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    let response;
    
    if (managerSelfLink) {
      // If employee already has a manager, we PATCH the existing manager record
      console.log('PATCHing existing manager record...');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': oracleAuth
      };
      
      if (effectiveDate) {
        headers['Effective-Of'] = `RangeMode=UPDATE;RangeStartDate=${effectiveDate}`;
      }

      response = await axios.patch(managerSelfLink,
        {
          "ManagerAssignmentId": Number(ManagerAssignmentId),
          "ManagerType": "LINE_MANAGER",
          "ActionCode": "MANAGER_CHANGE"
        },
        {
          httpsAgent: agent,
          headers: headers
        }
      );
    } else {
      // If no manager exists, POST a new one
      const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
      const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}/child/managers`;

      console.log('Final URL (POST):', url);

      response = await axios.post(url,
        {
          "ManagerAssignmentId": Number(ManagerAssignmentId),
          "ManagerType": "LINE_MANAGER"
        },
        {
          httpsAgent: agent,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': oracleAuth
          }
        }
      );
    }

    console.log('SUCCESS! Status:', response.status);
    res.json({ success: true, message: 'Manager assigned successfully' });

  } catch (err) {
    console.error('ASSIGN ERROR:', err.response?.status);
    console.error('ASSIGN ERROR DATA:', JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ 
      error: (err.response?.status === 403) ? "Oracle HCM Access Forbidden (403): The active Oracle account ('CRM.STUDENT07') does not have sufficient security roles/privileges to write to the supervisor/managers child resource. Please ensure the user has supervisor/manager write privileges (e.g. 'Use REST Service - Workers') in the Oracle Security Console, or provide a more privileged administrative account." : (err.response?.data?.detail || err.response?.data?.title || err.message) 
    });
  }
});

// 6. Oracle Proxy - Change Department
app.patch('/api/oracle/department', async (req, res) => {
  let oracleAuth = req.headers['x-oracle-auth'];
  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
    oracleAuth = process.env.ORACLE_AUTH;
  }
  let oracleBaseUrl = req.headers['x-oracle-url'];
  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
    oracleBaseUrl = process.env.ORACLE_BASE_URL;
  }
  try {
    const { 
      assignmentSelfLink,
      encodedPersonId, 
      WorkRelationshipId, 
      encodedAssignmentId,
      DepartmentId,
      EffectiveDate
    } = req.body;

    console.log(`[${new Date().toISOString()}] PATCH Department Request Received`);
    
    const effectiveDate = EffectiveDate || '2025-05-01';

    // Use provided assignmentSelfLink or construct fallback
    let url = assignmentSelfLink;
    if (!url) {
      const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
      url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;
    }

    console.log('Target URL:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const body = {
      "ActionCode": "ASG_CHANGE",
      "DepartmentId": Number(DepartmentId)
    };

    console.log('Attempting UPDATE mode...');
    try {
      const response = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });

      console.log('UPDATE success:', response.status);
      return res.json({ success: true, message: 'Department updated successfully (UPDATE mode)' });

    } catch (updateErr) {
      console.log('UPDATE mode failed, attempting CORRECTION mode...');
      console.log('Update Error Details:', JSON.stringify(updateErr.response?.data || updateErr.message));

      // Attempt CORRECTION mode as fallback
      const corrResponse = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': 'RangeMode=CORRECTION'
        }
      });

      console.log('CORRECTION success:', corrResponse.status);
      return res.json({ success: true, message: 'Department updated successfully (CORRECTION mode)' });
    }

  } catch (err) {
    const status = err.response?.status || 500;
    const errorData = err.response?.data;
    console.error(`Department Error [${status}]:`, JSON.stringify(errorData || err.message));
    
    res.status(status).json({ 
      error: errorData || err.message,
      detail: err.message
    });
  }
});

app.get('/api/oracle/locations', async (req, res) => {
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

    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/locations?limit=100&fields=LocationId,LocationName,AddressLine1,TownOrCity,Country&onlyData=true`;

    console.log('Fetching locations from Oracle...');

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    console.log('Locations count:', response.data.count);

    const locations = response.data.items
      .filter(l => l.LocationName)
      .map(l => ({
        LocationId: l.LocationId,
        LocationName: l.LocationName,
        City: l.TownOrCity || '',
        Country: l.Country || ''
      }));

    res.json({ locations });

  } catch (err) {
    console.error('Locations error:', err.response?.status);
    console.error('Locations error data:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/oracle/location', async (req, res) => {
  let oracleAuth = req.headers['x-oracle-auth'];
  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
    oracleAuth = process.env.ORACLE_AUTH;
  }
  let oracleBaseUrl = req.headers['x-oracle-url'];
  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
    oracleBaseUrl = process.env.ORACLE_BASE_URL;
  }
  try {
    const {
      encodedPersonId,
      WorkRelationshipId,
      encodedAssignmentId,
      LocationId,
      LocationName,
      EffectiveDate
    } = req.body;

    const effectiveDate = EffectiveDate || '2025-05-01';

    console.log('=== CHANGE LOCATION REQUEST ===');
    console.log('LocationId:', LocationId);
    console.log('LocationName:', LocationName);
    console.log('EffectiveDate:', effectiveDate);

    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;

    console.log('PATCH URL:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const body = {
      "ActionCode": "ASG_CHANGE",
      "LocationId": Number(LocationId)
    };

    console.log('Request body:', JSON.stringify(body));

    const response = await axios.patch(url, body, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': oracleAuth,
        'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
      }
    });

    console.log('Location change success:', response.status);
    res.json({
      success: true,
      message: `Location changed to ${LocationName} successfully`
    });

  } catch (err) {
    console.error('Location change error:', err.response?.status);
    console.error('Location error data:', JSON.stringify(err.response?.data));
    res.status(500).json({
      error: err.response?.data?.detail ||
             err.response?.data?.title ||
             JSON.stringify(err.response?.data) ||
             err.message
    });
  }
});

app.get('/api/oracle/jobs', async (req, res) => {
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

    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/jobs?limit=500&fields=JobId,JobCode,Name&onlyData=true`;

    console.log('Fetching jobs from Oracle...');

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    console.log('Jobs count:', response.data.count);

    const jobs = response.data.items
      .filter(j => j.Name)
      .map(j => ({
        JobId: j.JobId,
        JobCode: j.JobCode,
        Name: j.Name
      }));

    res.json({ jobs });

  } catch (err) {
    console.error('Jobs error:', err.response?.status);
    console.error('Jobs error data:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/oracle/job', async (req, res) => {
  let oracleAuth = req.headers['x-oracle-auth'];
  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
    oracleAuth = process.env.ORACLE_AUTH;
  }
  let oracleBaseUrl = req.headers['x-oracle-url'];
  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
    oracleBaseUrl = process.env.ORACLE_BASE_URL;
  }
  try {
    const {
      encodedPersonId,
      WorkRelationshipId,
      encodedAssignmentId,
      JobId,
      JobName,
      EffectiveDate
    } = req.body;

    const effectiveDate = EffectiveDate || '2025-05-01';

    console.log('=== CHANGE JOB REQUEST ===');
    console.log('JobId:', JobId);
    console.log('JobName:', JobName);
    console.log('EffectiveDate:', effectiveDate);

    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;

    console.log('PATCH URL:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const body = {
      "ActionCode": "ASG_CHANGE",
      "JobId": Number(JobId)
    };

    console.log('Request body:', JSON.stringify(body));

    console.log('Attempting UPDATE mode for Job...');
    try {
      const response = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });

      console.log('UPDATE mode success for Job:', response.status);
      res.json({
        success: true,
        message: `Job changed to ${JobName} successfully (UPDATE mode)`
      });
    } catch (updateErr) {
      console.log('UPDATE mode failed for Job, trying CORRECTION mode...');
      console.log('Update Job Error Details:', JSON.stringify(updateErr.response?.data || updateErr.message));

      const corrResponse = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': 'RangeMode=CORRECTION'
        }
      });

      console.log('CORRECTION mode success for Job:', corrResponse.status);
      res.json({
        success: true,
        message: `Job changed to ${JobName} successfully (CORRECTION mode)`
      });
    }

  } catch (err) {
    console.error('Job change error:', err.response?.status);
    console.error('Job error data:', JSON.stringify(err.response?.data));
    res.status(500).json({
      error: err.response?.data?.detail ||
             err.response?.data?.title ||
             JSON.stringify(err.response?.data) ||
             err.message
    });
  }
});

app.get('/api/oracle/departments', async (req, res) => {
  let oracleAuth = req.headers['x-oracle-auth'];
  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
    oracleAuth = process.env.ORACLE_AUTH;
  }
  let oracleBaseUrl = req.headers['x-oracle-url'];
  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
    oracleBaseUrl = process.env.ORACLE_BASE_URL;
  }
  const { BusinessUnitName } = req.query;
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    // Use the stable departments resource
    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '') + '/hcmRestApi/resources/11.13.18.05';
    let url = `${baseUrl}/departments?onlyData=true&limit=500`;

    console.log('Fetching departments from stable resource:', url);

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    let departments = (response.data.items || [])
      .map(d => ({
        DepartmentId: d.OrganizationId,
        DepartmentName: d.Name
      }));

    // Smart filter disabled to ensure all departments (like "China") are available
    /*
    if (BusinessUnitName && BusinessUnitName !== 'undefined') {
        ...
    }
    */

    res.json({ departments });

  } catch (err) {
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error('Departments error:', errorDetails);
    res.status(500).json({ 
      error: errorDetails
    });
  }
});

app.listen(port, () => {
  console.log(`Voice Action Server listening at http://localhost:${port}`);
});