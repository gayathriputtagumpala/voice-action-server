const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../../voice-action-app/main.js');
let content = fs.readFileSync(jsPath, 'utf8');

// 1. Add available_managers: [] in resetApp() state definition (only if not already there)
if (!content.includes('available_managers: []')) {
    const targetState = /available_jobs:\s*\[\s*\],\s*current_job_name:\s*null/;
    const replacementState = `available_jobs: [],
    current_job_name: null,
    available_managers: []`;
    if (targetState.test(content)) {
        content = content.replace(targetState, replacementState);
        console.log("1. Added available_managers to appState.");
    }
} else {
    console.log("1. available_managers already present in appState.");
}

// 2. Hide manager-selection-box in resetApp() UI resets
const targetUIRecovery = /document\.getElementById\('job-selection-box'\)\.style\.display\s*=\s*'none';/;
const replacementUIRecovery = `document.getElementById('job-selection-box').style.display = 'none';
  document.getElementById('manager-selection-box').style.display = 'none';`;

if (targetUIRecovery.test(content) && !content.includes("manager-selection-box').style.display = 'none';")) {
    content = content.replace(targetUIRecovery, replacementUIRecovery);
    console.log("2. Hid manager-selection-box in resetApp UI.");
} else {
    console.log("2. Already hid manager-selection-box or target not found.");
}

// 3. Trigger fetchManagers() inside employee search resolution
const targetEmployeeResolution = /else\s*\{\s*if\s*\(empDeptRow\)\s*empDeptRow\.style\.display\s*=\s*'none';\s*\/\/ Show manager rows\s*if\s*\(empManagerRow\)\s*empManagerRow\.style\.display\s*=\s*'flex';\s*if\s*\(empStatusRow\)\s*empStatusRow\.style\.display\s*=\s*'flex';\s*\}/;
const replacementEmployeeResolution = `else {
            if (empDeptRow) empDeptRow.style.display = 'none';
            
            // Show manager rows
            if (empManagerRow) empManagerRow.style.display = 'flex';
            if (empStatusRow) empStatusRow.style.display = 'flex';
            
            // Fetch available managers
            fetchManagers();
        }`;

if (targetEmployeeResolution.test(content)) {
    content = content.replace(targetEmployeeResolution, replacementEmployeeResolution);
    console.log("3. Injected fetchManagers() call on employee resolution.");
} else {
    console.log("3. Employee resolution target not found or already replaced.");
}

// 4. Completely rewrite showAssignManagerStep() to bypass Select Action and show selection box
const targetAssignStep = /function\s+showAssignManagerStep\(\)\s*\{\s*console\.log\("Showing Assign Manager Step\.\.\."\);[\s\S]*?step2Actions\.style\.display\s*=\s*'flex';\s*\}/;
const replacementAssignStep = `function showAssignManagerStep() {
    console.log("Showing Assign Manager Step...");
    appState.workflowStep = 2;
    updateStepDots(2);
    
    // Hide assign manager action buttons (step2-actions)
    const actionButtons = document.getElementById('step2-actions');
    if (actionButtons) actionButtons.style.display = 'none';
    
    // Show manager selection section (manager-selection-box)
    const mgrSection = document.getElementById('manager-selection-box');
    if (mgrSection) {
      mgrSection.style.display = 'block';
    }
    
    // Update step title
    mainTitle.textContent = 'Select New Manager';
    
    // Prepare manager selection
    setManagerInputMethod('voice');
}`;

if (targetAssignStep.test(content)) {
    content = content.replace(targetAssignStep, replacementAssignStep);
    console.log("4. Updated showAssignManagerStep() routing.");
} else {
    console.log("4. showAssignManagerStep target not found or already replaced.");
}

// 5. Update btn-edit click handler to show manager-selection-box
const targetBtnEdit = /else\s*\{\s*managerDetailsBox\.style\.display\s*=\s*'block';\s*\}/;
const replacementBtnEdit = `else {
    document.getElementById('manager-selection-box').style.display = 'block';
  }`;

if (targetBtnEdit.test(content)) {
    content = content.replace(targetBtnEdit, replacementBtnEdit);
    console.log("5. Updated btn-edit return handler.");
} else {
    console.log("5. btn-edit return handler target not found or already replaced.");
}

