const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://dabiqy.ds-fa.oraclepdemos.com';
  const authHeader = 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';
  const agent = new https.Agent({ rejectUnauthorized: false });
  const poHeaderId = '624875'; // POHeaderId for US165121
  const poNumber = 'US165121';
  
  try {
    const url = `${cleanUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders/${poHeaderId}/action/submit`;
    console.log('Sending submit request to:', url);
    const response = await axios.post(url, 
      { comments: 'Approved via Script Test' },
      {
        httpsAgent: agent,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Success status:', response.status);
    console.log('Success data:', response.data);
  } catch(err) {
    console.log('Error message:', err.message);
    if (err.response) {
      console.log('Response status:', err.response.status);
      console.log('Response data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}
test();
