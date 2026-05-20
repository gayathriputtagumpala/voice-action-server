const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../../voice-action-app/index.html');
let content = fs.readFileSync(htmlPath, 'utf8');

const targetStr = `              <button id="btn-proceed-job-confirm" class="btn btn-primary mt-4">Proceed to Confirm</button>\r\n           </div>\r\n         </section>`;
const targetStrLF = `              <button id="btn-proceed-job-confirm" class="btn btn-primary mt-4">Proceed to Confirm</button>\n           </div>\n         </section>`;

const newBoxHtml = `              <button id="btn-proceed-job-confirm" class="btn btn-primary mt-4">Proceed to Confirm</button>
           </div>

           <!-- Manager Selection (Step 3 for Manager Flow) -->
           <div id="manager-selection-box" class="employee-card" style="display:none;">
              <h2 class="step-title" style="font-size:18px;">Select New Manager</h2>
              <div class="input-toggle" id="manager-input-toggle">
                <button class="toggle-btn" onclick="setManagerInputMethod('type')" id="managerTypeBtn">⌨️ Type</button>
                <button class="toggle-btn active" onclick="setManagerInputMethod('voice')" id="managerVoiceBtn">🎤 Voice</button>
              </div>
              
              <div id="manager-type-section" style="display:none; width:100%;">
                 <select id="manager-select" class="person-input" style="letter-spacing: normal; font-size: 16px; margin-bottom: 20px;">
                   <option value="">Select a manager...</option>
                 </select>
               </div>

              <div id="manager-voice-section" style="width:100%;">
                <div class="mic-container" style="margin: 20px 0;">
                  <button id="manager-mic-btn" class="mic-btn" style="width: 72px; height: 72px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                     </svg>
                  </button>
                </div>
                <p class="status-bar" id="manager-status-bar">Press mic and speak manager name</p>
              </div>

              <div class="glass-card" id="manager-transcript-box" style="display:none; margin-top:10px;">
                <p id="manager-transcript-text" class="transcript-text">...</p>
              </div>

              <button id="btn-proceed-manager-confirm" class="btn btn-primary mt-4">Proceed to Confirm</button>
           </div>
         </section>`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, newBoxHtml);
    console.log("Injected manager box using CRLF.");
} else if (content.includes(targetStrLF)) {
    content = content.replace(targetStrLF, newBoxHtml);
    console.log("Injected manager box using LF.");
} else {
    // Regex based replace
    const regex = /(btn-proceed-job-confirm[\s\S]*?<\/div>\s*<\/section>)/;
    if (regex.test(content)) {
        content = content.replace(regex, `btn-proceed-job-confirm" class="btn btn-primary mt-4">Proceed to Confirm</button>
           </div>\n\n` + newBoxHtml.replace('              <button id="btn-proceed-job-confirm" class="btn btn-primary mt-4">Proceed to Confirm</button>\n           </div>\n\n', ''));
        console.log("Injected manager box using Regex!");
    } else {
        console.log("Could not find the target job selection box ending.");
    }
}

fs.writeFileSync(htmlPath, content, 'utf8');
console.log("index.html manager box injection complete!");
