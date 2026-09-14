// 登录表单处理
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault(); // 阻止表单默认提交

    const studentId = document.getElementById('studentId').value.trim();
    const password = document.getElementById('password').value.trim();

    // 简单的前端校验
    if (!studentId || !password) {
        alert('请填写学号和密码');
        return;
    }

    // 模拟登录（后续对接后端接口）
    console.log('登录信息：', { studentId, password });

    // 模拟登录成功跳转
    alert('登录成功！即将跳转到座位预约页面...');
    // window.location.href = 'pages/dashboard.html';  // 后续取消注释
});
