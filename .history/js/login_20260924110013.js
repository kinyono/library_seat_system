(function () {
    'use strict';

    let currentRole = 'student';

    function switchRole(role) {
        currentRole = role;
        document.querySelectorAll('.role-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === role);
        });
        // 切换 placeholder 提示
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

    document.getElementById('loginForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const errorEl = document.getElementById('loginError');

        if (!username || !password) {
            errorEl.textContent = '请填写完整信息';
            errorEl.style.display = 'block';
            return;
        }

        if (currentRole === 'admin') {
            // 管理员固定账号
            if (username === 'admin' && password === 'admin123') {
                const adminUser = {
                    id: 0,
                    name: '管理员',
                    studentId: 'admin',
                    role: 'admin',
                    credit: 100
                };
                localStorage.setItem('currentUser', JSON.stringify(adminUser));
                window.location.href = 'admin.html';
            } else {
                errorEl.textContent = '管理员账号或密码错误';
                errorEl.style.display = 'block';
            }
        } else {
            // 学生：自动注册/登录
            let users = JSON.parse(localStorage.getItem('lib_users') || '[]');
            let user = users.find(u => u.studentId === username);
            if (!user) {
                // 新用户自动注册
                user = {
                    id: Date.now(),
                    name: '同学' + username.slice(-4),
                    studentId: username,
                    password: password,
                    role: 'student',
                    credit: 100,
                    banned: false
                };
                users.push(user);
                localStorage.setItem('lib_users', JSON.stringify(users));
            } else {
                // 验证密码（如果存储了密码）
                if (user.password && user.password !== password) {
                    errorEl.textContent = '密码错误';
                    errorEl.style.display = 'block';
                    return;
                }
                if (user.banned) {
                    errorEl.textContent = '该账户已被封禁，请联系管理员';
                    errorEl.style.display = 'block';
                    return;
                }
            }
            localStorage.setItem('currentUser', JSON.stringify(user));
            window.location.href = 'pages/dashboard.html';
        }
    });
})();
