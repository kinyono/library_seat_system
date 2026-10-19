(function () {
    'use strict';

    let currentRole = 'student';

    window.switchRole = function(role) {
        currentRole = role;
        // 遍历所有 .role-option，根据 radio value 设置选中和 active 类
        document.querySelectorAll('.role-option').forEach(el => {
            const radio = el.querySelector('input[type="radio"]');
            if (radio && radio.value === role) {
                radio.checked = true;
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        const usernameInput = document.getElementById('username');
        usernameInput.placeholder = role === 'student' ? '请输入学号' : '请输入管理员账号';
        document.getElementById('loginError').style.display = 'none';
    };

    window.fillDemo = function(role) {
        switchRole(role);
        document.getElementById('username').value = (role === 'student') ? '2023001' : 'admin';
        document.getElementById('password').value = (role === 'student') ? '123456' : 'admin123';
        document.getElementById('loginError').style.display = 'none';
    };

    // 初始化默认角色（学生）
    document.addEventListener('DOMContentLoaded', function() {
        switchRole('student');
    });

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
            if (username === 'admin' && password === 'admin123') {
                const adminUser = { id: 0, name: '管理员', studentId: 'admin', role: 'admin', credit: 100 };
                localStorage.setItem('currentUser', JSON.stringify(adminUser));
                window.location.href = 'pages/dashboard.html';
            } else {
                errorEl.textContent = '管理员账号或密码错误';
                errorEl.style.display = 'block';
            }
        } else {
            let users = JSON.parse(localStorage.getItem('lib_users') || '[]');
            let user = users.find(u => u.studentId === username);
            if (!user) {
                user = { id: Date.now(), name: '同学' + username.slice(-4), studentId: username, password: password, role: 'student', credit: 100, banned: false };
                users.push(user);
                localStorage.setItem('lib_users', JSON.stringify(users));
            } else {
                if (user.password && user.password !== password) {
                    errorEl.textContent = '密码错误';
                    errorEl.style.display = 'block';
                    return;
                }
                if (user.banned) {
                    errorEl.textContent = '该账户已被封禁';
                    errorEl.style.display = 'block';
                    return;
                }
            }
            localStorage.setItem('currentUser', JSON.stringify(user));
            window.location.href = 'pages/dashboard.html';
        }
    });
})();