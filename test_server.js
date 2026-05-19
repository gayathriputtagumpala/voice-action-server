const axios = require('axios');
const https = require('https');

async function test() {
  const cleanUrl = 'https://fa-euth-dev58-saasfademo1.ds-fa.oraclepdemos.com';
  const username = 'CRM.STUDENT07';
  const password = 'fusion12#';
  
  const authToken = Buffer.from(`${username}:${password}`).toString('base64');
  const authHeader = `Basic ${authToken}`;
  
  const agent = new https.Agent({ rejectUnauthorized: false });
  const personNumber = '10';
  
  try {
    const baseUrl = cleanUrl;
    const url = `${baseUrl}/hcmRestApi/resources/11.13.18.05/workers?q=PersonNumber%3D${personNumber}&expand=workRelationships.assignments`;
    
    console.log('Fetching', url);
    const response = await axios.get(url, { httpsAgent: agent, headers: { Authorization: authHeader }});
    
    const worker = response.data.items?.[0];
    if (!worker) {
      console.log('Worker not found');
      return;
    }
    const workRel = worker.workRelationships?.[0];
    const assignment = workRel?.assignments?.[0];

    const assignmentSelfLink = assignment?.links?.find(l => l.rel === 'self')?.href;
    const linkParts = assignmentSelfLink?.split('/');
    const workersIdx = linkParts?.indexOf('workers');
    const assignmentsIdx = linkParts?.lastIndexOf('assignments');
    
    const encodedPersonId = workersIdx >= 0 ? linkParts[workersIdx + 1].split('?')[0] : null;
    const encodedAssignmentId = assignmentsIdx >= 0 ? linkParts[assignmentsIdx + 1].split('?')[0] : null;
    const workRelationshipId = workRel?.PeriodOfServiceId || workRel?.WorkRelationshipId; // numeric, use as-is

    // Get current manager details
    let currentManager = assignment?.managers?.find(m => m.ManagerType === "LINE_MANAGER");
    if (!currentManager && assignment?.managers?.length > 0) {
      currentManager = assignment.managers[0];
    }

    let currentManagerName = 'None';
    let currentManagerNumber = null;

    if (currentManager && currentManager.ManagerAssignmentNumber) {
      currentManagerNumber = currentManager.ManagerAssignmentNumber;
      currentManagerName = currentManager.ManagerName || currentManager.DisplayName || 'Unknown';
    }

    const payload = {
      person_number: personNumber,
      display_name: worker.DisplayName || worker.PersonName || 'Unknown',
      current_manager: currentManagerName,
      manager_assignment_number: currentManagerNumber,
      department: assignment.OrganizationName || 'Unknown',
      location: assignment.LocationName || 'Unknown',
      encodedPersonId,
      workRelationshipId,
      encodedAssignmentId,
      locationId: assignment.LocationId,
      departmentId: assignment.OrganizationId,
      businessUnitId: assignment.BusinessUnitId
    };

    console.log('Success payload:', payload);

  } catch(err) {
    console.log('Error:', err.message);
    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Data:', err.response.data);
    }
  }
}
test();