// 6. Append helper functions and event listener at the end of the file (only if not already there)
if (!content.includes('// Manager Custom Logic (Dropdown & Voice)')) {
    const helperFunctions = `
// Manager Custom Logic (Dropdown & Voice)
async function fetchManagers() {
    try {
        const res = await fetch(\`\${API_BASE}/oracle/managers\`, { headers: { 'Content-Type': 'application/json', 'x-oracle-auth': appState.oracleAuth, 'x-oracle-url': appState.oracleUrl } });
        const data = await res.json();
        appState.available_managers = data.managers || [];
        
        const select = document.getElementById('manager-select');
        select.innerHTML = '<option value="">Select a manager...</option>';
        appState.available_managers.forEach(mgr => {
            const opt = document.createElement('option');
            opt.value = mgr.AssignmentId;
            opt.dataset.personNumber = mgr.PersonNumber;
            opt.innerText = \`\${mgr.DisplayName} (No: \${mgr.PersonNumber})\`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to fetch managers', err);
    }
}

function setManagerInputMethod(method) {
    const voiceBtn = document.getElementById('managerVoiceBtn');
    const typeBtn = document.getElementById('managerTypeBtn');
    const voiceSec = document.getElementById('manager-voice-section');
    const typeSec = document.getElementById('manager-type-section');
    
    if (method === 'voice') {
        voiceBtn.classList.add('active');
        typeBtn.classList.remove('active');
        voiceSec.style.display = 'block';
        typeSec.style.display = 'none';
    } else {
        typeBtn.classList.add('active');
        voiceBtn.classList.remove('active');
        typeSec.style.display = 'block';
        voiceSec.style.display = 'none';
    }
}

function confirmManagerSelection() {
    const select = document.getElementById('manager-select');
    if (!select.value) {
        showToast("Please select a manager");
        return;
    }
    appState.ManagerAssignmentId = select.value;
    const selectedOption = select.options[select.selectedIndex];
    appState.manager_person_number = selectedOption.dataset.personNumber;
    appState.manager_display_name = selectedOption.text.split(' (No:')[0];
    
    console.log("Selected Manager:", appState.manager_display_name, "Assignment ID:", appState.ManagerAssignmentId, "Number:", appState.manager_person_number);
    moveToStep4();
}

document.getElementById('btn-proceed-manager-confirm')?.addEventListener('click', confirmManagerSelection);

// Manager Voice STT Logic
const managerMicBtn = document.getElementById('manager-mic-btn');
const managerStatusBar = document.getElementById('manager-status-bar');
const managerTranscriptBox = document.getElementById('manager-transcript-box');
const managerTranscriptText = document.getElementById('manager-transcript-text');

let isManagerRecording = false;

if (managerMicBtn) {
    managerMicBtn.addEventListener('click', toggleManagerRecording);
}

function toggleManagerRecording() {
    if (isManagerRecording) {
        isManagerRecording = false;
        managerMicBtn.classList.remove('recording');
        managerStatusBar.textContent = "⌛ Processing voice...";
        if(mediaRecorder) mediaRecorder.stop();
    } else {
        isManagerRecording = true;
        audioChunks = [];
        managerMicBtn.classList.add('recording');
        managerStatusBar.textContent = "🔴 Listening for manager name...";
        managerTranscriptBox.style.display = 'block';
        managerTranscriptText.textContent = "...";

        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorder.start();
            
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            
            mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              sendManagerToSarvam(audioBlob);
              stream.getTracks().forEach(track => track.stop());
            };
          }).catch(err => {
            console.error("Mic error:", err);
            isManagerRecording = false;
            managerMicBtn.classList.remove('recording');
        });
    }
}

async function sendManagerToSarvam(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('language_code', langSelect.value);
        
        const res = await fetch(\`\${API_BASE}/sarvam/stt\`, { method: 'POST', body: formData });
        const data = await res.json();
        const transcript = data.transcript;
        
        managerTranscriptText.textContent = transcript || "Could not understand.";
        if (transcript) {
            const cleanTranscript = transcript.toLowerCase().replace(/[^\\w\\s]/g, '').trim();
            const match = appState.available_managers.find(m => 
                cleanTranscript.includes(m.DisplayName.toLowerCase()) ||
                m.DisplayName.toLowerCase().includes(cleanTranscript)
            );
            
            if (match) {
                appState.ManagerAssignmentId = match.AssignmentId;
                appState.manager_person_number = match.PersonNumber;
                appState.manager_display_name = match.DisplayName;
                document.getElementById('manager-select').value = match.AssignmentId;
                managerStatusBar.textContent = \`Matched: \${match.DisplayName}\`;
                managerStatusBar.style.color = '#10b981';
            } else {
                managerStatusBar.textContent = "No matching manager found. Please try again or select from list.";
                managerStatusBar.style.color = '#ef4444';
            }
        }
    } catch (err) {
        console.error("STT Error:", err);
    }
}
`;
    content += helperFunctions;
    console.log("6. Appended helper functions and event bindings.");
}

fs.writeFileSync(jsPath, content, 'utf8');
console.log("main.js manager updates complete!");
