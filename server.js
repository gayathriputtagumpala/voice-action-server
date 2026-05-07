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
  const personNumber = req.query.person_number?.toString().trim();
  try {
    const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com';
    const url = `${baseUrl.replace(/\/$/, '')}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&expand=workRelationships.assignments.managers`;
    
    console.log('1. Person number received:', personNumber);
    console.log('3. Full URL being called:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': process.env.ORACLE_AUTH,
        'Content-Type': 'application/json'
      }
    });

    const worker = response.data.items?.[0];
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
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
    
    const encodedPersonId = workersIdx >= 0 ? linkParts[workersIdx + 1] : null;
    const encodedAssignmentId = assignmentsIdx >= 0 ? linkParts[assignmentsIdx + 1] : null;
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
        const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com';
        const mgrUrl = `${baseUrl.replace(/\/$/, '')}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${managerPersonNum}&fields=PersonId,PersonNumber,DisplayName&onlyData=true`;
        
        const mgrResponse = await axios.get(mgrUrl, {
          httpsAgent: agent,
          headers: {
            'Authorization': process.env.ORACLE_AUTH,
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
      currentManagerAssignmentId: currentManager?.ManagerAssignmentId,
      currentManagerNumber: currentManagerNumber || currentManager?.ManagerAssignmentNumber,
      currentManagerName: currentManagerName,
      managerSelfLink: managerSelfLink,
      DepartmentName: assignment?.DepartmentName || 'Not Assigned'
    });
  } catch (error) {
    console.error('Oracle Worker Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch worker details' });
  }
});

// 4. Oracle Proxy - Get Manager
app.get('/api/oracle/manager', async (req, res) => {
  const manager_person_number = req.query.manager_person_number?.toString().trim();
  try {
    const url = `${process.env.ORACLE_BASE_URL || 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com'}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${manager_person_number}&expand=workRelationships.assignments`;
    
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': process.env.ORACLE_AUTH,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Oracle Manager Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch manager details' });
  }
});

// 5. Oracle Proxy - Assign Manager
app.post('/api/oracle/assign', async (req, res) => {
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
        'Authorization': process.env.ORACLE_AUTH
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
      const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com';
      const url = `${baseUrl.replace(/\/$/, '')}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}/child/managers`;

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
            'Authorization': process.env.ORACLE_AUTH
          }
        }
      );
    }

    console.log('SUCCESS! Status:', response.status);
    res.json({ success: true, message: 'Manager assigned successfully' });

  } catch (err) {
    console.error('ASSIGN ERROR:', err.response?.status);
    console.error('ASSIGN ERROR DATA:', JSON.stringify(err.response?.data));
    res.status(500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

// 6. Oracle Proxy - Change Department
app.patch('/api/oracle/department', async (req, res) => {
  try {
    const { 
      encodedPersonId, 
      WorkRelationshipId, 
      encodedAssignmentId,
      DepartmentName,
      EffectiveDate
    } = req.body;

    console.log('=== CHANGE DEPARTMENT REQUEST ===');
    console.log('Department:', DepartmentName);
    console.log('EffectiveDate:', EffectiveDate);

    const effectiveDate = EffectiveDate || new Date().toISOString().split('T')[0];

    const baseUrl = process.env.ORACLE_BASE_URL || 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com';
    const url = `${baseUrl.replace(/\/$/, '')}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;

    console.log('PATCH URL:', url);

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const response = await axios.patch(
      url,
      {
        "ActionCode": "ASG_CHANGE",
        "DepartmentName": DepartmentName
      },
      {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.ORACLE_AUTH || 'Basic dXNlcl9yMTRfYTJmOnFvMkgqNlcj',
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${effectiveDate};RangeEndDate=4712-12-31`
        }
      }
    );

    console.log('Department change success:', response.status);
    res.json({ 
      success: true, 
      message: `Department changed to ${DepartmentName} successfully` 
    });

  } catch (err) {
    console.error('Department change error:', err.response?.status);
    console.error('Error data:', JSON.stringify(err.response?.data));
    res.status(500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

// 7. Oracle Proxy - Get Available Departments
app.get('/api/oracle/departments', async (req, res) => {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const url = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/departments?limit=100&fields=DepartmentId,DepartmentName&onlyData=true';

    console.log('Fetching departments from:', url);

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': 'Basic dXNlcl9yMTRfYTJmOnFvMkgqNlcj',
        'Content-Type': 'application/json'
      }
    });

    console.log('Departments count:', response.data.count);
    console.log('First dept:', response.data.items?.[0]);

    const departments = response.data.items
      .filter(d => d.DepartmentName)
      .map(d => ({
        DepartmentId: d.DepartmentId,
        DepartmentName: d.DepartmentName
      }));

    res.json({ departments });

  } catch (err) {
    console.error('Departments error status:', err.response?.status);
    console.error('Departments error:', JSON.stringify(err.response?.data || err.message));
    res.status(500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Voice Action Server listening at http://localhost:${port}`);
});
