const text1 = "show deatails for employee 14";
const text2 = "give person number 1406 details";

function test(text) {
  const numbers = text.match(/\d{1,6}/g) || [];
  const personMatch = text.match(/(?:person|employee|number|no|id)\s*(\d{1,6})/i);
  const personNumber = personMatch ? personMatch[1] : (numbers.length > 0 ? numbers[0] : null);
  console.log(`text: "${text}"`);
  console.log(`numbers:`, numbers);
  console.log(`personMatch:`, personMatch ? personMatch[1] : null);
  console.log(`personNumber:`, personNumber);
  console.log('---');
}

test(text1);
test(text2);
