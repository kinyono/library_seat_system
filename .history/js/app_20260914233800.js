document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const role = document.querySelector('input[name="role"]:checked').value;
  const account = document.getElementById('studentId').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!account || !password) {
    alert('请填写账号和密码');
    return;
  }

  // ----- 管理员登录（硬编码演示）-----
  if (role === 'admin') {
    if (account === 'admin' && password === 'admin123') {
      const adminUser = {
        id: 0,
        name: '管理员',
        studentId: 'admin',
        credit: 100,
        banned: false,
        role: 'admin'
      };
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      window.location.href = 'admin.html'; // 直接进后台
    } else {
      alert('管理员账号或密码错误');
    }
    return;
  }

  // ----- 学生登录（原有逻辑）-----
  let users = [];
  try { users = JSON.parse(localStorage.getItem('lib_users')) || []; } catch (_) { users = []; }
  let user = users.find(u => u.studentId === account);
  if (!user) {
    user = {
      id: Date.now(),
      name: '用户' + account.slice(-4),
      studentId: account,
      credit: 100,
      banned: false,
      role: 'student'
    };
    users.push(user);
    localStorage.setItem('lib_users', JSON.stringify(users));
  }
  if (user.banned) {
    alert('该账号已被封禁，请联系管理员');
    return;
  }

  localStorage.setItem('currentUser', JSON.stringify(user));
  window.location.href = 'pages/dashboard.html';
});