alert('✅ JS 已加载！');

document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  alert('🟡 表单已提交');
  
  const studentId = document.getElementById('studentId').value.trim();
  const password = document.getElementById('password').value.trim();
  
  if (!studentId || !password) { 
    alert('❌ 请填写学号和密码'); 
    return; 
  }

  let users = JSON.parse(localStorage.getItem('lib_users')) || [];
  let user = users.find(u => u.studentId === studentId);
  
  if (!user) {
    user = { id: Date.now(), name: '用户' + studentId.slice(-4), studentId, credit: 100, banned: false };
    users.push(user);
    localStorage.setItem('lib_users', JSON.stringify(users));
  }
  
  localStorage.setItem('currentUser', JSON.stringify(user));
  alert('🟢 写入完成，准备跳转');
  window.location.href = 'pages/dashboard.html';
});
