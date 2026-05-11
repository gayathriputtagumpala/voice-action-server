const auth = Buffer.from('user_r14_a2f:hT8?2sU?').toString('base64');
console.log('Encoded:', auth);
console.log('Decoded:', Buffer.from(auth, 'base64').toString());
