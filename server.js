const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config({ override: true });

let whatsappSessions = {};

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'whatsapp_config.json');

const DEFAULT_WHATSAPP_TOKEN = 'EAAUM705DgWYBRsNzyISOtZBiXDs0f8AAOMSzVKlyC1YZCXh05mLO3G3seydqhqEB1zeA4WWGtKp4Y7KI6p7m6HMZC57Yr4uezTEbzB2lsSJtNtVg4F4cKF09jqMVgq0tGB5j8fHsKyP7Ox2PcKnbgitIlw41gc0dzuEE9NXMPseo9SOAaeLhDHlR0zmmpnez0pQApBcGuWcfjV8P4bHY2HfnLuZCMLwLZBkOrAHXSYAQT7v5HirN4CLJfyZAZCzkDkvxX4sXynZC5ZBLhIpF5wkxIPmoZD';
const DEFAULT_WHATSAPP_PHONE_ID = '1098869149981369';
const DEFAULT_WHATSAPP_VERIFY_TOKEN = 'quadrobay2025';

function getWhatsAppConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading whatsapp config:', e);
  }
  return {
    token: process.env.WHATSAPP_TOKEN || DEFAULT_WHATSAPP_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_ID || DEFAULT_WHATSAPP_PHONE_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || DEFAULT_WHATSAPP_VERIFY_TOKEN
  };
}

function saveWhatsAppConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing whatsapp config:', e);
    return false;
  }
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/whatsapp/config', (req, res) => {
  res.json(getWhatsAppConfig());
});

app.post('/api/whatsapp/config', (req, res) => {
  const { token, phoneId, verifyToken } = req.body;
  const config = getWhatsAppConfig();
  if (token) config.token = token.trim();
  if (phoneId) config.phoneId = phoneId.trim();
  if (verifyToken) config.verifyToken = verifyToken.trim();
  
  if (saveWhatsAppConfig(config)) {
    res.json({ success: true, message: 'WhatsApp configuration updated successfully!' });
  } else {
    res.status(500).json({ error: 'Failed to save configuration.' });
  }
});

// Oracle SSO verification endpoint
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { oracleUrl, username, password } = req.body;
    
    const targetOracleUrl = oracleUrl || process.env.ORACLE_BASE_URL;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Oracle username and password required' 
      });
    }
    
    if (!targetOracleUrl) {
      return res.status(400).json({ 
        error: 'Oracle URL is not configured on server and must be provided' 
      });
    }
    
    // Clean the URL
    const cleanUrl = targetOracleUrl.replace(/\/$/, '');
    
    console.log('Verifying Oracle credentials for:', username);
    console.log('Oracle URL:', cleanUrl);
    
    // Generate Basic Auth token
    const authToken = Buffer.from(`${username}:${password}`)
      .toString('base64');
    const authHeader = `Basic ${authToken}`;
    
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    
    // Verify by calling Oracle API root catalog (accessible to all authenticated users)
    const response = await axios.get(
      `${cleanUrl}/hcmRestApi/resources/11.13.18.05/`,
      {
        httpsAgent: agent,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    if (response.status === 200 || response.status === 201) {
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
    const testedUrl = err.config?.url || (targetOracleUrl + '/hcmRestApi/resources/11.13.18.05/');
    console.error('Auth verify error status:', err.response?.status);
    console.error('Auth verify error message:', err.message);
    console.error('Tested URL:', testedUrl);
    
    if (err.response?.status === 401) {
      res.status(401).json({ 
        error: `Invalid Oracle username or password (tested URL: ${testedUrl})` 
      });
    } else if (err.response?.status === 403) {
      // 403 Forbidden means credentials are correct, but the user lacks permissions to some catalog components.
      console.log('Oracle credentials verified (403 Forbidden - credentials correct, bypassing permissions check)');
      res.json({
        success: true,
        authToken: authHeader,
        oracleUrl: cleanUrl,
        username: username,
        message: 'Login successful'
      });
    } else if (err.response?.status === 503) {
      res.status(503).json({ 
        error: `Oracle Environment is currently down for scheduled maintenance (tested URL: ${testedUrl})` 
      });
    } else if (err.code === 'ENOTFOUND' || 
               err.code === 'ECONNREFUSED') {
      res.status(400).json({ 
        error: `Cannot connect to Oracle URL. Please check the URL: ${testedUrl}` 
      });
    } else if (err.code === 'ETIMEDOUT') {
      res.status(400).json({ 
        error: `Connection timeout. Please check Oracle URL: ${testedUrl}` 
      });
    } else {
      res.status(500).json({ 
        error: `Verification failed. Please try again. Status: ${err.response?.status || 'Unknown'} (tested URL: ${testedUrl})` 
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
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&expand=workRelationships.assignments.managers`;
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

    // Lookup full Names from LOVs in parallel to keep response ultra fast
    let jobName = assignment?.JobName || assignment?.JobCode || 'Not Assigned';
    let locationName = assignment?.LocationCode || 'Not Assigned';
    let positionName = assignment?.PositionName || assignment?.PositionCode || 'Not Assigned';
    let gradeName = assignment?.GradeName || assignment?.GradeCode || 'Not Assigned';

    const lookupPromises = [];

    if (assignment?.JobId) {
      lookupPromises.push(
        axios.get(`${baseUrl}/hcmRestApi/resources/11.13.18.05/jobs?limit=500&fields=JobId,JobCode,Name&onlyData=true`, {
          httpsAgent: agent,
          headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
        }).then(res => {
          const matched = (res.data.items || []).find(j => Number(j.JobId) === Number(assignment.JobId));
          if (matched) jobName = matched.Name;
        }).catch(err => console.log('Job lookup error:', err.message))
      );
    }

    if (assignment?.LocationId) {
      lookupPromises.push(
        axios.get(`${baseUrl}/hcmRestApi/resources/11.13.18.05/locations?limit=100&fields=LocationId,LocationCode,LocationName&onlyData=true`, {
          httpsAgent: agent,
          headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
        }).then(res => {
          const matched = (res.data.items || []).find(l => Number(l.LocationId) === Number(assignment.LocationId));
          if (matched) locationName = matched.LocationName;
        }).catch(err => console.log('Location lookup error:', err.message))
      );
    }

    if (assignment?.PositionId) {
      lookupPromises.push(
        axios.get(`${baseUrl}/hcmRestApi/resources/11.13.18.05/positions?limit=500&fields=PositionId,PositionCode,Name&onlyData=true`, {
          httpsAgent: agent,
          headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
        }).then(res => {
          const matched = (res.data.items || []).find(p => Number(p.PositionId) === Number(assignment.PositionId));
          if (matched) positionName = matched.Name;
        }).catch(err => console.log('Position lookup error:', err.message))
      );
    }

    if (assignment?.GradeId) {
      lookupPromises.push(
        axios.get(`${baseUrl}/hcmRestApi/resources/11.13.18.05/grades?limit=500&fields=GradeId,GradeCode,GradeName&onlyData=true`, {
          httpsAgent: agent,
          headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
        }).then(res => {
          const matched = (res.data.items || []).find(g => Number(g.GradeId) === Number(assignment.GradeId));
          if (matched) gradeName = matched.GradeName;
        }).catch(err => console.log('Grade lookup error:', err.message))
      );
    }

    if (lookupPromises.length > 0) {
      await Promise.all(lookupPromises);
    }

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
      LocationName: locationName,
      JobId: assignment?.JobId || null,
      JobName: jobName,
      PositionId: assignment?.PositionId || null,
      PositionName: positionName,
      GradeId: assignment?.GradeId || null,
      GradeName: gradeName,
      LegalEmployerName: workRel?.LegalEmployerName || workRel?.LegalEntityName || 'Not Assigned',
      UserPersonType: assignment?.UserPersonType || 'Employee',
      AssignmentStatusType: assignment?.AssignmentStatusType || 'ACTIVE',
      StartDate: workRel?.StartDate || assignment?.EffectiveStartDate || 'Not Assigned',
      NormalHours: assignment?.NormalHours ? `${assignment.NormalHours} ${assignment.Frequency === 'W' ? 'Hours/Week' : assignment.Frequency || ''}`.trim() : 'Not Assigned',
      ActionCode: assignment?.ActionCode || 'Not Assigned',
      CreationDate: worker.CreationDate ? new Date(worker.CreationDate).toLocaleDateString() : 'Not Assigned',
      LastUpdateDate: worker.LastUpdateDate ? new Date(worker.LastUpdateDate).toLocaleDateString() : 'Not Assigned'
    });
  } catch (error) {
    console.error('Oracle Worker Error:', error.response?.data || error.message);
    if (error.response?.status === 503) {
      res.status(503).json({ error: 'The Oracle environment is currently down for maintenance.' });
    } else {
      res.status(500).json({ error: 'Failed to fetch worker details' });
    }
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
    const url = `${oracleBaseUrl || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com'}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${manager_person_number}&expand=workRelationships.assignments`;
    
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
    let activeUsername = 'your active account';
    if (oracleAuth && oracleAuth.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(oracleAuth.substring(6), 'base64').toString('utf8');
        activeUsername = decoded.split(':')[0];
      } catch (e) {}
    }
    res.status(err.response?.status || 500).json({ 
      error: (err.response?.status === 403) ? `Oracle HCM Access Forbidden (403): The active Oracle account ('${activeUsername}') does not have sufficient security roles/privileges to write to the supervisor/managers child resource. Please ensure the user has supervisor/manager write privileges (e.g. 'Use REST Service - Workers') in the Oracle Security Console, or provide a more privileged administrative account.` : (err.response?.data?.detail || err.response?.data?.title || err.message) 
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
      "DepartmentId": Number(DepartmentId),
      "OrganizationId": Number(DepartmentId)
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

app.get('/api/oracle/positions', async (req, res) => {
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
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/positions?limit=500&fields=PositionId,PositionCode,Name&onlyData=true`;

    console.log('Fetching positions from Oracle...');

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    console.log('Positions count:', response.data.count);

    const positions = (response.data.items || [])
      .filter(p => p.Name)
      .map(p => ({
        PositionId: p.PositionId,
        PositionCode: p.PositionCode,
        Name: p.Name
      }));

    res.json({ positions });

  } catch (err) {
    console.error('Positions error:', err.response?.status);
    console.error('Positions error data:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/oracle/position', async (req, res) => {
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
      PositionId,
      PositionName,
      EffectiveDate
    } = req.body;

    const effectiveDate = EffectiveDate || '2025-05-01';

    console.log('=== CHANGE POSITION REQUEST ===');
    console.log('PositionId:', PositionId);
    console.log('PositionName:', PositionName);
    console.log('EffectiveDate:', effectiveDate);

    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;

    console.log('PATCH URL:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const body = {
      "ActionCode": "ASG_CHANGE",
      "PositionId": Number(PositionId)
    };

    console.log('Request body:', JSON.stringify(body));

    console.log('Attempting UPDATE mode for Position...');
    try {
      const response = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });

      console.log('UPDATE mode success for Position:', response.status);
      res.json({
        success: true,
        message: `Position changed to ${PositionName} successfully (UPDATE mode)`
      });
    } catch (updateErr) {
      console.log('UPDATE mode failed for Position, trying CORRECTION mode...');
      console.log('Update Position Error Details:', JSON.stringify(updateErr.response?.data || updateErr.message));

      const corrResponse = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': 'RangeMode=CORRECTION'
        }
      });

      console.log('CORRECTION mode success for Position:', corrResponse.status);
      res.json({
        success: true,
        message: `Position changed to ${PositionName} successfully (CORRECTION mode)`
      });
    }

  } catch (err) {
    console.error('Position change error:', err.response?.status);
    console.error('Position error data:', JSON.stringify(err.response?.data));
    res.status(500).json({
      error: err.response?.data?.detail ||
             err.response?.data?.title ||
             JSON.stringify(err.response?.data) ||
             err.message
    });
  }
});

app.get('/api/oracle/grades', async (req, res) => {
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
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/grades?limit=500&fields=GradeId,GradeCode,GradeName&onlyData=true`;

    console.log('Fetching grades from Oracle...');

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    console.log('Grades count:', response.data.count);

    const grades = (response.data.items || [])
      .filter(g => g.GradeName)
      .map(g => ({
        GradeId: g.GradeId,
        GradeCode: g.GradeCode,
        Name: g.GradeName
      }));

    res.json({ grades });

  } catch (err) {
    console.error('Grades error:', err.response?.status);
    console.error('Grades error data:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/oracle/grade', async (req, res) => {
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
      GradeId,
      GradeName,
      EffectiveDate
    } = req.body;

    const effectiveDate = EffectiveDate || '2025-05-01';

    console.log('=== CHANGE GRADE REQUEST ===');
    console.log('GradeId:', GradeId);
    console.log('GradeName:', GradeName);
    console.log('EffectiveDate:', effectiveDate);

    const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;

    console.log('PATCH URL:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const body = {
      "ActionCode": "ASG_CHANGE",
      "GradeId": Number(GradeId)
    };

    console.log('Request body:', JSON.stringify(body));

    console.log('Attempting UPDATE mode for Grade...');
    try {
      const response = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });

      console.log('UPDATE mode success for Grade:', response.status);
      res.json({
        success: true,
        message: `Grade changed to ${GradeName} successfully (UPDATE mode)`
      });
    } catch (updateErr) {
      console.log('UPDATE mode failed for Grade, trying CORRECTION mode...');
      console.log('Update Grade Error Details:', JSON.stringify(updateErr.response?.data || updateErr.message));

      const corrResponse = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': 'RangeMode=CORRECTION'
        }
      });

      console.log('CORRECTION mode success for Grade:', corrResponse.status);
      res.json({
        success: true,
        message: `Grade changed to ${GradeName} successfully (CORRECTION mode)`
      });
    }

  } catch (err) {
    console.error('Grade change error:', err.response?.status);
    console.error('Grade error data:', JSON.stringify(err.response?.data));
    res.status(500).json({
      error: err.response?.data?.detail ||
             err.response?.data?.title ||
             JSON.stringify(err.response?.data) ||
             err.message
    });
  }
});

// ─── CHANGE BUSINESS UNIT ─────────────────────────────
app.patch('/api/oracle/businessunit', async (req, res) => {
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
      BusinessUnitId,
      BusinessUnitName,
      EffectiveDate
    } = req.body;

    console.log(`[${new Date().toISOString()}] PATCH Business Unit Request Received`);
    
    const effectiveDate = EffectiveDate || '2025-05-01';

    let url = assignmentSelfLink;
    if (!url) {
      const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL).replace(/\/$/, '');
      url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;
    }

    console.log('PATCH URL:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const body = {
      "ActionCode": "ASG_CHANGE",
      "BusinessUnitId": Number(BusinessUnitId)
    };

    console.log('Request body:', JSON.stringify(body));

    console.log('Attempting UPDATE mode for Business Unit...');
    try {
      const response = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });

      console.log('UPDATE mode success for Business Unit:', response.status);
      res.json({
        success: true,
        message: `Business Unit changed to ${BusinessUnitName} successfully (UPDATE mode)`
      });
    } catch (updateErr) {
      console.log('UPDATE mode failed for Business Unit, trying CORRECTION mode...');
      console.log('Update Business Unit Error Details:', JSON.stringify(updateErr.response?.data || updateErr.message));

      const corrResponse = await axios.patch(url, body, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': oracleAuth,
          'Effective-Of': 'RangeMode=CORRECTION'
        }
      });

      console.log('CORRECTION mode success for Business Unit:', corrResponse.status);
      res.json({
        success: true,
        message: `Business Unit changed to ${BusinessUnitName} successfully (CORRECTION mode)`
      });
    }

  } catch (err) {
    console.error('Business Unit change error:', err.response?.status);
    console.error('Business Unit error data:', JSON.stringify(err.response?.data));
    res.status(500).json({
      error: err.response?.data?.detail ||
             err.response?.data?.title ||
             JSON.stringify(err.response?.data) ||
             err.message
    });
  }
});

