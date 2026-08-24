const http = require('http');

const req = http.request({
  host: 'localhost',
  port: 59608,
  path: '/api/documents?pageIndex=0&pageSize=10',
  method: 'GET'
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(body));
});
req.on('error', e => console.error(e));
req.end();
