const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../../voice-action-app/main.js');
let content = fs.readFileSync(jsPath, 'utf8');

// Find the showPopup section inside btnAssignNew
const targetString = `    showPopup(
      'âš ï¸  Manager Already Assigned',
      \`This employee already has a manager: \${appState.current_manager_name}. 
       Are you sure you want to assign a new additional manager?
       If you want to change the existing manager, click Cancel and choose 'Change Existing' instead.\`,
      'Continue Anyway',
      'Cancel',
      () => { moveToStep3(); },
      () => { closePopup(); }
    );`;

const targetString2 = `    showPopup(
      'âš ï¸  Manager Already Assigned',
      \`This employee already has a manager: \${appState.current_manager_name}. \n       Are you sure you want to assign a new additional manager?\n       If you want to change the existing manager, click Cancel and choose 'Change Existing' instead.\`,
      'Continue Anyway',
      'Cancel',
      () => { moveToStep3(); },
      () => { closePopup(); }
    );`;

const replacementString = `    showPopup(
      '❌ Manager Already Assigned',
      'This employee already has an active manager assigned. To assign a different manager, please go back and choose the "Change Existing" option.',
      'OK',
      null,
      () => { closePopup(); },
      null
    );`;

if (content.includes(targetString)) {
    content = content.replace(targetString, replacementString);
    console.log("Replaced btnAssignNew popup (style 1).");
} else if (content.includes(targetString2)) {
    content = content.replace(targetString2, replacementString);
    console.log("Replaced btnAssignNew popup (style 2).");
} else {
    // Regex based replace to be 100% sure
    const regex = /(btnAssignNew\.addEventListener\('click', \(\) => \{\s*if \(appState\.current_manager_name[\s\S]*?showPopup\([\s\S]*?\)\s*;\s*\} else)/;
    if (regex.test(content)) {
        content = content.replace(regex, `btnAssignNew.addEventListener('click', () => {
  if (appState.current_manager_name && 
      appState.current_manager_name !== 'None' && 
      appState.current_manager_name !== 'Not Assigned') {
    showPopup(
      '❌ Manager Already Assigned',
      'This employee already has an active manager assigned. To assign a different manager, please go back and choose the "Change Existing" option.',
      'OK',
      null,
      () => { closePopup(); },
      null
    );
  } else`);
        console.log("Replaced btnAssignNew popup using Regex!");
    } else {
        console.log("Could not find the target btnAssignNew click block.");
    }
}

fs.writeFileSync(jsPath, content, 'utf8');
console.log("main.js popup update complete!");
