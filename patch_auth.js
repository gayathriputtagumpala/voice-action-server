const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// 1. Inject login logic at the beginning of handleWhatsAppText
const handleWhatsAppTextStart = `async function handleWhatsAppText(from, text) {
  try {
    const lower = text.toLowerCase().trim();

    // LOGIN LOGIC
    if (lower.startsWith('login ')) {
      const parts = text.trim().split(/\\s+/);
      if (parts.length < 3) {
        await sendWhatsAppMessage(from, '❌ Invalid format. Please use: login [username] [password]');
        return;
      }
      const username = parts[1];
      const password = parts.slice(2).join(' ');
      
      await sendWhatsAppMessage(from, '⏳ Verifying your Oracle Fusion credentials...');
      
      try {
        const https = require('https');
        const agent = new https.Agent({ rejectUnauthorized: false });
        const targetOracleUrl = process.env.ORACLE_BASE_URL.replace(/\\/$/, '');
        const authToken = Buffer.from(\`\${username}:\${password}\`).toString('base64');
        const authHeader = \`Basic \${authToken}\`;
        
        const response = await require('axios').get(
          \`\${targetOracleUrl}/hcmRestApi/resources/11.13.18.05/\`,
          {
            httpsAgent: agent,
            headers: { 'Authorization': authHeader },
            timeout: 15000
          }
        );
        
        if (response.status === 200 || response.status === 201 || response.status === 403) {
          whatsappSessions[from] = whatsappSessions[from] || {};
          whatsappSessions[from].oracleAuth = authHeader;
          whatsappSessions[from].username = username;
          await sendWhatsAppMessage(from, \`✅ Login successful! Welcome, \${username}.\\nYou can now perform actions.\`);
        }
      } catch (err) {
        if (err.response?.status === 401) {
          await sendWhatsAppMessage(from, '❌ Invalid Oracle username or password. Please try again.');
        } else if (err.response?.status === 403) {
          // 403 means credentials are correct but no permission to catalog, which is fine for login
          whatsappSessions[from] = whatsappSessions[from] || {};
          whatsappSessions[from].oracleAuth = \`Basic \${Buffer.from(\`\${username}:\${password}\`).toString('base64')}\`;
          whatsappSessions[from].username = username;
          await sendWhatsAppMessage(from, \`✅ Login successful! Welcome, \${username}.\`);
        } else {
          await sendWhatsAppMessage(from, '❌ Login failed due to a connection or server error.');
        }
      }
      return;
    }

    // CHECK AUTHENTICATION FOR OTHER COMMANDS
    const isHelp = lower === 'hi' || lower === 'hello' || lower === 'help' || lower === 'start';
    if (!isHelp && (!whatsappSessions[from] || !whatsappSessions[from].oracleAuth)) {
      await sendWhatsAppMessage(from, '🔒 *Authentication Required*\\n\\nPlease login to Oracle Fusion to perform this action.\\n\\nReply with:\\n*login [username] [password]*');
      return;
    }
`;

code = code.replace(
  /async function handleWhatsAppText\(from, text\) \{\s*try \{\s*const lower = text\.toLowerCase\(\)\.trim\(\);/, 
  handleWhatsAppTextStart
);

// 2. Replace process.env.ORACLE_AUTH with session auth in all process* functions
// Since all process* functions have `from` parameter, we can safely replace
// `process.env.ORACLE_AUTH` with `(whatsappSessions[from]?.oracleAuth || process.env.ORACLE_AUTH)`
// We will only do this replacement for functions that take `from` as a parameter.

// We can do this safely by replacing it everywhere, EXCEPT in express routes.
// Let's replace ONLY inside the whatsapp specific functions.
// We can use a regex that looks for `const oracleAuth = process.env.ORACLE_AUTH;` 
// and `const absenceAuth = process.env.ORACLE_AUTH;`
// We'll replace it with `const oracleAuth = (typeof from !== 'undefined' && whatsappSessions[from]?.oracleAuth) ? whatsappSessions[from].oracleAuth : process.env.ORACLE_AUTH;`

code = code.replace(
  /const oracleAuth = process\.env\.ORACLE_AUTH;/g,
  "const oracleAuth = (typeof from !== 'undefined' && whatsappSessions[from]?.oracleAuth) ? whatsappSessions[from].oracleAuth : process.env.ORACLE_AUTH;"
);

code = code.replace(
  /const absenceAuth = process\.env\.ORACLE_AUTH;/g,
  "const absenceAuth = (typeof from !== 'undefined' && whatsappSessions[from]?.oracleAuth) ? whatsappSessions[from].oracleAuth : process.env.ORACLE_AUTH;"
);

// Also handle where it was defined as `let oracleAuth = ...` in express routes:
// Actually, `typeof from !== 'undefined'` handles the express routes safely!

fs.writeFileSync('server.js', code, 'utf8');
console.log('Successfully patched server.js for WhatsApp authentication!');
