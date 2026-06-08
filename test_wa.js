const axios = require('axios');

async function testWhatsApp() {
  const token = "EAAUM705DgWYBRurf99w8OPfo7eGVBO4dZAvi3X2d5ZCmbg1SZA5IdZCZCm8H57kbDrPTuhFFuzQVQQQpYIznRJ4EVNAUPZBTZB4E2JFaskvf1NzJlmEkOZAZC0ZA6pLnNRIy1DnmFNiVmKhM8u517XScaJlQPi6gRxcVbUZAYTtzbUZBfXAWlvNLd4BLAER5IyriuD08wdrlg1IzpCT9FL4VwxlwExqb0lVq2BrBwF4h5ir1aX3QiA8d4pqRG2HDZCCGuBkzHij5j3ykANymWbaD2TF5g";
  const phoneId = "1098869149981369";
  const to = "15556431923"; // Test number

  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: "Testing from backend" }
      },
      { headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }}
    );
    console.log("Success!");
  } catch (err) {
    console.error("Error:", JSON.stringify(err.response?.data || err.message, null, 2));
  }
}

testWhatsApp();
