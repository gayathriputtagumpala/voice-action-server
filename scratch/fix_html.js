const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../../voice-action-app/index.html');
let content = fs.readFileSync(htmlPath, 'utf8');

// Find the premature section closing tag and remove it
const targetLocEnd = 'Proceed to Confirm</button>\r\n           </div>\r\n         </section>';
const targetLocEndLF = 'Proceed to Confirm</button>\n           </div>\n         </section>';

if (content.includes(targetLocEnd)) {
    content = content.replace(targetLocEnd, 'Proceed to Confirm</button>\r\n           </div>');
    console.log("Replaced CRLF premature section.");
} else if (content.includes(targetLocEndLF)) {
    content = content.replace(targetLocEndLF, 'Proceed to Confirm</button>\n           </div>');
    console.log("Replaced LF premature section.");
} else {
    // Let's use regex to find and remove it
    const regex = /(Proceed to Confirm<\/button>\s*<\/div>\s*)(<\/section>)/;
    if (regex.test(content)) {
        content = content.replace(regex, '$1');
        console.log("Replaced using regex.");
    } else {
        console.log("Could not find the premature closing section tag.");
    }
}

// Now find the end of job-selection-box and insert the </section> closing tag
const targetJobEnd = 'Proceed to Confirm</button>\r\n            </div>';
const targetJobEndLF = 'Proceed to Confirm</button>\n            </div>';

if (content.includes(targetJobEnd)) {
    content = content.replace(targetJobEnd, 'Proceed to Confirm</button>\r\n            </div>\r\n         </section>');
    console.log("Replaced CRLF job end.");
} else if (content.includes(targetJobEndLF)) {
    content = content.replace(targetJobEndLF, 'Proceed to Confirm</button>\n            </div>\n         </section>');
    console.log("Replaced LF job end.");
} else {
    const regex2 = /(id="job-selection-box"[\s\S]*?Proceed to Confirm<\/button>\s*<\/div>)/;
    if (regex2.test(content)) {
        content = content.replace(regex2, '$1\n         </section>');
        console.log("Replaced Job end using regex.");
    } else {
        console.log("Could not find the end of job-selection-box.");
    }
}

fs.writeFileSync(htmlPath, content, 'utf8');
console.log("index.html tag fix complete!");
