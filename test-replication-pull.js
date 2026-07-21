

async function testPull(collection) {
    try {
        const loginRes = await fetch('http://localhost:4000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@admin.com', password: 'password' })
        });
        const loginData = await loginRes.json();
        
        if (!loginData.token) {
            console.log('Login failed:', loginData);
            return;
        }

        const pullRes = await fetch(`http://localhost:4000/replication/${collection}/pull?updatedAt=0&id=&batchSize=100`, {
            headers: {
                'Authorization': `Bearer ${loginData.token}`
            }
        });

        if (!pullRes.ok) {
            const text = await pullRes.text();
            console.log(`Failed to pull ${collection}. Status: ${pullRes.status}. Response: ${text}`);
        } else {
            const data = await pullRes.json();
            console.log(`Successfully pulled ${collection}. Count: ${data.documents.length}`);
        }
    } catch (err) {
        console.error(err);
    }
}

async function run() {
    await testPull('users');
    await testPull('saleItems');
    await testPull('payments');
}

run();
