import https from 'https';

const postData = JSON.stringify({
  firstname: '',
  surname: '',
  registrationNumber: '',
  postcode: 'SW1A 1AA',
  radius: 50,
  serviceProvided: [],
  areaOfWork: [],
  perPage: 50,
  page: 1
});

const options = {
  hostname: 'www.associationfornutrition.org',
  path: '/wp-json/afn/registrants/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/json'
  }
};

console.log('Making API request...');
console.log('URL:', `https://${options.hostname}${options.path}`);

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\nResponse length:', data.length);
    try {
      const response = JSON.parse(data);
      console.log('\nParsed response:');
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Failed to parse JSON:', error.message);
      console.log('\nRaw response:');
      console.log(data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(postData);
req.end();
