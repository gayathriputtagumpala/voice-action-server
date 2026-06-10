const axios = require('axios');

async function testWhatsApp() {
  const token = "EAAUM705DgWYBRtIyxDZBuipOIBUzJSfoOPiGcXJrZBnS5uDtyZBEEtZA3KiefnRZASkejAlNHpvpg7GqeqUU5HZCSDaEHPr3c7pbDbJY6sUNbineT0zM4O9w7A1KVAr0WLxLg4wU1qStiOFbaumx89kLwCxjYHiZCsAdQdCYgSvvYkoyLgPw64GCdi6qmD6LOiKKkoG7kZApLM84yGle8L3H6ISFnhvTKV9OIh51iLDZBTyFuBENIhapDzKTTzZAfOGKZChZCZBjllZALhwScs0OfRWnlG";
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