app.post('/api/oracle/hire', async (req, res) => {
  try {
    const {
      PersonNumber,
      FirstName,
      LastName,
      DateOfBirth,
      LegalEmployerName,
      StartDate,
      BusinessUnitName,
      JobCode,
      LocationCode
    } = req.body;

    let oracleAuth = req.headers['x-oracle-auth'];
    if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
      oracleAuth = process.env.ORACLE_AUTH;
    }
    let oracleBaseUrl = req.headers['x-oracle-url'];
    if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
      oracleBaseUrl = process.env.ORACLE_BASE_URL;
    }

    console.log('=== HIRE EMPLOYEE REQUEST ===');
    console.log('PersonNumber:', PersonNumber);
    console.log('Name:', FirstName, LastName);
    console.log('StartDate:', StartDate);
    console.log('LegalEmployer:', LegalEmployerName);
    console.log('BusinessUnit:', BusinessUnitName);
    console.log('JobCode:', JobCode);
    console.log('LocationCode:', LocationCode);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const today = StartDate || 
      new Date().toISOString().split('T')[0];

    const url = `${oracleBaseUrl}/hcmRestApi/resources/latest/workers`;

    const body = {
      "PersonNumber": PersonNumber,
      "names": [
        {
          "LegislationCode": "US",
          "FirstName": FirstName,
          "LastName": LastName
        }
      ],
      "DateOfBirth": DateOfBirth || null,
      "workRelationships": [
        {
          "LegalEmployerName": LegalEmployerName,
          "WorkerType": "E",
          "PrimaryFlag": true,
          "StartDate": today,
          "assignments": [
            {
              "ActionCode": "HIRE",
              "BusinessUnitName": BusinessUnitName,
              "AssignmentStatusTypeCode": "ACTIVE_PROCESS",
              "JobCode": JobCode || null,
              "LocationCode": LocationCode || null
            }
          ]
        }
      ]
    };

    console.log('Hire body:', JSON.stringify(body, null, 2));

    const response = await axios.post(url, body, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': oracleAuth,
        'Effective-Of': `RangeStartDate=${today};RangeEndDate=4712-12-31`
      }
    });

    console.log('Hire success:', response.status);
    console.log('Hire response:', JSON.stringify(response.data));

    res.json({
      success: true,
      message: `Employee ${FirstName} ${LastName} hired successfully!`,
      PersonNumber: response.data.PersonNumber,
      data: response.data
    });

  } catch (err) {
    console.error('Hire error status:', err.response?.status);
    console.error('Hire error:', JSON.stringify(err.response?.data));
    res.status(500).json({
      error: err.response?.data?.detail ||
             err.response?.data?.title ||
             JSON.stringify(err.response?.data) ||
             err.message
    });
  }
});

app.get('/api/oracle/legalemployers', async (req, res) => {
  try {
    let oracleAuth = req.headers['x-oracle-auth'];
    if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
      oracleAuth = process.env.ORACLE_AUTH;
    }
    let oracleBaseUrl = req.headers['x-oracle-url'];
    if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
      oracleBaseUrl = process.env.ORACLE_BASE_URL;
    }

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const baseUrl = oracleBaseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/legalEmployersLov?limit=500&fields=OrganizationId,Name&onlyData=true`;

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    const employers = response.data.items.map(e => ({
      LegalEntityId: e.OrganizationId,
      Name: e.Name
    }));

    res.json({ employers });

  } catch (err) {
    console.error('Legal employers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/oracle/businessunits', async (req, res) => {
  try {
    let oracleAuth = req.headers['x-oracle-auth'];
    if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
      oracleAuth = process.env.ORACLE_AUTH;
    }
    let oracleBaseUrl = req.headers['x-oracle-url'];
    if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
      oracleBaseUrl = process.env.ORACLE_BASE_URL;
    }

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const baseUrl = oracleBaseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/hcmBusinessUnitsLOV?limit=500&fields=BusinessUnitId,Name&onlyData=true`;

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    const units = response.data.items.map(u => ({
      BusinessUnitId: u.BusinessUnitId,
      BusinessUnitName: u.Name
    }));

    res.json({ units });

  } catch (err) {
    console.error('Business units error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET PO BY ORDER NUMBER ───────────────────────────
app.get('/api/oracle/po/details', async (req, res) => {
  try {
    const { orderNumber } = req.query;
    
    // Always use system auth for viewing POs to avoid 403s for regular users
    const oracleAuth = process.env.ORACLE_AUTH;
    let oracleBaseUrl = req.headers['x-oracle-url'];
    if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
      oracleBaseUrl = process.env.ORACLE_BASE_URL;
    }

    console.log('=== GET PO DETAILS ===');
    console.log('Order Number:', orderNumber);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const url = `${oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=OrderNumber%3D%27${orderNumber}%27&fields=OrderNumber,Status,Total,Supplier,CreationDate,CurrencyCode,ProcurementBU,POHeaderId,StatusCode`;

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.items?.length) {
      return res.status(404).json({
        error: `PO Number ${orderNumber} not found`
      });
    }

    const po = response.data.items[0];
    res.json({
      POHeaderId: po.POHeaderId,
      OrderNumber: po.OrderNumber,
      Status: po.Status,
      StatusCode: po.StatusCode,
      Total: po.Total,
      CurrencyCode: po.CurrencyCode,
      Supplier: po.Supplier,
      CreationDate: po.CreationDate,
      ProcurementBU: po.ProcurementBU,
      canApprove: po.StatusCode === 'OPEN' || 
                  po.StatusCode === 'PENDING_APPROVAL'
    });

  } catch (err) {
    console.error('PO details error:', err.response?.status);
    console.error('PO details error data:', 
      JSON.stringify(err.response?.data));
    res.status(500).json({
      error: err.response?.data?.detail || err.message
    });
  }
});

