const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://dabiqy.ds-fa.oraclepdemos.com';
  const authHeader = 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';
  const agent = new https.Agent({ rejectUnauthorized: false });
  
  try {
    const url = `${cleanUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?limit=25&fields=OrderNumber,Status,StatusCode,Total,Supplier`;
    console.log('Fetching', url);
    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: { Authorization: authHeader }
    });
    
    console.log('Total items fetched:', response.data.items?.length);
    response.data.items?.forEach((item, index) => {
      console.log(`${index + 1}. PO: ${item.OrderNumber} | Status: ${item.Status} | StatusCode: ${item.StatusCode} | Supplier: ${item.Supplier}`);
    });
  } catch(err) {
    console.log('Error:', err.message);
  }
}
test();
