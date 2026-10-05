async function testImage() {
  try {
    const login = await fetch('http://localhost:5173/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' })
    }).then(r => r.json());

    const testImgBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';
    const testHtml = `<h2>图片测试</h2><p>下面是一张测试图片：</p><img src="${testImgBase64}" alt="test" /><p>结束</p>`;

    // Create doc with image
    const create = await fetch('http://localhost:5173/api/docs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${login.token}`
      },
      body: JSON.stringify({
        title: '图文混排图片测试文档',
        content_html: testHtml,
        is_published: 1,
        is_vip_only: 0
      })
    }).then(r => r.json());

    console.log('创建文档结果:', create.success, 'ID:', create.id);

    // Fetch doc back
    const fetched = await fetch(`http://localhost:5173/api/docs/${create.id}`).then(r => r.json());
    const hasImage = fetched.content_html && fetched.content_html.includes(testImgBase64);
    console.log('获取已发布文档中是否完整包含图片数据:', hasImage);
    console.log('图片标签预览:', fetched.content_html.substring(0, 180));

    // Clean up
    await fetch(`http://localhost:5173/api/docs/${create.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${login.token}` }
    });
    console.log('清理测试文档完成');
  } catch (err) {
    console.error('Test error:', err);
  }
}

testImage();