// ─── GET ALL OPEN POs ─────────────────────────────────
app.get('/api/oracle/po/list', async (req, res) => {
  try {
    // Always use system auth for viewing POs to avoid 403s for regular users
    const oracleAuth = process.env.ORACLE_AUTH;
    let oracleBaseUrl = req.headers['x-oracle-url'];
    if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
      oracleBaseUrl = process.env.ORACLE_BASE_URL;
    }

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const url = `${oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=StatusCode%3D%27OPEN%27&limit=20&fields=OrderNumber,Status,Total,Supplier,CurrencyCode,POHeaderId,StatusCode,CreationDate`;

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': oracleAuth,
        'Content-Type': 'application/json'
      }
    });

    const pos = response.data.items.map(po => ({
      POHeaderId: po.POHeaderId,
      OrderNumber: po.OrderNumber,
      Status: po.Status,
      StatusCode: po.StatusCode,
      Total: po.Total,
      CurrencyCode: po.CurrencyCode,
      Supplier: po.Supplier,
      CreationDate: po.CreationDate
    }));

    res.json({ purchaseOrders: pos, count: pos.length });

  } catch (err) {
    console.error('PO list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── SUBMIT/APPROVE PO ────────────────────────────────
app.post('/api/oracle/po/approve', async (req, res) => {
  try {
    const { POHeaderId, OrderNumber, comments } = req.body;
    let oracleAuth = req.headers['x-oracle-auth'];
    if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {
      oracleAuth = process.env.ORACLE_AUTH;
    }
    let oracleBaseUrl = req.headers['x-oracle-url'];
    if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {
      oracleBaseUrl = process.env.ORACLE_BASE_URL;
    }

    console.log('=== APPROVE PO ===');
    console.log('POHeaderId:', POHeaderId);
    console.log('OrderNumber:', OrderNumber);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const url = `${oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders/${POHeaderId}/action/submit`;

    const response = await axios.post(url,
      { comments: comments || 'Approved via Voice Assistant' },
      {
        httpsAgent: agent,
        headers: {
          'Authorization': oracleAuth,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('PO approve success:', response.status);
    res.json({
      success: true,
      message: `PO ${OrderNumber} approved successfully!`
    });

  } catch (err) {
    console.error('PO approve error:', err.response?.status);
    console.error('PO approve data:', 
      JSON.stringify(err.response?.data));

    if (err.response?.status === 403) {
      res.status(403).json({
        error: 'You do not have permission to approve this PO. ' +
               'Please contact your Oracle administrator.'
      });
    } else {
      res.status(500).json({
        error: err.response?.data?.detail || err.message
      });
    }
  }
});

// ─── WHATSAPP WEBHOOK VERIFICATION ───────────────────
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const config = getWhatsAppConfig();

  if (mode === 'subscribe' && 
      token === config.verifyToken) {
    console.log('WhatsApp webhook verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─── WHATSAPP RECEIVE MESSAGES ────────────────────────
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    const body = req.body;
    
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];
      
      if (!message) return res.sendStatus(200);
      
      const from = message.from;
      const type = message.type;
      
      console.log('WhatsApp message from:', from);
      console.log('Message type:', type);
      
      if (type === 'text') {
        const text = message.text.body;
        console.log('Text message:', text);
        await handleWhatsAppText(from, text);
        
      } else if (type === 'audio') {
        const audioId = message.audio.id;
        console.log('Voice note received, id:', audioId);
        await handleWhatsAppVoice(from, audioId);
        
      } else {
        await sendWhatsAppMessage(from, 
          'Please send a text message or voice note.');
      }
    }
    
    res.sendStatus(200);
    
  } catch (err) {
    console.error('WhatsApp webhook error:', err.message);
    res.sendStatus(500);
  }
});

// ─── HANDLE TEXT MESSAGE ─────────────────────────────
async function handleWhatsAppText(from, text) {
  try {
    const lower = text.toLowerCase().trim();
    
    // Help message
    if (lower === 'hi' || lower === 'hello' || 
        lower === 'help' || lower === 'start') {
      await sendWhatsAppMessage(from,
        `👋 Welcome to Oracle HCM Voice Assistant!\n\n` +
        `Available commands:\n\n` +
        `1️⃣ **Assign Manager:**\n` +
        `"assign manager [manager_number] for employee [employee_number]"\n` +
        `Example: assign manager 4585 for employee 1405\n\n` +
        `2️⃣ **Change Department:**\n` +
        `"change department for employee [number] to [dept_name]"\n` +
        `Example: change department for employee 1405 to Consulting East US\n\n` +
        `3️⃣ **Change Location:**\n` +
        `"change location for employee [number] to [location_name]"\n` +
        `Example: change location for employee 1405 to London\n\n` +
        `4️⃣ **Change Job:**\n` +
        `"change job for employee [number] to [job_name]"\n` +
        `Example: change job for employee 1405 to Consultant\n\n` +
        `5️⃣ **Change Position:**\n` +
        `"change position for employee [number] to [position_name]"\n` +
        `Example: change position for employee 1405 to Senior Consultant\n\n` +
        `6️⃣ **Change Grade:**\n` +
        `"change grade for employee [number] to [grade_name]"\n` +
        `Example: change grade for employee 1405 to Grade 4\n\n` +
        `7️⃣ **Hire Employee:**\n` +
        `"hire employee [FirstName] [LastName] with person [PersonNumber], legal employer [EmployerName], business unit [BU_Name], job [JobCode], location [LocationCode]"\n` +
        `Example: hire employee John Doe with person 9988, legal employer US1 Legal Entity, business unit US1 Business Unit, job JOB018, location US East\n\n` +
        `*Procurement Commands:*\n` +
        `📦 **PO Status:** "PO status US164932"\n` +
        `📋 **Open POs:** "Show open purchase orders"\n` +
        `✅ **Approve PO:** "approve US164932"\n\n` +
        `Or send a voice note in English! 🎙️`
      );
      return;
    }
    
    // Extract all numbers from message
    const numbers = text.match(/\d{1,6}/g) || [];
    
    // HIRE EMPLOYEE
    if (lower.includes('hire') && lower.includes('employee')) {
      const nameMatch = text.match(/hire\s+employee\s+([A-Za-z]+)\s+([A-Za-z]+)/i);
      const firstName = nameMatch ? nameMatch[1] : null;
      const lastName = nameMatch ? nameMatch[2] : null;

      const personMatch = text.match(/(?:person|number|no|id)\s*(\d{1,6})/i);
      const personNumber = personMatch ? personMatch[1] : (numbers.length > 0 ? numbers[0] : null);

      const legalMatch = text.match(/(?:legal\s*employer|employer)\s*([^,;]+)/i);
      const legalEmployerName = legalMatch ? legalMatch[1].trim() : null;

      const buMatch = text.match(/(?:business\s*unit|bu)\s*([^,;]+)/i);
      const businessUnitName = buMatch ? buMatch[1].trim() : null;

      const jobMatch = text.match(/(?:job|job\s*code)\s*([^,;]+)/i);
      const jobCode = jobMatch ? jobMatch[1].trim() : null;

      const locMatch = text.match(/(?:location|loc)\s*([^,;]+)/i);
      const locationCode = locMatch ? locMatch[1].trim() : null;

      if (firstName && lastName && personNumber && legalEmployerName && businessUnitName) {
        await sendWhatsAppMessage(from,
          `⏳ Processing...\n` +
          `Hiring new employee ${firstName} ${lastName} (Person: ${personNumber}) under Business Unit: ${businessUnitName}...`
        );
        await processHireEmployee(from, {
          PersonNumber: personNumber,
          FirstName: firstName,
          LastName: lastName,
          LegalEmployerName: legalEmployerName,
          BusinessUnitName: businessUnitName,
          JobCode: jobCode,
          LocationCode: locationCode
        });
      } else {
        let missing = [];
        if (!firstName || !lastName) missing.push("Employee First/Last Name");
        if (!personNumber) missing.push("Person Number");
        if (!legalEmployerName) missing.push("Legal Employer Name");
        if (!businessUnitName) missing.push("Business Unit Name");

        await sendWhatsAppMessage(from,
          `❌ Missing details for hiring: ${missing.join(', ')}.\n\n` +
          `Please use the format:\n` +
          `"hire employee [FirstName] [LastName] with person [PersonNumber], legal employer [EmployerName], business unit [BU_Name], job [JobCode], location [LocationCode]"\n\n` +
          `Example:\n` +
          `hire employee John Doe with person 9988, legal employer US1 Legal Entity, business unit US1 Business Unit, job JOB018, location US East`
        );
      }
      
    // GET EMPLOYEE DETAILS
    } else if ((lower.includes('detail') || lower.includes('profile') || lower.includes('info') || lower.includes('show')) && !lower.includes('po') && !lower.includes('purchase order') && !lower.includes('order status')) {
      const personMatch = text.match(/(?:person|employee|number|no|id)\s*(\d{1,6})/i);
      const personNumber = personMatch ? personMatch[1] : (numbers.length > 0 ? numbers[0] : null);
      
      if (personNumber) {
        await sendWhatsAppMessage(from, `⏳ Retrieving details for employee number *${personNumber}*...`);
        await processGetEmployeeDetails(from, personNumber);
      } else {
        await sendWhatsAppMessage(from, 
          `🔍 *Retrieve Employee Details*:\n\n` +
          `Please provide a valid person number.\n` +
          `Example: "give person number 1406 details" or "show details for employee 1406"`
        );
      }
      
    // ASSIGN MANAGER
    } else if (lower.includes('assign') && lower.includes('manager')) {
      if (numbers.length >= 2) {
        const employeeNum = numbers[numbers.length - 1];
        const managerNum = numbers[0];
        
        await sendWhatsAppMessage(from,
          `⏳ Processing...\n` +
          `Assigning manager ${managerNum} for employee ${employeeNum}`
        );
        
        await processAssignManager(from, employeeNum, managerNum);
        
      } else if (numbers.length === 1) {
        await sendWhatsAppMessage(from,
          `Found employee number: ${numbers[0]}\n` +
          `Please provide manager number too.\n` +
          `Example: assign manager 4585 for employee 1405`
        );
      } else {
        await sendWhatsAppMessage(from,
          `Please provide employee and manager numbers.\n` +
          `Example: assign manager 4585 for employee 1405`
        );
      }
      
    // CHANGE DEPARTMENT
    } else if (lower.includes('department') || lower.includes('dept')) {
      if (numbers.length >= 1) {
        const employeeNum = numbers[0];
        const toIndex = lower.indexOf(' to ');
        const deptName = toIndex > -1 ? text.substring(toIndex + 4).trim() : null;
        
        if (deptName) {
          await sendWhatsAppMessage(from,
            `⏳ Processing...\n` +
            `Changing department for employee ${employeeNum} to ${deptName}`
          );
          await processChangeDepartment(from, employeeNum, deptName);
        } else {
          await sendWhatsAppMessage(from,
            `Please specify the department name.\n` +
            `Example: change department for employee 1405 to Consulting East US`
          );
        }
      } else {
        await sendWhatsAppMessage(from,
          `Please provide employee number.\n` +
          `Example: change department for employee 1405 to Consulting East US`
        );
      }
      
    // CHANGE LOCATION
    } else if (lower.includes('location') || lower.includes('loc')) {
      if (numbers.length >= 1) {
        const employeeNum = numbers[0];
        const toIndex = lower.indexOf(' to ');
        const locName = toIndex > -1 ? text.substring(toIndex + 4).trim() : null;
        
        if (locName) {
          await sendWhatsAppMessage(from,
            `⏳ Processing...\n` +
            `Changing location for employee ${employeeNum} to ${locName}`
          );
          await processChangeLocation(from, employeeNum, locName);
        } else {
          await sendWhatsAppMessage(from,
            `Please specify the location name.\n` +
            `Example: change location for employee 1405 to London`
          );
        }
      } else {
        await sendWhatsAppMessage(from,
          `Please provide employee number.\n` +
          `Example: change location for employee 1405 to London`
        );
      }
      
    // CHANGE JOB
    } else if (lower.includes('job')) {
      if (numbers.length >= 1) {
        const employeeNum = numbers[0];
        const toIndex = lower.indexOf(' to ');
        const jobName = toIndex > -1 ? text.substring(toIndex + 4).trim() : null;
        
        if (jobName) {
          await sendWhatsAppMessage(from,
            `⏳ Processing...\n` +
            `Changing job for employee ${employeeNum} to ${jobName}`
          );
          await processChangeJob(from, employeeNum, jobName);
        } else {
          await sendWhatsAppMessage(from,
            `Please specify the job name.\n` +
            `Example: change job for employee 1405 to Consultant`
          );
        }
      } else {
        await sendWhatsAppMessage(from,
          `Please provide employee number.\n` +
          `Example: change job for employee 1405 to Consultant`
        );
      }
      
    // CHANGE POSITION
    } else if (lower.includes('position') || lower.includes('pos')) {
      if (numbers.length >= 1) {
        const employeeNum = numbers[0];
        const toIndex = lower.indexOf(' to ');
        const posName = toIndex > -1 ? text.substring(toIndex + 4).trim() : null;
        
        if (posName) {
          await sendWhatsAppMessage(from,
            `⏳ Processing...\n` +
            `Changing position for employee ${employeeNum} to ${posName}`
          );
          await processChangePosition(from, employeeNum, posName);
        } else {
          await sendWhatsAppMessage(from,
            `Please specify the position name.\n` +
            `Example: change position for employee 1405 to Senior Consultant`
          );
        }
      } else {
        await sendWhatsAppMessage(from,
          `Please provide employee number.\n` +
          `Example: change position for employee 1405 to Senior Consultant`
        );
      }
      
    // CHANGE GRADE
    } else if (lower.includes('grade')) {
      if (numbers.length >= 1) {
        const employeeNum = numbers[0];
        const toIndex = lower.indexOf(' to ');
        const gradeName = toIndex > -1 ? text.substring(toIndex + 4).trim() : null;
        
        if (gradeName) {
          await sendWhatsAppMessage(from,
            `⏳ Processing...\n` +
            `Changing grade for employee ${employeeNum} to ${gradeName}`
          );
          await processChangeGrade(from, employeeNum, gradeName);
        } else {
          await sendWhatsAppMessage(from,
            `Please specify the grade name.\n` +
            `Example: change grade for employee 1405 to Grade 4`
          );
        }
      } else {
        await sendWhatsAppMessage(from,
          `Please provide employee number.\n` +
          `Example: change grade for employee 1405 to Grade 4`
        );
      }
      
    // CHANGE BUSINESS UNIT
    } else if (lower.includes('business unit') || lower.includes('bu ')) {
      if (numbers.length >= 1) {
        const employeeNum = numbers[0];
        const toIndex = lower.indexOf(' to ');
        const buName = toIndex > -1 ? text.substring(toIndex + 4).trim() : null;
        
        if (buName) {
          await sendWhatsAppMessage(from,
            `⏳ Processing...\n` +
            `Changing business unit for employee ${employeeNum} to ${buName}`
          );
          await processChangeBusinessUnit(from, employeeNum, buName);
        } else {
          await sendWhatsAppMessage(from,
            `Please specify the business unit name.\n` +
            `Example: change business unit for employee 1405 to US1 Business Unit`
          );
        }
      } else {
        await sendWhatsAppMessage(from,
          `Please provide employee number.\n` +
          `Example: change business unit for employee 1405 to US1 Business Unit`
        );
      }
      
    // APPROVE PO
    } else if (lower.includes('approve')) {
      const poMatch = text.match(/[A-Z]{2}\d{5,6}/i) || text.match(/\b\d{5,6}\b/);
      let poNumber = poMatch ? poMatch[0].replace(/[-\s]/g, '').toUpperCase() : null;

      const session = whatsappSessions?.[from];
      const poData = session?.pendingPO;

      if (!poNumber && poData) {
        poNumber = poData.OrderNumber;
      }

      if (poNumber) {
        await sendWhatsAppMessage(from, `⏳ Processing approval for PO ${poNumber}...`);

        try {
          const https = require('https');
          const agent = new https.Agent({ rejectUnauthorized: false });
          const oracleBaseUrl = process.env.ORACLE_BASE_URL;
          const oracleAuth = process.env.ORACLE_AUTH;

          let poHeaderId = poData?.OrderNumber === poNumber ? poData.POHeaderId : null;
          let statusCode = poData?.OrderNumber === poNumber ? poData.StatusCode : null;

          // If we don't have the POHeaderId or StatusCode in session, look it up first!
          if (!poHeaderId || !statusCode) {
            console.log(`PO details not in session for PO ${poNumber}. Looking up from Oracle...`);
            const lookupUrl = `${oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=OrderNumber%3D%27${poNumber}%27&fields=POHeaderId,StatusCode`;
            const lookupRes = await axios.get(lookupUrl, {
              httpsAgent: agent,
              headers: { 'Authorization': oracleAuth }
            });
            const poItem = lookupRes.data.items?.[0];
            if (!poItem) {
              await sendWhatsAppMessage(from, `❌ PO Number ${poNumber} not found in Oracle.`);
              return;
            }
            poHeaderId = poItem.POHeaderId;
            statusCode = poItem.StatusCode;
          }

          // Check if PO is already approved!
          if (statusCode === 'OPEN') {
            await sendWhatsAppMessage(from, `✅ PO ${poNumber} is already approved and active.`);
            return;
          }

          // Submit the approval action
          await axios.post(
            `${oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders/${poHeaderId}/action/submit`,
            { comments: 'Approved via WhatsApp Voice Assistant' },
            {
              httpsAgent: agent,
              headers: {
                'Authorization': oracleAuth,
                'Content-Type': 'application/json'
              }
            }
          );

          await sendWhatsAppMessage(from, `✅ PO ${poNumber} approved successfully in Oracle Fusion!`);
          if (whatsappSessions[from]) {
            delete whatsappSessions[from];
          }
        } catch (err) {
          console.error('WhatsApp PO approval error:', err.message);
          if (err.response) {
            console.error('Response data:', err.response.data);
          }
          if (err.response?.status === 403) {
            await sendWhatsAppMessage(from,
              `❌ You don't have permission to approve PO ${poNumber}.\n` +
              `Please contact your Oracle administrator.`
            );
          } else {
            await sendWhatsAppMessage(from, `❌ Failed to approve PO ${poNumber}. Please try again.`);
          }
        }
      } else {
        await sendWhatsAppMessage(from,
          `Please specify which PO to approve.\n` +
          `Example: "approve US165121"`
        );
      }

    // PO COMMANDS
    } else if (lower.includes('po') || lower.includes('purchase order') || lower.includes('order status') || /[a-z]{2}\d{5,6}/i.test(lower) || /po[-\s]?\d+/i.test(lower) || /\b\d{5,6}\b/.test(lower)) {
      const poMatch = text.match(/[A-Z]{2}\d{5,6}/i) || text.match(/\b\d{5,6}\b/);
      const poNumber = poMatch ? poMatch[0].replace(/[-\s]/g, '').toUpperCase() : null;

      if (poNumber) {
        await sendWhatsAppMessage(from, `🔍 Looking up PO: ${poNumber}...`);
        await handleWhatsAppPO(from, poNumber);
      } else if (lower.includes('list') || lower.includes('pending') || lower.includes('open') || lower.includes('incomplete') || lower.includes('draft')) {
        let status = 'OPEN';
        let statusLabel = 'Open';

        if (lower.includes('pending') || lower.includes('approval')) {
          status = 'PENDING_APPROVAL';
          statusLabel = 'Pending Approval';
        } else if (lower.includes('incomplete') || lower.includes('draft')) {
          status = 'INCOMPLETE';
          statusLabel = 'Incomplete';
        }

        await sendWhatsAppMessage(from, `📋 Fetching ${statusLabel.toLowerCase()} purchase orders...`);
        await handleWhatsAppPOList(from, status, statusLabel);
      } else {
        await sendWhatsAppMessage(from,
          `Please provide a PO number.\n` +
          `Example: "PO status US164932"\n` +
          `Or: "Show open purchase orders"`
        );
      }

    // UNKNOWN COMMAND  
    } else {
      await sendWhatsAppMessage(from,
        `❓ I didn't understand that.\n\n` +
        `Send "help" to see available commands\n` +
        `Or send a voice note in English 🎙️`
      );
    }
    
  } catch (err) {
    console.error('Handle text error:', err.message);
    await sendWhatsAppMessage(from, 
      '❌ Something went wrong. Please try again.');
  }
}

// ─── HANDLE VOICE NOTE ───────────────────────────────
async function handleWhatsAppVoice(from, audioId) {
  try {
    const config = getWhatsAppConfig();
    await sendWhatsAppMessage(from, 
      '🎙️ Voice note received! Transcribing...');
    
    // Step 1: Get audio URL from Meta
    const mediaRes = await axios.get(
      `https://graph.facebook.com/v18.0/${audioId}`,
      { headers: { 
        'Authorization': `Bearer ${config.token}` 
      }}
    );
    
    const audioUrl = mediaRes.data.url;
    console.log('Audio URL:', audioUrl);
    
    // Step 2: Download audio
    const audioRes = await axios.get(audioUrl, {
      headers: { 
        'Authorization': `Bearer ${config.token}` 
      },
      responseType: 'arraybuffer'
    });
    
    console.log('Audio downloaded, size:', audioRes.data.byteLength);
    
    // Step 3: Send to Sarvam AI for transcription
    const formData = new FormData();
    formData.append('file', Buffer.from(audioRes.data), {
      filename: 'audio.ogg',
      contentType: 'audio/ogg'
    });
    formData.append('model', 'saaras:v3');
    formData.append('mode', 'transcribe');
    formData.append('language_code', 'en-IN');
    
    const sarvamRes = await axios.post(
      'https://api.sarvam.ai/speech-to-text',
      formData,
      { headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY,
        ...formData.getHeaders()
      }}
    );
    
    const transcript = sarvamRes.data.transcript;
    console.log('Transcript:', transcript);
    
    await sendWhatsAppMessage(from,
      `✅ I heard: "${transcript}"\n\nProcessing...`
    );
    
    // Step 4: Process the transcript as text
    await handleWhatsAppText(from, transcript);
    
  } catch (err) {
    console.error('Voice handling error:', err.message);
    await sendWhatsAppMessage(from,
      '❌ Could not process voice note.\n' +
      'Please try sending a text message instead.'
    );
  }
}

// ─── WHATSAPP PO HANDLERS ─────────────────────────────
async function handleWhatsAppPO(from, poNumber) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const oracleBaseUrl = process.env.ORACLE_BASE_URL;
    const oracleAuth = process.env.ORACLE_AUTH;

    const url = `${oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=OrderNumber%3D%27${poNumber}%27&fields=OrderNumber,Status,Total,Supplier,CreationDate,CurrencyCode,POHeaderId,StatusCode`;

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: { 'Authorization': oracleAuth }
    });

    if (!response.data.items?.length) {
      await sendWhatsAppMessage(from, `❌ PO Number ${poNumber} not found in Oracle.`);
      return;
    }

    const po = response.data.items[0];
    const canApprove = po.StatusCode === 'PENDING_APPROVAL' || po.StatusCode === 'INCOMPLETE';

    await sendWhatsAppMessage(from,
      `📄 *Purchase Order Details*\n\n` +
      `PO Number: ${po.OrderNumber}\n` +
      `Status: ${po.Status}\n` +
      `Supplier: ${po.Supplier || 'N/A'}\n` +
      `Total: ${po.CurrencyCode} ${po.Total || '0'}\n` +
      `Created: ${po.CreationDate?.split('T')[0] || 'N/A'}\n` +
      `Business Unit: ${po.ProcurementBU || 'N/A'}\n\n` +
      `${po.StatusCode === 'OPEN' ? 
        '✅ This PO is already approved and active.' 
        : canApprove ? 
        '⚠️ This PO is pending approval.\n' +
        'Reply: *approve ' + po.OrderNumber + '* to approve it.' 
        : 
        '✅ No action required.'}`
    );

    // Store PO for approval
    if (canApprove) {
      whatsappSessions[from] = {
        pendingPO: {
          POHeaderId: po.POHeaderId,
          OrderNumber: po.OrderNumber
        }
      };
    }

  } catch (err) {
    console.error('WhatsApp PO error:', err.message);
    await sendWhatsAppMessage(from, '❌ Error fetching PO details. Please try again.');
  }
}

