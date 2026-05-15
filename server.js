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
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://dabiqy.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&expand=workRelationships.assignments.managers`;
    
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
        const baseUrl = (process.env.ORACLE_BASE_URL || 'https://dabiqy.ds-fa.oraclepdemos.com').replace(/\/$/, '');
        const mgrUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${managerPersonNum}&fields=PersonId,PersonNumber,DisplayName&onlyData=true`;
        
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
      assignmentSelfLink: assignmentSelfLink,
      currentManagerAssignmentId: currentManager?.ManagerAssignmentId,
      currentManagerNumber: currentManagerNumber || currentManager?.ManagerAssignmentNumber,
      currentManagerName: currentManagerName,
      managerSelfLink: managerSelfLink,
      DepartmentName: assignment?.DepartmentName || 'Not Assigned',
      BusinessUnitId: assignment?.BusinessUnitId,
      BusinessUnitName: workRel?.BusinessUnitName || assignment?.BusinessUnitName,
      LocationId: assignment?.LocationId || null,
      LocationName: assignment?.LocationCode || 'Not Assigned'
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
      const baseUrl = (process.env.ORACLE_BASE_URL || 'https://dabiqy.ds-fa.oraclepdemos.com').replace(/\/$/, '');
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
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data?.detail || err.response?.data?.title || err.message 
    });
  }
});

// 6. Oracle Proxy - Change Department
app.patch('/api/oracle/department', async (req, res) => {
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
      const baseUrl = (process.env.ORACLE_BASE_URL || 'https://dabiqy.ds-fa.oraclepdemos.com').replace(/\/$/, '');
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
          'Authorization': process.env.ORACLE_AUTH,
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
          'Authorization': process.env.ORACLE_AUTH,
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
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://dabiqy.ds-fa.oraclepdemos.com').replace(/\/$/, '');
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/locations?limit=100&fields=LocationId,LocationName,AddressLine1,TownOrCity,Country&onlyData=true`;

    console.log('Fetching locations from Oracle...');

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': process.env.ORACLE_AUTH,
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

    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://dabiqy.ds-fa.oraclepdemos.com').replace(/\/$/, '');
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
        'Authorization': process.env.ORACLE_AUTH,
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

