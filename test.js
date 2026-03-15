async function test() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'eden@tbi-center.fr', password: 'loub@ki2014D', demoMode: false })
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Data:', data);
}

test();
