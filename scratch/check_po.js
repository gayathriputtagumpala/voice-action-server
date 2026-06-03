const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://dabiqy.ds-fa.oraclepdemos.com';
  const authHeader = 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';
  const agent = new https.Agent({ rejectUnauthorized: false });
  const poNumber = 'US165121';
  
  try {
    const url = `${cleanUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=OrderNumber%3D%27${poNumber}%27`;
    console.log('Fetching', url);
    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: { Authorization: authHeader }
    });
    
    console.log('Response Status:', response.status);
    console.log('Items found:', response.data.items?.length);
    if (response.data.items?.length > 0) {
      console.log('PO Details:', response.data.items[0]);
    } else {
      console.log('PO not found on this environment.');
    }
  } catch(err) {
    console.log('Error:', err.message);
    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Data:', err.response.data);
    }
  }
}
test();
