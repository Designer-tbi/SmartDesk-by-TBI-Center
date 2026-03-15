async function testDemo() {
  const code = '123456';
  const res = await fetch('http://localhost:3000/api/auth/send-demo-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'Test', prenom: 'User', email: 'test@example.com', telephone: '1234567890', code })
  });
  const data = await res.json();
  console.log('Register Status:', res.status);
  console.log('Register Data:', data);

  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: code, demoMode: true })
  });
  const loginData = await loginRes.json();
  console.log('Login Status:', loginRes.status);
  console.log('Login Data:', loginData);
}

testDemo();
