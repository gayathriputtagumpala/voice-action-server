
const axios = require('axios');
require('dotenv').config({ path: './.env' });

async function test() {
  try {
    const context = {
      DisplayName: 'John',
      Department: 'IT',
      TenureMonths: 12,
      TenureCategory: 'Junior',
      RecentAbsences: 0,
      TotalAbsenceDays: 0,
      AbsenceRisk: 'Low',
      Location: 'NY'
    };
    const healthProblem = 'i have backpain';
    const res = await axios.post('http://localhost:3000/api/wellness/questions', { context, healthProblem });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error(e.message);
    if(e.response) console.error(e.response.data);
  }
}
test();

