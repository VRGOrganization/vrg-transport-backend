const fs = require('fs');
const path = require('path');
const payloadPath = path.join(__dirname, 'test_payload.json');
const outPath = path.join(__dirname, 'license_result.png');
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
    const contentType = res.headers.get('content-type');
    console.log('content-type', contentType);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.image) {
        const buf = Buffer.from(json.image, 'base64');
        fs.writeFileSync(outPath, buf);
        console.log('saved', outPath, 'bytes', buf.length);
      } else {
        console.log('no image field in JSON');
        console.log(text.slice(0,1000));
      }
    } catch (e) {
      console.log('response is not JSON; saving raw body to file');
      const buf = Buffer.from(text, 'binary');
      fs.writeFileSync(outPath, buf);
      console.log('saved raw file', outPath, 'bytes', buf.length);
    }
  } catch (err) {
    console.error('error', err);
  }
})();