async function handleWhatsAppPOList(from, status = 'OPEN', statusLabel = 'Open') {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const oracleBaseUrl = process.env.ORACLE_BASE_URL;
    const oracleAuth = process.env.ORACLE_AUTH;

    let pos = [];

    if (status === 'PENDING_APPROVAL') {
      const urlPending = `${oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=StatusCode%3D%27PENDING_APPROVAL%27&limit=10&fields=OrderNumber,Status,Total,Supplier,CurrencyCode`;
      const urlIncomplete = `${oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=StatusCode%3D%27INCOMPLETE%27&limit=10&fields=OrderNumber,Status,Total,Supplier,CurrencyCode`;

      const [resPending, resIncomplete] = await Promise.all([
        axios.get(urlPending, { httpsAgent: agent, headers: { 'Authorization': oracleAuth } }).catch(() => ({ data: { items: [] } })),
        axios.get(urlIncomplete, { httpsAgent: agent, headers: { 'Authorization': oracleAuth } }).catch(() => ({ data: { items: [] } }))
      ]);

      pos = [...(resPending.data.items || []), ...((resIncomplete.data.items || []).filter(item => {
        // Avoid duplicate items if any
        return !(resPending.data.items || []).some(p => p.OrderNumber === item.OrderNumber);
      }))];
    } else {
      const url = `${oracleBaseUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=StatusCode%3D%27${status}%27&limit=10&fields=OrderNumber,Status,Total,Supplier,CurrencyCode`;
      const response = await axios.get(url, {
        httpsAgent: agent,
        headers: { 'Authorization': oracleAuth }
      });
      pos = response.data.items || [];
    }

    if (!pos.length) {
      await sendWhatsAppMessage(from, `✅ No ${statusLabel.toLowerCase()} purchase orders found.`);
      return;
    }

    let message = `📋 *${statusLabel} Purchase Orders (${pos.length})*\n\n`;
    pos.forEach((po, i) => {
      message += `${i + 1}. *${po.OrderNumber}*\n`;
      message += `   Supplier: ${po.Supplier || 'N/A'}\n`;
      message += `   Amount: ${po.CurrencyCode} ${po.Total || '0'}\n`;
      message += `   Status: ${po.Status}\n\n`;
    });

    message += `To check details, reply:\n"PO status <order_number>"`;

    await sendWhatsAppMessage(from, message);

  } catch (err) {
    console.error('WhatsApp PO list error:', err.message);
    await sendWhatsAppMessage(from, `❌ Error fetching ${statusLabel.toLowerCase()} PO list. Please try again.`);
  }
}

