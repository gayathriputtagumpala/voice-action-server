const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'scratch', 'describe_assignment.json');
if (!fs.existsSync(filePath)) {
  console.log('describe_assignment.json not found!');
  return;
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const resources = data.Resources || data.resources;
const resName = Object.keys(resources)[0];
const resource = resources[resName];

const item = resource.item || resource;
const attributes = item.attributes || [];

console.log('Total assignment attributes:', attributes.length);
const matches = [];
for (const attr of attributes) {
  const name = attr.name.toLowerCase();
  const desc = (attr.annotations?.description || '').toLowerCase();
  if (name.includes('mgr') || name.includes('super') || name.includes('lead') || name.includes('parent') || desc.includes('mgr') || desc.includes('super') || desc.includes('supervisor') || desc.includes('manager')) {
    matches.push(attr);
  }
}

console.log(`\nFound ${matches.length} supervisor/manager related attributes in assignment describe:`);
for (const m of matches) {
  console.log(`- ${m.name} (${m.type}) [Required: ${m.required}, Updatable: ${m.updatable}]`);
  if (m.annotations?.description) {
    console.log(`  Description: ${m.annotations.description}`);
  }
}
