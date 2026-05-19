const fs = require('fs');
let serverJs = fs.readFileSync('server.js', 'utf8');

// Replace oracleAuth hardcoded fallbacks
serverJs = serverJs.replace(
  /const oracleAuth = req\.headers\['x-oracle-auth'\] \|\|[\s\n]*'Basic [A-Za-z0-9+/=]+';/g,
  "const oracleAuth = req.headers['x-oracle-auth'] || process.env.ORACLE_AUTH;"
);

// Replace oracleBaseUrl hardcoded fallbacks
serverJs = serverJs.replace(
  /const oracleBaseUrl = req\.headers\['x-oracle-url'\] \|\|[\s\n]*'https:\/\/[^']+';/g,
  "const oracleBaseUrl = req.headers['x-oracle-url'] || process.env.ORACLE_BASE_URL;"
);

// We also need to fix any other places where auth is hardcoded, e.g., 'https://dabiqy.ds-fa.oraclepdemos.com'
serverJs = serverJs.replace(
  /const baseUrl = \(oracleBaseUrl \|\| 'https:\/\/[^']+'\)/g,
  "const baseUrl = (oracleBaseUrl || process.env.ORACLE_BASE_URL)"
);

fs.writeFileSync('server.js', serverJs);
console.log('Replacements completed successfully!');