// ─── PROCESS ASSIGN MANAGER ───────────────────────────
async function processAssignManager(from, employeeNum, managerNum) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const auth = process.env.ORACLE_AUTH || 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';

    // Step 1: Get worker details
    const workerRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${employeeNum}&expand=workRelationships.assignments.managers`,
      { httpsAgent: agent,
        headers: { 'Authorization': auth }}
    );
    
    if (!workerRes.data.items?.length) {
      await sendWhatsAppMessage(from,
        `❌ Employee ${employeeNum} not found in Oracle.`);
      return;
    }
    
    const worker = workerRes.data.items[0];
    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];
    const assignmentLink = assignment?.links?.find(l => l.rel === 'self')?.href;
    const parts = assignmentLink?.split('/');
    const workersIdx = parts?.indexOf('workers');
    const assignmentsIdx = parts?.lastIndexOf('assignments');
    const encodedPersonId = parts?.[workersIdx + 1];
    const encodedAssignmentId = parts?.[assignmentsIdx + 1];
    const WorkRelationshipId = workRel?.PeriodOfServiceId;
    const workerName = worker.DisplayName || employeeNum;
    
    // Step 2: Get manager details
    const managerRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${managerNum}&expand=workRelationships.assignments`,
      { httpsAgent: agent,
        headers: { 'Authorization': auth }}
    );
    
    if (!managerRes.data.items?.length) {
      await sendWhatsAppMessage(from,
        `❌ Manager ${managerNum} not found in Oracle.`);
      return;
    }
    
    const manager = managerRes.data.items[0];
    const managerAssignment = manager.workRelationships?.[0]?.assignments?.[0];
    const ManagerAssignmentId = managerAssignment?.AssignmentId;
    const managerName = manager.DisplayName || managerNum;
    
    // Step 3: Assign manager
    const assignUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}/child/managers`;
    
    await axios.post(assignUrl,
      { ManagerAssignmentId: Number(ManagerAssignmentId),
        ManagerType: 'LINE_MANAGER' },
      { httpsAgent: agent,
        headers: { 
          'Authorization': auth,
          'Content-Type': 'application/json'
        }}
    );
    
    await sendWhatsAppMessage(from,
      `✅ Success!\n\n` +
      `Employee: ${workerName} (${employeeNum})\n` +
      `New Manager: ${managerName} (${managerNum})\n\n` +
      `Manager assigned successfully in Oracle Fusion! 🎉`
    );
    
  } catch (err) {
    console.error('Assign manager error:', err.response?.data || err.message);
    await sendWhatsAppMessage(from,
      `❌ Failed to assign manager.\n` +
      `Error: ${err.response?.data?.detail || err.message}`
    );
  }
}

// ─── PROCESS CHANGE DEPARTMENT ────────────────────────
async function processChangeDepartment(from, employeeNum, deptName) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const auth = process.env.ORACLE_AUTH || 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';

    // Get worker details
    const workerRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${employeeNum}&expand=workRelationships.assignments`,
      { httpsAgent: agent,
        headers: { 'Authorization': auth }}
    );
    
    if (!workerRes.data.items?.length) {
      await sendWhatsAppMessage(from,
        `❌ Employee ${employeeNum} not found.`);
      return;
    }
    
    const worker = workerRes.data.items[0];
    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];
    const assignmentLink = assignment?.links?.find(l => l.rel === 'self')?.href;
    const parts = assignmentLink?.split('/');
    const workersIdx = parts?.indexOf('workers');
    const assignmentsIdx = parts?.lastIndexOf('assignments');
    const encodedPersonId = parts?.[workersIdx + 1];
    const encodedAssignmentId = parts?.[assignmentsIdx + 1];
    const WorkRelationshipId = workRel?.PeriodOfServiceId;
    
    // Get departments list from stable resource and find matching department
    const deptRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/departments?onlyData=true&limit=500`,
      { httpsAgent: agent,
        headers: { 'Authorization': auth }}
    );
    
    const departments = (deptRes.data.items || []).map(d => ({
      DepartmentId: Number(d.OrganizationId),
      DepartmentName: d.Name
    }));
    
    const matchedDept = departments.find(d => 
      d.DepartmentName?.toLowerCase().includes(deptName.toLowerCase()) ||
      deptName.toLowerCase().includes(d.DepartmentName?.toLowerCase())
    );
    
    if (!matchedDept) {
      await sendWhatsAppMessage(from,
        `❌ Department "${deptName}" not found.\n` +
        `Please check the department name and try again.`
      );
      return;
    }
    
    // Change department using UPDATE mode with CORRECTION fallback
    const patchUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;
    const body = {
      "ActionCode": "ASG_CHANGE",
      "DepartmentId": Number(matchedDept.DepartmentId),
      "OrganizationId": Number(matchedDept.DepartmentId)
    };

    let updateSuccess = false;
    const effectiveDate = new Date().toISOString().split('T')[0]; // Current date

    try {
      console.log('Attempting WhatsApp UPDATE mode...');
      await axios.patch(patchUrl, body, {
        httpsAgent: agent,
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });
      updateSuccess = true;
      console.log('WhatsApp UPDATE mode succeeded!');
    } catch (updateErr) {
      console.log('WhatsApp UPDATE mode failed, attempting CORRECTION mode...');
      console.log('Update Error Details:', JSON.stringify(updateErr.response?.data || updateErr.message));
      
      try {
        await axios.patch(patchUrl, body, {
          httpsAgent: agent,
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Effective-Of': 'RangeMode=CORRECTION'
          }
        });
        updateSuccess = true;
        console.log('WhatsApp CORRECTION mode succeeded!');
      } catch (corrErr) {
        console.error('WhatsApp CORRECTION mode failed:', corrErr.response?.data || corrErr.message);
        throw corrErr;
      }
    }
    
    if (updateSuccess) {
      await sendWhatsAppMessage(from,
        `✅ Success!\n\n` +
        `Employee: ${worker.DisplayName} (${employeeNum})\n` +
        `New Department: ${matchedDept.DepartmentName}\n\n` +
        `Department changed successfully in Oracle Fusion! 🎉`
      );
    }
  } catch (err) {
    const errorDetail = err.response?.data?.detail || err.response?.data?.title || err.message;
    console.error('Change dept error:', errorDetail);
    await sendWhatsAppMessage(from,
      `❌ Failed to change department.\n` +
      `Error: ${errorDetail}`
    );
  }
}

// ─── PROCESS CHANGE LOCATION ─────────────────────────
async function processChangeLocation(from, employeeNum, locName) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const auth = process.env.ORACLE_AUTH || 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';

    // Get worker details
    const workerRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${employeeNum}&expand=workRelationships.assignments`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    if (!workerRes.data.items?.length) {
      await sendWhatsAppMessage(from, `❌ Employee ${employeeNum} not found.`);
      return;
    }
    
    const worker = workerRes.data.items[0];
    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];
    const assignmentLink = assignment?.links?.find(l => l.rel === 'self')?.href;
    const parts = assignmentLink?.split('/');
    const workersIdx = parts?.indexOf('workers');
    const assignmentsIdx = parts?.lastIndexOf('assignments');
    const encodedPersonId = parts?.[workersIdx + 1];
    const encodedAssignmentId = parts?.[assignmentsIdx + 1];
    const WorkRelationshipId = workRel?.PeriodOfServiceId;
    
    // Get locations list
    const locRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/locations?limit=100&fields=LocationId,LocationCode,LocationName&onlyData=true`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    const locations = (locRes.data.items || []).map(l => ({
      LocationId: Number(l.LocationId),
      LocationName: l.LocationName
    }));
    
    const matchedLoc = locations.find(l => 
      l.LocationName?.toLowerCase().includes(locName.toLowerCase()) ||
      locName.toLowerCase().includes(l.LocationName?.toLowerCase())
    );
    
    if (!matchedLoc) {
      await sendWhatsAppMessage(from,
        `❌ Location "${locName}" not found.\n` +
        `Please check the location name and try again.`
      );
      return;
    }
    
    // Change location using UPDATE mode with CORRECTION fallback
    const patchUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;
    const body = {
      "ActionCode": "ASG_CHANGE",
      "LocationId": Number(matchedLoc.LocationId)
    };

    let updateSuccess = false;
    const effectiveDate = new Date().toISOString().split('T')[0];

    try {
      console.log('Attempting Location UPDATE mode...');
      await axios.patch(patchUrl, body, {
        httpsAgent: agent,
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });
      updateSuccess = true;
    } catch (updateErr) {
      console.log('Location UPDATE mode failed, attempting CORRECTION...');
      try {
        await axios.patch(patchUrl, body, {
          httpsAgent: agent,
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Effective-Of': 'RangeMode=CORRECTION'
          }
        });
        updateSuccess = true;
      } catch (corrErr) {
        throw corrErr;
      }
    }
    
    if (updateSuccess) {
      await sendWhatsAppMessage(from,
        `✅ Success!\n\n` +
        `Employee: ${worker.DisplayName} (${employeeNum})\n` +
        `New Location: ${matchedLoc.LocationName}\n\n` +
        `Location changed successfully in Oracle Fusion! 🎉`
      );
    }
  } catch (err) {
    const errorDetail = err.response?.data?.detail || err.response?.data?.title || err.message;
    await sendWhatsAppMessage(from, `❌ Failed to change location.\nError: ${errorDetail}`);
  }
}

// ─── PROCESS CHANGE JOB ──────────────────────────────
async function processChangeJob(from, employeeNum, jobName) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const auth = process.env.ORACLE_AUTH || 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';

    const workerRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${employeeNum}&expand=workRelationships.assignments`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    if (!workerRes.data.items?.length) {
      await sendWhatsAppMessage(from, `❌ Employee ${employeeNum} not found.`);
      return;
    }
    
    const worker = workerRes.data.items[0];
    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];
    const assignmentLink = assignment?.links?.find(l => l.rel === 'self')?.href;
    const parts = assignmentLink?.split('/');
    const workersIdx = parts?.indexOf('workers');
    const assignmentsIdx = parts?.lastIndexOf('assignments');
    const encodedPersonId = parts?.[workersIdx + 1];
    const encodedAssignmentId = parts?.[assignmentsIdx + 1];
    const WorkRelationshipId = workRel?.PeriodOfServiceId;
    
    // Get jobs list
    const jobRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/jobs?limit=500&fields=JobId,JobCode,Name&onlyData=true`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    const jobs = (jobRes.data.items || []).map(j => ({
      JobId: Number(j.JobId),
      JobName: j.Name
    }));
    
    const matchedJob = jobs.find(j => 
      j.JobName?.toLowerCase().includes(jobName.toLowerCase()) ||
      jobName.toLowerCase().includes(j.JobName?.toLowerCase())
    );
    
    if (!matchedJob) {
      await sendWhatsAppMessage(from,
        `❌ Job "${jobName}" not found.\n` +
        `Please check the job name and try again.`
      );
      return;
    }
    
    const patchUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;
    const body = {
      "ActionCode": "ASG_CHANGE",
      "JobId": Number(matchedJob.JobId)
    };

    let updateSuccess = false;
    const effectiveDate = new Date().toISOString().split('T')[0];

    try {
      console.log('Attempting Job UPDATE mode...');
      await axios.patch(patchUrl, body, {
        httpsAgent: agent,
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });
      updateSuccess = true;
    } catch (updateErr) {
      console.log('Job UPDATE mode failed, attempting CORRECTION...');
      try {
        await axios.patch(patchUrl, body, {
          httpsAgent: agent,
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Effective-Of': 'RangeMode=CORRECTION'
          }
        });
        updateSuccess = true;
      } catch (corrErr) {
        throw corrErr;
      }
    }
    
    if (updateSuccess) {
      await sendWhatsAppMessage(from,
        `✅ Success!\n\n` +
        `Employee: ${worker.DisplayName} (${employeeNum})\n` +
        `New Job: ${matchedJob.JobName}\n\n` +
        `Job changed successfully in Oracle Fusion! 🎉`
      );
    }
  } catch (err) {
    const errorDetail = err.response?.data?.detail || err.response?.data?.title || err.message;
    await sendWhatsAppMessage(from, `❌ Failed to change job.\nError: ${errorDetail}`);
  }
}

// ─── PROCESS CHANGE POSITION ─────────────────────────
async function processChangePosition(from, employeeNum, posName) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const auth = process.env.ORACLE_AUTH || 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';

    const workerRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${employeeNum}&expand=workRelationships.assignments`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    if (!workerRes.data.items?.length) {
      await sendWhatsAppMessage(from, `❌ Employee ${employeeNum} not found.`);
      return;
    }
    
    const worker = workerRes.data.items[0];
    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];
    const assignmentLink = assignment?.links?.find(l => l.rel === 'self')?.href;
    const parts = assignmentLink?.split('/');
    const workersIdx = parts?.indexOf('workers');
    const assignmentsIdx = parts?.lastIndexOf('assignments');
    const encodedPersonId = parts?.[workersIdx + 1];
    const encodedAssignmentId = parts?.[assignmentsIdx + 1];
    const WorkRelationshipId = workRel?.PeriodOfServiceId;
    
    // Get positions list
    const posRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/positions?limit=500&fields=PositionId,PositionCode,Name&onlyData=true`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    const positions = (posRes.data.items || []).map(p => ({
      PositionId: Number(p.PositionId),
      PositionName: p.Name
    }));
    
    const matchedPos = positions.find(p => 
      p.PositionName?.toLowerCase().includes(posName.toLowerCase()) ||
      posName.toLowerCase().includes(p.PositionName?.toLowerCase())
    );
    
    if (!matchedPos) {
      await sendWhatsAppMessage(from,
        `❌ Position "${posName}" not found.\n` +
        `Please check the position name and try again.`
      );
      return;
    }
    
    const patchUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;
    const body = {
      "ActionCode": "ASG_CHANGE",
      "PositionId": Number(matchedPos.PositionId)
    };

    let updateSuccess = false;
    const effectiveDate = new Date().toISOString().split('T')[0];

    try {
      console.log('Attempting Position UPDATE mode...');
      await axios.patch(patchUrl, body, {
        httpsAgent: agent,
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });
      updateSuccess = true;
    } catch (updateErr) {
      console.log('Position UPDATE mode failed, attempting CORRECTION...');
      try {
        await axios.patch(patchUrl, body, {
          httpsAgent: agent,
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Effective-Of': 'RangeMode=CORRECTION'
          }
        });
        updateSuccess = true;
      } catch (corrErr) {
        throw corrErr;
      }
    }
    
    if (updateSuccess) {
      await sendWhatsAppMessage(from,
        `✅ Success!\n\n` +
        `Employee: ${worker.DisplayName} (${employeeNum})\n` +
        `New Position: ${matchedPos.PositionName}\n\n` +
        `Position changed successfully in Oracle Fusion! 🎉`
      );
    }
  } catch (err) {
    const errorDetail = err.response?.data?.detail || err.response?.data?.title || err.message;
    await sendWhatsAppMessage(from, `❌ Failed to change position.\nError: ${errorDetail}`);
  }
}

// ─── PROCESS CHANGE GRADE ────────────────────────────
async function processChangeGrade(from, employeeNum, gradeName) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const auth = process.env.ORACLE_AUTH || 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';

    const workerRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${employeeNum}&expand=workRelationships.assignments`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    if (!workerRes.data.items?.length) {
      await sendWhatsAppMessage(from, `❌ Employee ${employeeNum} not found.`);
      return;
    }
    
    const worker = workerRes.data.items[0];
    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];
    const assignmentLink = assignment?.links?.find(l => l.rel === 'self')?.href;
    const parts = assignmentLink?.split('/');
    const workersIdx = parts?.indexOf('workers');
    const assignmentsIdx = parts?.lastIndexOf('assignments');
    const encodedPersonId = parts?.[workersIdx + 1];
    const encodedAssignmentId = parts?.[assignmentsIdx + 1];
    const WorkRelationshipId = workRel?.PeriodOfServiceId;
    
    // Get grades list
    const gradeRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/grades?limit=500&fields=GradeId,GradeCode,GradeName&onlyData=true`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    const grades = (gradeRes.data.items || []).map(g => ({
      GradeId: Number(g.GradeId),
      GradeName: g.GradeName
    }));
    
    const matchedGrade = grades.find(g => 
      g.GradeName?.toLowerCase().includes(gradeName.toLowerCase()) ||
      gradeName.toLowerCase().includes(g.GradeName?.toLowerCase())
    );
    
    if (!matchedGrade) {
      await sendWhatsAppMessage(from,
        `❌ Grade "${gradeName}" not found.\n` +
        `Please check the grade name and try again.`
      );
      return;
    }
    
    const patchUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;
    const body = {
      "ActionCode": "ASG_CHANGE",
      "GradeId": Number(matchedGrade.GradeId)
    };

    let updateSuccess = false;
    const effectiveDate = new Date().toISOString().split('T')[0];

    try {
      console.log('Attempting Grade UPDATE mode...');
      await axios.patch(patchUrl, body, {
        httpsAgent: agent,
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });
      updateSuccess = true;
    } catch (updateErr) {
      console.log('Grade UPDATE mode failed, attempting CORRECTION...');
      try {
        await axios.patch(patchUrl, body, {
          httpsAgent: agent,
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Effective-Of': 'RangeMode=CORRECTION'
          }
        });
        updateSuccess = true;
      } catch (corrErr) {
        throw corrErr;
      }
    }
    
    if (updateSuccess) {
      await sendWhatsAppMessage(from,
        `✅ Success!\n\n` +
        `Employee: ${worker.DisplayName} (${employeeNum})\n` +
        `New Grade: ${matchedGrade.GradeName}\n\n` +
        `Grade changed successfully in Oracle Fusion! 🎉`
      );
    }
  } catch (err) {
    const errorDetail = err.response?.data?.detail || err.response?.data?.title || err.message;
    await sendWhatsAppMessage(from, `❌ Failed to change grade.\nError: ${errorDetail}`);
  }
}

// ─── PROCESS CHANGE BUSINESS UNIT ──────────────────────
async function processChangeBusinessUnit(from, employeeNum, buName) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const auth = process.env.ORACLE_AUTH || 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';

    const workerRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${employeeNum}&expand=workRelationships.assignments`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    if (!workerRes.data.items?.length) {
      await sendWhatsAppMessage(from, `❌ Employee ${employeeNum} not found.`);
      return;
    }
    
    const worker = workerRes.data.items[0];
    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];
    const assignmentLink = assignment?.links?.find(l => l.rel === 'self')?.href;
    const parts = assignmentLink?.split('/');
    const workersIdx = parts?.indexOf('workers');
    const assignmentsIdx = parts?.lastIndexOf('assignments');
    const encodedPersonId = parts?.[workersIdx + 1];
    const encodedAssignmentId = parts?.[assignmentsIdx + 1];
    const WorkRelationshipId = workRel?.PeriodOfServiceId;
    
    // Get Business Units list
    const buRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/hcmBusinessUnitsLOV?limit=500&fields=BusinessUnitId,BusinessUnitName&onlyData=true`,
      { httpsAgent: agent, headers: { 'Authorization': auth }}
    );
    
    const businessUnits = (buRes.data.items || []).map(b => ({
      BusinessUnitId: Number(b.BusinessUnitId),
      BusinessUnitName: b.BusinessUnitName
    }));
    
    const matchedBU = businessUnits.find(b => 
      b.BusinessUnitName?.toLowerCase().includes(buName.toLowerCase()) ||
      buName.toLowerCase().includes(b.BusinessUnitName?.toLowerCase())
    );
    
    if (!matchedBU) {
      await sendWhatsAppMessage(from,
        `❌ Business Unit "${buName}" not found.\n` +
        `Please check the name and try again.`
      );
      return;
    }
    
    const patchUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;
    const body = {
      "ActionCode": "ASG_CHANGE",
      "BusinessUnitId": Number(matchedBU.BusinessUnitId)
    };

    let updateSuccess = false;
    const effectiveDate = new Date().toISOString().split('T')[0];

    try {
      console.log('Attempting Business Unit UPDATE mode...');
      await axios.patch(patchUrl, body, {
        httpsAgent: agent,
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      });
      updateSuccess = true;
    } catch (updateErr) {
      console.log('Business Unit UPDATE mode failed, attempting CORRECTION...');
      try {
        await axios.patch(patchUrl, body, {
          httpsAgent: agent,
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Effective-Of': 'RangeMode=CORRECTION'
          }
        });
        updateSuccess = true;
      } catch (corrErr) {
        throw corrErr;
      }
    }
    
    if (updateSuccess) {
      await sendWhatsAppMessage(from,
        `✅ Success!\n\n` +
        `Employee: ${worker.DisplayName} (${employeeNum})\n` +
        `New Business Unit: ${matchedBU.BusinessUnitName}\n\n` +
        `Business Unit changed successfully in Oracle Fusion! 🎉`
      );
    }
  } catch (err) {
    const errorDetail = err.response?.data?.detail || err.response?.data?.title || err.message;
    await sendWhatsAppMessage(from, `❌ Failed to change business unit.\nError: ${errorDetail}`);
  }
}

// ─── PROCESS HIRE EMPLOYEE ────────────────────────────
async function processHireEmployee(from, details) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const auth = process.env.ORACLE_AUTH || 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';

    const today = new Date().toISOString().split('T')[0];
    const url = `${baseUrl}/hcmRestApi/resources/latest/workers`;

    const body = {
      "PersonNumber": details.PersonNumber,
      "names": [
        {
          "LegislationCode": "US",
          "FirstName": details.FirstName,
          "LastName": details.LastName
        }
      ],
      "workRelationships": [
        {
          "LegalEmployerName": details.LegalEmployerName,
          "WorkerType": "E",
          "PrimaryFlag": true,
          "StartDate": today,
          "assignments": [
            {
              "ActionCode": "HIRE",
              "BusinessUnitName": details.BusinessUnitName,
              "AssignmentStatusTypeCode": "ACTIVE_PROCESS",
              "JobCode": details.JobCode || null,
              "LocationCode": details.LocationCode || null
            }
          ]
        }
      ]
    };

    console.log('[WhatsApp] Submitting worker hire payload:', JSON.stringify(body));

    const response = await axios.post(url, body, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        'Effective-Of': `RangeStartDate=${today};RangeEndDate=4712-12-31`
      }
    });

    console.log('[WhatsApp] Worker hire succeeded:', response.status);

    await sendWhatsAppMessage(from,
      `✅ Success!\n\n` +
      `Employee *${details.FirstName} ${details.LastName}* (Person Number: *${details.PersonNumber}*) has been hired successfully in Oracle Fusion HCM! 🎉`
    );

  } catch (error) {
    const status = error.response?.status || 500;
    const errorDetail = error.response?.data?.detail || error.response?.data?.title || error.message;
    console.error(`[WhatsApp] Hire Employee Error [${status}]:`, JSON.stringify(error.response?.data || error.message));

    await sendWhatsAppMessage(from,
      `❌ Failed to hire employee.\n\n` +
      `*Error details:* ${errorDetail}`
    );
  }
}

// ─── PROCESS GET EMPLOYEE DETAILS ────────────────────
async function processGetEmployeeDetails(from, personNumber) {
  try {
    const oracleAuth = process.env.ORACLE_AUTH;
    const oracleBaseUrl = process.env.ORACLE_BASE_URL || 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com';
    const baseUrl = oracleBaseUrl.replace(/\/$/, '');
    
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    // Search worker
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&expand=workRelationships.assignments.managers`;
    const urlName = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&fields=PersonNumber,DisplayName&onlyData=true`;

    const [response, responseName] = await Promise.all([
      axios.get(url, {
        httpsAgent: agent,
        headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
      }),
      axios.get(urlName, {
        httpsAgent: agent,
        headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
      })
    ]);

    const worker = response.data.items?.[0];
    if (!worker) {
      await sendWhatsAppMessage(from, `❌ Employee with Person Number *${personNumber}* was not found in Oracle Fusion.`);
      return;
    }

    const workerName = responseName.data.items?.[0];
    const displayName = workerName?.DisplayName || worker.DisplayName || 'Unknown';
    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];

    // Lookup full Names from LOVs in parallel to keep response ultra fast
    let jobName = assignment?.JobName || assignment?.JobCode || 'Not Assigned';
    let locationName = assignment?.LocationCode || 'Not Assigned';
    let positionName = assignment?.PositionName || assignment?.PositionCode || 'Not Assigned';
    let gradeName = assignment?.GradeName || assignment?.GradeCode || 'Not Assigned';
    let currentDept = assignment?.DepartmentName || 'Not Assigned';

    const lookupPromises = [];

    if (assignment?.JobId) {
      lookupPromises.push(
        axios.get(`${baseUrl}/hcmRestApi/resources/11.13.18.05/jobs?limit=500&fields=JobId,JobCode,Name&onlyData=true`, {
          httpsAgent: agent,
          headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
        }).then(res => {
          const matched = (res.data.items || []).find(j => Number(j.JobId) === Number(assignment.JobId));
          if (matched) jobName = matched.Name;
        }).catch(err => console.log('Job lookup error:', err.message))
      );
    }

    if (assignment?.LocationId) {
      lookupPromises.push(
        axios.get(`${baseUrl}/hcmRestApi/resources/11.13.18.05/locations?limit=100&fields=LocationId,LocationCode,LocationName&onlyData=true`, {
          httpsAgent: agent,
          headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
        }).then(res => {
          const matched = (res.data.items || []).find(l => Number(l.LocationId) === Number(assignment.LocationId));
          if (matched) locationName = matched.LocationName;
        }).catch(err => console.log('Location lookup error:', err.message))
      );
    }

    if (assignment?.PositionId) {
      lookupPromises.push(
        axios.get(`${baseUrl}/hcmRestApi/resources/11.13.18.05/positions?limit=500&fields=PositionId,PositionCode,Name&onlyData=true`, {
          httpsAgent: agent,
          headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
        }).then(res => {
          const matched = (res.data.items || []).find(p => Number(p.PositionId) === Number(assignment.PositionId));
          if (matched) positionName = matched.Name;
        }).catch(err => console.log('Position lookup error:', err.message))
      );
    }

    if (assignment?.GradeId) {
      lookupPromises.push(
        axios.get(`${baseUrl}/hcmRestApi/resources/11.13.18.05/grades?limit=500&fields=GradeId,GradeCode,GradeName&onlyData=true`, {
          httpsAgent: agent,
          headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
        }).then(res => {
          const matched = (res.data.items || []).find(g => Number(g.GradeId) === Number(assignment.GradeId));
          if (matched) gradeName = matched.GradeName;
        }).catch(err => console.log('Grade lookup error:', err.message))
      );
    }

    if (lookupPromises.length > 0) {
      await Promise.all(lookupPromises);
    }

    // Get manager details
    let currentManager = assignment?.managers?.find(m => m.ManagerType === "LINE_MANAGER");
    if (!currentManager && assignment?.managers?.length > 0) {
      currentManager = assignment.managers[0];
    }

    let currentManagerName = 'None';

    if (currentManager && currentManager.ManagerAssignmentNumber) {
      const managerAssignmentNum = currentManager.ManagerAssignmentNumber; 
      const managerPersonNum = managerAssignmentNum.replace(/e/i, '');
      
      try {
        const mgrUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${managerPersonNum}&fields=PersonId,PersonNumber,DisplayName&onlyData=true`;
        
        const mgrResponse = await axios.get(mgrUrl, {
          httpsAgent: agent,
          headers: { 'Authorization': oracleAuth, 'Content-Type': 'application/json' }
        });

        if (mgrResponse.data.items && mgrResponse.data.items.length > 0) {
          currentManagerName = mgrResponse.data.items[0].DisplayName || mgrResponse.data.items[0].PersonNumber;
        } else {
          currentManagerName = currentManager?.ManagerName || managerAssignmentNum;
        }
      } catch (mgrErr) {
        currentManagerName = currentManager?.ManagerName || managerAssignmentNum;
      }
    }

    const legalEmployer = workRel?.LegalEmployerName || workRel?.LegalEntityName || 'Not Assigned';
    const businessUnit = workRel?.BusinessUnitName || assignment?.BusinessUnitName || 'Not Assigned';
    const asgNo = assignment?.AssignmentNumber || 'Not Assigned';
    const workerType = assignment?.UserPersonType || 'Employee';
    const status = assignment?.AssignmentStatusType || 'ACTIVE';
    const startDate = workRel?.StartDate || assignment?.EffectiveStartDate || 'Not Assigned';

    // Format response
    const msg = `👤 *Employee Details Profile*:\n\n` +
                `🏷️ *Name:* ${displayName}\n` +
                `🔢 *Person Number:* ${personNumber}\n` +
                `🆔 *Assignment Number:* ${asgNo}\n` +
                `👥 *Worker Type:* ${workerType}\n` +
                `📊 *Status:* ${status}\n` +
                `📅 *Start Date:* ${startDate}\n` +
                `🏢 *Department:* ${currentDept}\n` +
                `🏛️ *Legal Employer:* ${legalEmployer}\n` +
                `🌍 *Business Unit:* ${businessUnit}\n` +
                `💼 *Job Role:* ${jobName}\n` +
                `📍 *Location:* ${locationName}\n` +
                `🎖️ *Position:* ${positionName}\n` +
                `🏅 *Grade:* ${gradeName}\n` +
                `👤 *Reporting Manager:* ${currentManagerName}`;

    await sendWhatsAppMessage(from, msg);

  } catch (err) {
    console.error('Error fetching employee details:', err.message);
    await sendWhatsAppMessage(from, `❌ Failed to fetch employee details for person *${personNumber}*.\n\n*Error:* ${err.message}`);
  }
}

