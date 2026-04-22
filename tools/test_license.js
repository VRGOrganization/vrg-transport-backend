const fs = require('fs');
const path = require('path');
const payloadPath = path.join(__dirname, 'test_payload.json');
const data = fs.readFileSync(payloadPath, 'utf8');

(async () => {
  try {
    const res = await fetch('http://localhost:8000/api/v1/license/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': 'teste-123'
      },
      body: data
    });
    console.log('status', res.status);
    console.log('content-type', res.headers.get('content-type'));
    const text = await res.text();
    console.log('body (truncated):');
    console.log(text.slice(0, 2000));
  } catch (err) {
    console.error('error', err);
  }
})();
