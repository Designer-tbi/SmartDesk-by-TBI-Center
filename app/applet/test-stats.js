import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const token = JSON.parse(data).token;
    
    const statsReq = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stats',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log('Status:', res2.statusCode);
        console.log('Response:', data2);
      });
    });
    statsReq.end();
  });
});

req.write(JSON.stringify({ email: 'admin@smartdesk.cg', password: 'admin', demoMode: true }));
req.end();