app.get('/api/oracle/departments', async (req, res) => {
  const { BusinessUnitName } = req.query;
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });

    // Use the stable departments resource
    const baseUrl = (process.env.ORACLE_BASE_URL || 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com').replace(/\/$/, '') + '/hcmRestApi/resources/11.13.18.05';
    let url = `${baseUrl}/departments?onlyData=true&limit=500`;

    console.log('Fetching departments from stable resource:', url);

    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: {
        'Authorization': process.env.ORACLE_AUTH,
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

// ─── WHATSAPP WEBHOOK VERIFICATION ───────────────────
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && 
      token === process.env.WHATSAPP_VERIFY_TOKEN) {
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

app.listen(port, () => {
  console.log(`Voice Action Server listening at http://localhost:${port}`);
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
        `1️⃣ Assign Manager:\n` +
        `"assign manager [manager_number] for employee [employee_number]"\n` +
        `Example: assign manager 4585 for employee 1405\n\n` +
        `2️⃣ Change Department:\n` +
        `"change department for employee [number] to [dept_name]"\n` +
        `Example: change department for employee 1405 to Consulting East US\n\n` +
        `Or send a voice note in English! 🎤`
      );
      return;
    }
    
    // Extract all numbers from message
    const numbers = text.match(/\d{3,6}/g) || [];
    
    // ASSIGN MANAGER
    if (lower.includes('assign') && lower.includes('manager')) {
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
    } else if (lower.includes('department') || 
               lower.includes('dept')) {
      if (numbers.length >= 1) {
        const employeeNum = numbers[0];
        
        // Extract department name after "to"
        const toIndex = lower.indexOf(' to ');
        const deptName = toIndex > -1 
          ? text.substring(toIndex + 4).trim() 
          : null;
        
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
      
    // UNKNOWN COMMAND  
    } else {
      await sendWhatsAppMessage(from,
        `❓ I didn't understand that.\n\n` +
        `Send "help" to see available commands\n` +
        `Or send a voice note in English 🎤`
      );
    }
    
  } catch (err) {
    console.error('Handle text error:', err.message);
    await sendWhatsAppMessage(from, 
      '❌ Something went wrong. Please try again.');
  }
}

// ─── HANDLE VOICE NOTE ────────────────────────────────
async function handleWhatsAppVoice(from, audioId) {
  try {
    await sendWhatsAppMessage(from, 
      '🎤 Voice note received! Transcribing...');
    
    // Step 1: Get audio URL from Meta
    const mediaRes = await axios.get(
      `https://graph.facebook.com/v18.0/${audioId}`,
      { headers: { 
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` 
      }}
    );
    
    const audioUrl = mediaRes.data.url;
    console.log('Audio URL:', audioUrl);
    
    // Step 2: Download audio
    const audioRes = await axios.get(audioUrl, {
      headers: { 
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` 
      },
      responseType: 'arraybuffer'
    });
    
    console.log('Audio downloaded, size:', audioRes.data.byteLength);
    
    // Step 3: Send to Sarvam AI for transcription
    const FormData = require('form-data');
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

// ─── PROCESS ASSIGN MANAGER ───────────────────────────
async function processAssignManager(from, employeeNum, managerNum) {
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const baseUrl = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com';
    const auth = 'Basic dXNlcl9yMTRfYTJmOmhUOD8yc1U/';

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
    const baseUrl = 'https://fa-eubg-test-saasfademo1.ds-fa.oraclepdemos.com';
    const auth = 'Basic dXNlcl9yMTRfYTJmOmhUOD8yc1U/';

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
    
    // Get departments list and find matching department
    const deptRes = await axios.get(
      `${baseUrl}/hcmRestApi/resources/11.13.18.05/departments?limit=100&fields=DepartmentId,DepartmentName&onlyData=true`,
      { httpsAgent: agent,
        headers: { 'Authorization': auth }}
    );
    
    const departments = deptRes.data.items || [];
    const matchedDept = departments.find(d => 
      d.DepartmentName?.toLowerCase()
        .includes(deptName.toLowerCase()) ||
      deptName.toLowerCase()
        .includes(d.DepartmentName?.toLowerCase())
    );
    
    if (!matchedDept) {
      await sendWhatsAppMessage(from,
        `❌ Department "${deptName}" not found.\n` +
        `Please check the department name and try again.`
      );
      return;
    }
    
    // Change department
    const today = new Date().toISOString().split('T')[0];
    const patchUrl = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers/${encodedPersonId}/child/workRelationships/${WorkRelationshipId}/child/assignments/${encodedAssignmentId}`;
    
    await axios.patch(patchUrl,
      { ActionCode: 'ASG_CHANGE',
        DepartmentId: Number(matchedDept.DepartmentId) },
      { httpsAgent: agent,
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Effective-Of': `RangeMode=UPDATE;RangeStartDate=${today};RangeEndDate=4712-12-31`
        }}
    );
    
    await sendWhatsAppMessage(from,
      `✅ Success!\n\n` +
      `Employee: ${worker.DisplayName} (${employeeNum})\n` +
      `New Department: ${matchedDept.DepartmentName}\n\n` +
      `Department changed successfully in Oracle Fusion! 🎉`
    );
    
  } catch (err) {
    console.error('Change dept error:', err.response?.data || err.message);
    await sendWhatsAppMessage(from,
      `❌ Failed to change department.\n` +
      `Error: ${err.response?.data?.detail || err.message}`
    );
  }
}

// ─── SEND WHATSAPP MESSAGE ────────────────────────────
async function sendWhatsAppMessage(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      },
      { headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }}
    );
    console.log('WhatsApp message sent to:', to);
  } catch (err) {
    console.error('Send WhatsApp error:', err.response?.data || err.message);
  }
}
