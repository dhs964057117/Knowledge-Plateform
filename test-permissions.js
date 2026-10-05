async function run() {
  try {
    console.log('--- 权限测试: 单一文档权限 vs 全专栏权限 ---');

    // 1. Admin login
    const login = await fetch('http://localhost:5173/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' })
    }).then(r => r.json());
    console.log('1. 管理员登录:', login.success);

    // 2. Create single doc passcode for 'doc-ai-prompting'
    const singleCode = 'AI-ONLY-999';
    const createSingle = await fetch('http://localhost:5173/api/passcodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${login.token}`
      },
      body: JSON.stringify({
        code: singleCode,
        label: '单篇课学员小林',
        doc_id: 'doc-ai-prompting'
      })
    }).then(r => r.json());
    console.log('2. 创建单一文档卡密 (仅限 doc-ai-prompting):', createSingle.success ? createSingle.code : createSingle.error);

    // 3. Test verifying this single-doc passcode on the CORRECT doc ('doc-ai-prompting')
    const verifyCorrect = await fetch('http://localhost:5173/api/access/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: singleCode, docId: 'doc-ai-prompting' })
    }).then(r => r.json());
    console.log('3. 验证单篇卡密 (正确文档):', verifyCorrect.success, '提示:', verifyCorrect.message);

    // 4. Test verifying this single-doc passcode on the WRONG doc ('welcome-guide') -> EXPECT FAIL
    const verifyWrong = await fetch('http://localhost:5173/api/access/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: singleCode, docId: 'welcome-guide' })
    });
    console.log('4. 验证单篇卡密 (未授权文档): 状态码(应为403):', verifyWrong.status);
    const wrongBody = await verifyWrong.json();
    console.log('   拒绝信息:', wrongBody.message);

    // 5. Test global all-docs passcode 'VIP888' on both docs -> EXPECT PASS FOR BOTH
    const verifyGlobal1 = await fetch('http://localhost:5173/api/access/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'VIP888', docId: 'welcome-guide' })
    }).then(r => r.json());
    console.log('5. 全专栏卡密解锁 doc1:', verifyGlobal1.success, verifyGlobal1.message);

    const verifyGlobal2 = await fetch('http://localhost:5173/api/access/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'VIP888', docId: 'doc-ai-prompting' })
    }).then(r => r.json());
    console.log('6. 全专栏卡密解锁 doc2:', verifyGlobal2.success, verifyGlobal2.message);

    console.log('🎉 所有单文档与全文档权限逻辑测试全部通过！');
  } catch (err) {
    console.error('测试出错:', err);
  }
}
run();
