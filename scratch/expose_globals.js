const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../../voice-action-app/main.js');
let content = fs.readFileSync(jsPath, 'utf8');

// Expose selection method toggle functions globally on the window object
const globalExposures = `
// Expose toggle methods globally on window for inline HTML onclick triggers
window.setLocInputMethod = setLocInputMethod;
window.setDeptInputMethod = setDeptInputMethod;
window.setJobInputMethod = setJobInputMethod;
window.setManagerInputMethod = setManagerInputMethod;
`;

if (!content.includes('window.setManagerInputMethod = setManagerInputMethod;')) {
    content += globalExposures;
    console.log("Appended global window bindings for all toggles!");
} else {
    console.log("Global window bindings already present.");
}

fs.writeFileSync(jsPath, content, 'utf8');
console.log("main.js global exposure complete!");
