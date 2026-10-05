async function run() {
  try {
    const settings = await fetch('http://localhost:5173/api/settings').then(r => r.json());
    console.log('✅ Settings site_name:', settings.site_name);

    const docs = await fetch('http://localhost:5173/api/docs').then(r => r.json());
    console.log('✅ Public Docs count:', docs.length, docs.map(d => d.title));

    // Try accessing VIP doc without key: expect 401
    const lockedRes = await fetch('http://localhost:5173/api/docs/welcome-guide');
    console.log('✅ Locked VIP Doc status (expect 401):', lockedRes.status);
    const lockedBody = await lockedRes.json();
    console.log('✅ Locked response isAuthorized:', lockedBody.isAuthorized);

    // Verify VIP code
    const verify = await fetch('http://localhost:5173/api/access/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'VIP888' })
    }).then(r => r.json());
    console.log('✅ VIP Verify result:', verify.success, 'Label:', verify.label);

    // Direct link with ?key=VIP888
    const unlockedDoc = await fetch('http://localhost:5173/api/docs/welcome-guide?key=VIP888').then(r => r.json());
    console.log('✅ Direct key VIP Unlocked doc title:', unlockedDoc.title, 'isAuthorized:', unlockedDoc.isAuthorized);

    // Admin login
    const login = await fetch('http://localhost:5173/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' })
    }).then(r => r.json());
    console.log('✅ Admin login result:', login.success, 'Token prefix:', login.token?.substring(0, 15));

    // Admin get stats
    const stats = await fetch('http://localhost:5173/api/stats', {
      headers: { 'Authorization': `Bearer ${login.token}` }
    }).then(r => r.json());
    console.log('✅ Admin stats:', stats);

  } catch (err) {
    console.error('Test failed:', err);
  }
}
run();
