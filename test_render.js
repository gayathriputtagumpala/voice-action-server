const axios = require('axios');
async function run() {
  console.log('Calling Render verify endpoint...');
  try {
    const res = await axios.post('https://voice-action-server.onrender.com/api/auth/verify', {
      oracleUrl: 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com',
      username: 'CRM.STUDENT07',
      password: 'fusion12#'
    }, {
      timeout: 30000
    });
    console.log('Status:', res.status);
    console.log('Data:', res.data);
  } catch(e) {
    console.log('Error:', e.message);
    if (e.response) {
      console.log('Response status:', e.response.status);
      console.log('Response data:', e.response.data);
    }
  }
}
run();