// ─── SEND WHATSAPP MESSAGE ────────────────────────────
async function sendWhatsAppMessage(to, message) {
  try {
    const config = getWhatsAppConfig();
    await axios.post(
      `https://graph.facebook.com/v18.0/${config.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      },
      { headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      }}
    );
    console.log('WhatsApp message sent to:', to);
  } catch (err) {
    console.error('Send WhatsApp error:', err.response?.data || err.message);
  }
}

app.listen(port, () => {
  console.log(`Voice Action Server listening at http://localhost:${port}`);
});

// GET Leave Balance
app.get('/api/oracle/leavebalance', async (req, res) => {
  try {
    const { personId } = req.query;
    const absenceAuth = process.env.ORACLE_AUTH;
    const absenceUrl = process.env.ORACLE_BASE_URL;

    console.log('=== GET LEAVE BALANCE ===');
    console.log('PersonId:', personId);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const url = `${absenceUrl}/hcmRestApi/resources/11.13.18.05/absences?q=personId=${personId}&onlyData=true`;

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': absenceAuth,
        'Content-Type': 'application/json'
      }
    });

    console.log('Leave balance response:', JSON.stringify(response.data));
    res.json(response.data);

  } catch (err) {
    console.error('Leave balance error:', err.response?.status);
    console.error('Leave balance data:', JSON.stringify(err.response?.data));
    res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// POST Apply Leave
app.post('/api/oracle/applyleave', async (req, res) => {
  try {
    const {
      personId, employer, absenceTypeId, absenceTypeName, startDate, endDate, startTime, endTime
    } = req.body;

    const absenceAuth = process.env.ORACLE_AUTH;
    const absenceUrl = process.env.ORACLE_BASE_URL;

    // Map the hardcoded 'Casual Leave' from frontend to 'Vacation' to match Oracle's valid types
    let mappedAbsenceType = absenceTypeName;
    if (mappedAbsenceType === 'Casual Leave') mappedAbsenceType = 'Vacation';
    if (mappedAbsenceType === 'Annual Leave') mappedAbsenceType = 'Vacation';
    if (mappedAbsenceType === 'Sick Leave') mappedAbsenceType = 'Sick';

    console.log('=== APPLY LEAVE REQUEST ===');
    console.log('PersonId:', personId);
    console.log('Employer:', employer);
    console.log('StartDate:', startDate);
    console.log('EndDate:', endDate);
    console.log('AbsenceType:', mappedAbsenceType);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const today = new Date().toISOString().split('T')[0];

    const body = {
      personId: Number(personId),
      employer: employer,
      absenceType: mappedAbsenceType,
      startDate: startDate,
      endDate: endDate,
      startTime: startTime || '08:30',
      endTime: endTime || '17:30',
      absenceStatusCd: 'SUBMITTED'
    };

    console.log('Apply leave body:', JSON.stringify(body));

    const response = await axios.post(
      `${absenceUrl}/hcmRestApi/resources/11.13.18.05/absences`,
      body,
      {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/vnd.oracle.adf.resourceitem+json',
          'Authorization': absenceAuth,
          'effective-Of': `RangeStartDate=${today};RangeMode=UPDATE`
        }
      }
    );

    console.log('Apply leave success:', response.status);
    res.json({ success: true, message: 'Leave applied successfully!', data: response.data });

  } catch (err) {
    console.error('Apply leave error:', err.response?.status);
    res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// GET Absence Types
app.get('/api/oracle/absencetypes', async (req, res) => {
  try {
    const absenceAuth = process.env.ORACLE_AUTH;
    const absenceUrl = process.env.ORACLE_BASE_URL;

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const url = `${absenceUrl}/hcmRestApi/resources/11.13.18.05/absenceTypes?limit=50&fields=AbsenceTypeId,Name,UOMDescription&onlyData=true`;

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': absenceAuth,
        'Content-Type': 'application/json'
      }
    });

    const types = response.data.items?.map(t => ({
      AbsenceTypeId: t.AbsenceTypeId,
      Name: t.Name,
      UOMDescription: t.UOMDescription
    })) || [];

    res.json({ types });

  } catch (err) {
    console.error('Absence types error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function processLeaveBalance(from, personNumber) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const absenceUrl = process.env.ORACLE_BASE_URL;
    const absenceAuth = process.env.ORACLE_AUTH;
    const oracleUrl = process.env.ORACLE_BASE_URL;
    const oracleAuth = process.env.ORACLE_AUTH;

    const workerRes = await axios.get(
      `${oracleUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&fields=PersonId,DisplayName`,
      { httpsAgent: agent, headers: { 'Authorization': oracleAuth } }
    );

    if (!workerRes.data.items?.length) {
      await sendWhatsAppMessage(from, `❌ Employee ${personNumber} not found.`);
      return;
    }

    const worker = workerRes.data.items[0];
    const personId = worker.PersonId;

    const balanceRes = await axios.get(
      `${absenceUrl}/hcmRestApi/resources/11.13.18.05/absences?q=personId=${personId}&onlyData=true`,
      { httpsAgent: agent, headers: { 'Authorization': absenceAuth } }
    );

    const items = balanceRes.data.items || [];

    if (items.length === 0) {
      await sendWhatsAppMessage(from, `📊 *Leave Balance for ${worker.DisplayName}*\n\nNo leave records found.`);
      return;
    }

    let message = `📊 *Leave Balance for ${worker.DisplayName}*\n\n`;
    items.forEach(item => {
      message += `• ${item.absenceTypeName || 'Leave'}: *${item.remainingEntitlement || item.balance || 'N/A'} days*\n`;
    });

    await sendWhatsAppMessage(from, message);

  } catch (err) {
    console.error('WhatsApp leave balance error:', err.message);
    await sendWhatsAppMessage(from, `❌ Failed to fetch leave balance.\nPlease try again.`);
  }
}
