const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://dabiqy.ds-fa.oraclepdemos.com';
  const authHeader = 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';
  const agent = new https.Agent({ rejectUnauthorized: false });
  const poNumber = 'US165121';
  
  try {
    const url = `${cleanUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=OrderNumber%3D%27${poNumber}%27&fields=ProcurementBU,ProcurementBUId,BuyerId,BuyerDisplayName`;
    const response = await axios.get(url, {
      httpsAgent: agent,
      headers: { Authorization: authHeader }
    });
    console.log('PO BU & Buyer details:', response.data.items?.[0]);
  } catch(err) {
    console.log('Error:', err.message);
  }
}
test();
