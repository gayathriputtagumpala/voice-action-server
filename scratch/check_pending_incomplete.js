const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://dabiqy.ds-fa.oraclepdemos.com';
  const authHeader = 'Basic dXNlcl9yMTNfYTJmOlRxJUw3XjNt';
  const agent = new https.Agent({ rejectUnauthorized: false });
  
  try {
    // Check PENDING_APPROVAL
    const urlPending = `${cleanUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=StatusCode%3D%27PENDING_APPROVAL%27&limit=10&fields=OrderNumber,Status,StatusCode,Total,Supplier`;
    console.log('Checking pending approval:', urlPending);
    const resPending = await axios.get(urlPending, {
      httpsAgent: agent,
      headers: { Authorization: authHeader }
    });
    console.log('Pending approval items:', resPending.data.items?.length || 0);
    resPending.data.items?.forEach(item => {
      console.log(`- PO: ${item.OrderNumber} | Status: ${item.Status} | Supplier: ${item.Supplier}`);
    });

    // Check INCOMPLETE
    const urlIncomplete = `${cleanUrl}/fscmRestApi/resources/11.13.18.05/purchaseOrders?q=StatusCode%3D%27INCOMPLETE%27&limit=10&fields=OrderNumber,Status,StatusCode,Total,Supplier`;
    console.log('\nChecking incomplete:', urlIncomplete);
    const resIncomplete = await axios.get(urlIncomplete, {
      httpsAgent: agent,
      headers: { Authorization: authHeader }
    });
    console.log('Incomplete items:', resIncomplete.data.items?.length || 0);
    resIncomplete.data.items?.forEach(item => {
      console.log(`- PO: ${item.OrderNumber} | Status: ${item.Status} | Supplier: ${item.Supplier}`);
    });
  } catch(err) {
    console.log('Error:', err.message);
  }
}
test();
