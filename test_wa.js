const axios = require('axios');

async function testWhatsApp() {
  const token = "EAAUM705DgWYBRlP7VDZCGbaEGnohyvIILY8JqzzPSix64b6czBdFTChhLYK9BVh2MmbBj9yPu6j9NEQQFzrJnAzad9p2fa5sIITbZCXTTeam2O04ObXDWC46gKM1FtZCTdKNLZAl5RntMtIMc2xUdpVuZB6QWWUjwRyDYlcyTL7TPRpQT6hY3iz1UsGKuTy1z3iHCVlIYlfaQQ3z31S6dKGN00KbSNgqwbCVWW3Ix0SZA9ZAl34TBUpAjoZCuJsoCfVJb0jFEWjDuQtNRzbgmI2sj68ZD";
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
