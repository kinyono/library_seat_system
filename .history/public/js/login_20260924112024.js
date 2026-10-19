// ===== 角色切换 =====
function switchRole(role) {
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });
    // 清空输入框
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ===== 快速填入演示账号 =====
function fillDemo(role) {
    if (role === 'admin') {
        document.getElementById('username').value = 'admin';
        document.getElementById('password').value = 'admin123';
        switchRole('admin');
    } else {
        // 学生演示：随机生成学号
        const demoId = '2024' + String(Math.floor(100000 + Math.random() * 900000));
        document.getElementById('username').value = demoId;
        document.getElementById('password').value = '123456';
        switchRole('student');
    }
}

// ===== 处理登录 =====
function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.querySelector('.role-btn.active').dataset.role;

    if (!username || !password) {
        alert('请输入学号和密码');
        return;
    }

    // 管理员固定账号
    if (role === 'admin') {
        if (username === 'admin' && password === 'admin123') {
            loginSuccess({
                id: 'admin',
                name: '管理员',
                role: 'admin',
                credit: 100
            });
            return;
        } else {
            alert('管理员账号或密码错误');
            return;
        }
    }

    // 学生登录/自动注册
    let users = JSON.parse(localStorage.getItem('lib_users') || '[]');
    let user = users.find(u => u.studentId === username);

    if (user) {
        // 已有账号，验证密码（简化：密码存明文）
        if (user.password !== password) {
            alert('密码错误');
            return;
        }
    } else {
        // 自动注册
        user = {
            id: Date.now(),
            studentId: username,
            name: '同学' + username.slice(-4),
            password: password,
            role: 'student',
            credit: 100,
            createTime: new Date().toISOString()
        };
        users.push(user);
        localStorage.setItem('lib_users', JSON.stringify(users));
    }

    loginSuccess(user);
}

// ===== 登录成功后跳转 =====
function loginSuccess(user) {
    // 保存当前用户
    localStorage.setItem('currentUser', JSON.stringify(user));

    // 根据角色跳转
    if (user.role === 'admin') {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'pages/dashboard.html';
    }
}

// ===== 页面加载时默认选中学生 =====
document.addEventListener('DOMContentLoaded', function () {
    // 如果已经有登录状态，直接跳转
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) {
        if (currentUser.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'pages/dashboard.html';
        }
    }
});
