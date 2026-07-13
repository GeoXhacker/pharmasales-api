const fetch = require('node-fetch');

async function test() {
  const loginRes = await fetch('http://localhost:4000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@pharmasales.com', password: 'password123' })
  });
  const { accessToken } = await loginRes.json();
  
  const pullRes = await fetch('http://localhost:4000/admin/branches/all', {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  console.log('Branches:', await pullRes.json());
  
  const batchesRes = await fetch('http://localhost:4000/replication/stockBatches/pull', {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  console.log('Batches:', await batchesRes.json());
}
test();
