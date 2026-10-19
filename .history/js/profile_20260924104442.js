(function () {
    'use strict';

    function getUsers()      { return JSON.parse(localStorage.getItem('lib_users')    || '[]'); }
    function setUsers(v)     { localStorage.setItem('lib_users', JSON.stringify(v)); }
    function getBookings()   { return JSON.parse(localStorage.getItem('lib_bookings') || '[]'); }
    function getCurrentUser(){ return JSON.parse(localStorage.getItem('currentUser')); }

    const STATUS_MAP = {
        active: { text: '待签到', cls: 'status-active' },
        checked_in: { text: '使用中', cls: 'status-used' },
        away: { text: '暂离', cls: 'status-away' },
        class_reserve: { text: '上课保留', cls: 'status-class' },
        cancelled: { text: '已取消', cls: 'status-cancelled' },
        completed: { text: '已完成', cls: 'status-completed' }
    };

    let currentUser = getCurrentUser();

    function init() {
        if (!currentUser) { window.location.href = '../index.html'; return; }
        fillUserInfo();
        loadHistory();
    }

    function fillUserInfo() {
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userStudentId').textContent = '学号: ' + (currentUser.studentId || '-');
        document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '管理员' : '学生';
        document.getElementById('userRoleText').textContent = currentUser.role === 'admin' ? '管理员' : '学生';
        document.getElementById('userCredit').textContent = currentUser.credit ?? 100;
        document.getElementById('creditBarFill').style.width = (currentUser.credit ?? 100) + '%';
        const initial = (currentUser.name || '学')[0];
        document.getElementById('avatarInitial').textContent = initial;
    }

    function loadHistory() {
        const filter = document.getElementById('historyFilter').value;
        let bookings = getBookings().filter(b => b.userId === currentUser.id);
        if (filter === 'active') {
            bookings = bookings.filter(b => ['active','checked_in','away','class_reserve'].includes(b.status));
        } else if (filter === 'cancelled') {
            bookings = bookings.filter(b => b.status === 'cancelled');
        } else if (filter === 'completed') {
            bookings = bookings.filter(b => b.status === 'completed');
        }
        // 按时间降序排列
        bookings.sort((a,b) => new Date(b.createTime || 0) - new Date(a.createTime || 0));

        const container = document.getElementById('historyList');
        if (!bookings.length) {
            container.innerHTML = '<div class="history-empty">暂无预约记录</div>';
            return;
        }
        container.innerHTML = bookings.map(b => {
            const info = STATUS_MAP[b.status] || { text: b.status, cls: '' };
            const dateStr = b.date ? b.date + (b.slot ? ' ' + b.slot : '') : b.createTime ? new Date(b.createTime).toLocaleString() : '-';
            return `<div class="history-item">
                <div class="hi-left">
                    <span class="hi-seat">${b.seatCode}</span>
                    <span class="hi-date">${dateStr}</span>
                </div>
                <span class="hi-status ${info.cls}">${info.text}</span>
            </div>`;
        }).join('');
    }
    window.loadHistory = loadHistory;

    /* ===== 修改密码 ===== */
    window.showChangePassword = function () {
        document.getElementById('passwordModal').style.display = 'flex';
    };
    window.closePasswordModal = function () {
        document.getElementById('passwordModal').style.display = 'none';
    };

    document.getElementById('passwordForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const fd = new FormData(this);
        const oldPass = fd.get('oldPassword');
        const newPass = fd.get('newPassword');
        const confirmPass = fd.get('confirmPassword');

        if (newPass !== confirmPass) {
            toast('两次输入的新密码不一致', 'error');
            return;
        }
        if (newPass.length < 6) {
            toast('新密码至少6位', 'error');
            return;
        }

        const users = getUsers();
        const user = users.find(u => u.id === currentUser.id);
        if (!user) {
            toast('用户数据异常', 'error');
            return;
        }
        // 验证原密码（对于学生，可能没有密码字段，跳过验证）
        if (user.password && user.password !== oldPass) {
            toast('原密码错误', 'error');
            return;
        }
        user.password = newPass;
        setUsers(users);
        // 更新当前用户缓存
        currentUser = getCurrentUser(); // 刷新
        closePasswordModal();
        this.reset();
        toast('密码修改成功', 'success');
    });

    /* ===== Toast 辅助 ===== */
    function toast(msg, type) {
        type = type || 'info';
        const old = document.querySelector('.toast');
        if (old) old.remove();
        const t = document.createElement('div');
        t.className = 'toast toast-' + type;
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 310); }, 2150);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
