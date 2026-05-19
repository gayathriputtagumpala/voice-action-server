const fs = require('fs');
let serverJs = fs.readFileSync('server.js', 'utf8');

// Replace standard header extraction with robust defensive version
serverJs = serverJs.replace(
  /const oracleAuth = req\.headers\['x-oracle-auth'\] \|\| process\.env\.ORACLE_AUTH;/g,
  "let oracleAuth = req.headers['x-oracle-auth'];\n  if (!oracleAuth || oracleAuth === 'null' || oracleAuth === 'undefined') {\n    oracleAuth = process.env.ORACLE_AUTH;\n  }"
);

serverJs = serverJs.replace(
  /const oracleBaseUrl = req\.headers\['x-oracle-url'\] \|\| process\.env\.ORACLE_BASE_URL;/g,
  "let oracleBaseUrl = req.headers['x-oracle-url'];\n  if (!oracleBaseUrl || oracleBaseUrl === 'null' || oracleBaseUrl === 'undefined') {\n    oracleBaseUrl = process.env.ORACLE_BASE_URL;\n  }"
);

fs.writeFileSync('server.js', serverJs);
console.log('Headers extraction robustness added successfully!');
