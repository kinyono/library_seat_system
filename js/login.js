(function () {
    'use strict';

    let currentRole = 'student';

    function switchRole(role) {
        currentRole = role;
        document.querySelectorAll('.role-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset?.role === role);
        });
        // 兼容 radio 切换：找到对应 radio 并选中
        const radio = document.querySelector(`input[name="role"][value="${role}"]`);
        if (radio) radio.checked = true;
        
        const usernameInput = document.getElementById('username');
        usernameInput.placeholder = role === 'student' ? '请输入学号' : '请输入管理员账号';
        document.getElementById('loginError').style.display = 'none';
    }
    window.switchRole = switchRole;

    function fillDemo(role) {
        switchRole(role);
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        if (role === 'student') {
            usernameInput.value = '2023001';
            passwordInput.value = '123456';
        } else {
            usernameInput.value = 'admin';
            passwordInput.value = 'admin123';
        }
        document.getElementById('loginError').style.display = 'none';
    }
    window.fillDemo = fillDemo;

    document.getElementById('loginForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const errorEl = document.getElementById('loginError');

        if (!username || !password) {
            errorEl.textContent = '请填写完整信息';
            errorEl.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role: currentRole })
            });
            const data = await response.json();

            if (response.ok) {
                // 登录成功：保存 token 和用户信息
                localStorage.setItem('token', data.token);
                localStorage.setItem('currentUser', JSON.stringify(data.user));

                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'pages/dashboard.html';
                }
            } else {
                // 登录失败：显示后端返回的错误信息
                errorEl.textContent = data.error || '登录失败，请检查账号密码';
                errorEl.style.display = 'block';
            }
        } catch (error) {
            console.error('请求失败:', error);
            errorEl.textContent = '网络错误，请确认后端服务已启动（端口3000）';
            errorEl.style.display = 'block';
        }
    });

    // 初始化：如果已登录则自动跳转
    document.addEventListener('DOMContentLoaded', function () {
        const cu = localStorage.getItem('currentUser');
        if (cu) {
            try {
                const user = JSON.parse(cu);
                if (user.role === 'admin') window.location.href = 'admin.html';
                else window.location.href = 'pages/dashboard.html';
            } catch (e) {}
        }
    });
})();