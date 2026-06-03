const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://dabiqy.ds-fa.oraclepdemos.com';
  const authHeader = 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';
  const agent = new https.Agent({ rejectUnauthorized: false });
  
  try {
    const url = `${cleanUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=StatusCode%20in%20(%27PENDING_APPROVAL%27%2C%27INCOMPLETE%27)&limit=15&fields=OrderNumber,Status,StatusCode,Total,Supplier`;
    console.log('Querying URL:', url);
    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: { Authorization: authHeader }
    });
    console.log('Success! Total items fetched:', response.data.items?.length || 0);
    response.data.items?.forEach((item, index) => {
      console.log(`${index + 1}. PO: ${item.OrderNumber} | StatusCode: ${item.StatusCode} | Status: ${item.Status}`);
    });
  } catch(err) {
    console.log('Error message:', err.message);
    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Data:', err.response.data);
    }
  }
}
test();
