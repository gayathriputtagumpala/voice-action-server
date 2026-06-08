const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
const url = 'https://fa-etaj-saasfademo1.ds-fa.oraclepdemos.com/hcmRestApi/resources/11.13.18.05/absences';
const auth = 'Basic dXNlcl9yMTNfYTJmOmEyXk5JbyUy';
const today = new Date().toISOString().split('T')[0];

const body = {
  personId: 300000081250473,
  employer: 'US1 Legal Entity',
  absenceType: 'Vacation',
  startDate: '2026-06-15',
  endDate: '2026-06-18',
  startTime: '08:30',
  endTime: '17:30',
  absenceStatusCd: 'SUBMITTED'
};

axios.post(url, body, {
  httpsAgent: agent,
  headers: {
    'Content-Type': 'application/vnd.oracle.adf.resourceitem+json',
    'Authorization': auth,
    'effective-Of': `RangeStartDate=${today};RangeMode=UPDATE`
  }
}).then(res => console.log('Success!', res.status))
.catch(err => console.log(JSON.stringify(err.response?.data, null, 2) || err.message));
