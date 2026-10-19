(function () {
    'use strict';

    /* ========== 初始化数据 ========== */
    function initData() {
        if (!localStorage.getItem('lib_users')) {
            localStorage.setItem('lib_users', JSON.stringify([]));
        }
        if (!localStorage.getItem('lib_seats')) {
            // 生成默认座位（会在 admin 初始化时再做，这里留空也可）
            localStorage.setItem('lib_seats', JSON.stringify([]));
        }
        if (!localStorage.getItem('lib_bookings')) {
            localStorage.setItem('lib_bookings', JSON.stringify([]));
        }
        if (!localStorage.getItem('lib_rules')) {
            localStorage.setItem('lib_rules', JSON.stringify({
                maxMinutes: 240, graceMinutes: 15, awayMinutes: 45, awayTimes: 3, awayPenalty: 10,
                classMinutes: 120, classTimes: 1, classPenalty: 20, classMinCredit: 80
            }));
        }
    }

    /* ========== 角色切换 ========== */
    document.querySelectorAll('.role-option').forEach(label => {
        label.addEventListener('click', function () {
            document.querySelectorAll('.role-option').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            this.querySelector('input').checked = true;
            // 切换时清空错误
            hideError();
        });
    });

    /* ========== 错误提示 ========== */
    function showError(msg) {
        const el = document.getElementById('loginError');
        el.textContent = msg;
        el.style.display = 'block';
    }
    function hideError() {
        const el = document.getElementById('loginError');
        el.style.display = 'none';
    }

    /* ========== 一键填入 ========== */
    window.fillDemo = function () {
        // 切换到管理员角色
        document.querySelectorAll('.role-option').forEach(l => l.classList.remove('active'));
        const adminOption = document.querySelector('.role-option[data-role="admin"]');
        if (adminOption) {
            adminOption.classList.add('active');
            adminOption.querySelector('input').checked = true;
        }
        document.getElementById('username').value = 'admin';
        document.getElementById('password').value = 'admin123';
        hideError();
    };

    /* ========== 登录处理 ========== */
    document.getElementById('loginForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const roleInput = document.querySelector('input[name="role"]:checked');
        const role = roleInput ? roleInput.value : 'student';
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!username || !password) {
            showError('请输入学号/账号和密码');
            return;
        }

        if (role === 'admin') {
            // 管理员验证（硬编码）
            if (username === 'admin' && password === 'admin123') {
                const user = { id: 0, name: '管理员', username: 'admin', role: 'admin', credit: 100 };
                localStorage.setItem('currentUser', JSON.stringify(user));
                window.location.href = 'admin.html';
            } else {
                showError('管理员账号或密码错误');
            }
        } else {
            // 学生：任意学号+任意密码自动注册/登录
            let users = JSON.parse(localStorage.getItem('lib_users')) || [];
            let user = users.find(u => u.studentId === username);
            if (!user) {
                // 自动注册
                const maxId = users.reduce((m, u) => Math.max(m, u.id), 0);
                user = {
                    id: maxId + 1,
                    name: '学生' + username.slice(-4),
                    studentId: username,
                    password: password,  // 简化处理，实际不应明文存
                    role: 'student',
                    credit: 100,
                    banned: false
                };
                users.push(user);
                localStorage.setItem('lib_users', JSON.stringify(users));
            } else {
                // 检查封禁
                if (user.banned) {
                    showError('该账号已被封禁，请联系管理员');
                    return;
                }
                // 密码验证（可选，这里简化不验证密码）
            }
            const currentUser = {
                id: user.id,
                name: user.name,
                studentId: user.studentId,
                role: 'student',
                credit: user.credit
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            window.location.href = 'pages/dashboard.html';
        }
    });

    /* ========== 初始化 ========== */
    document.addEventListener('DOMContentLoaded', function () {
        initData();
        // 如果已登录则跳转
        const cu = localStorage.getItem('currentUser');
        if (cu) {
            try {
                const user = JSON.parse(cu);
                if (user.role === 'admin') window.location.href = 'admin.html';
                else window.location.href = 'pages/dashboard.html';
            } catch(e) {}
        }
    });
})();
