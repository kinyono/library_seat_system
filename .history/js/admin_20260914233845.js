// 管理后台逻辑
(function () {
    'use strict';

    // ===== 初始化模拟数据 =====
    function initData() {
        if (!localStorage.getItem('lib_seats')) {
            const seats = [];
            const areas = ['quiet', 'discuss', 'window'];
            for (let f = 1; f <= 3; f++) {
                for (let i = 1; i <= 6; i++) {
                    seats.push({
                        id: (f - 1) * 6 + i,
                        code: String.fromCharCode(64 + f) + '-' + String(i).padStart(2, '0'),
                        floor: f,
                        area: areas[Math.floor(Math.random() * 3)],
                        hasPower: Math.random() > 0.5,
                        status: ['free', 'free', 'used', 'free', 'away', 'free'][i - 1],
                        enabled: true
                    });
                }
            }
            localStorage.setItem('lib_seats', JSON.stringify(seats));
        }
        if (!localStorage.getItem('lib_users')) {
            localStorage.setItem('lib_users', JSON.stringify([
                { id: 1, name: '张三', studentId: '2021001', credit: 100, banned: false },
                { id: 2, name: '李四', studentId: '2021002', credit: 85, banned: false },
                { id: 3, name: '王五', studentId: '2021003', credit: 60, banned: true }
            ]));
        }
        if (!localStorage.getItem('lib_bookings')) {
            localStorage.setItem('lib_bookings', JSON.stringify([
                { id: 1, userId: 1, seatCode: 'A-01', date: '2026-09-14', slot: '08:00-12:00', status: 'checked_in' },
                { id: 2, userId: 2, seatCode: 'A-02', date: '2026-09-14', slot: '14:00-18:00', status: 'no_show' }
            ]));
        }
    }

    // ===== 渲染框架（顶部 + 选项卡） =====
    function renderFrame(activeTab) {
        const app = document.getElementById('app');
        app.innerHTML = `
            <img src="https://placehold.co/600x120/667eea/ffffff?text=Library+Seat+Management" alt="头图" class="header-img">
            <h1>管理后台</h1>
            <div class="tabs">
                <button class="tab-btn ${activeTab === 'seats' ? 'active' : ''}" onclick="switchTab('seats')">🪑 座位管理</button>
                <button class="tab-btn ${activeTab === 'users' ? 'active' : ''}" onclick="switchTab('users')">👥 用户管理</button>
                <button class="tab-btn ${activeTab === 'bookings' ? 'active' : ''}" onclick="switchTab('bookings')">📋 预约记录</button>
            </div>
            <div id="tab-content"></div>
        `;
    }

    // ===== 选项卡内容渲染 =====
    window.switchTab = function (tab) {
        renderFrame(tab);
        const container = document.getElementById('tab-content');
        if (tab === 'seats') {
            const seats = JSON.parse(localStorage.getItem('lib_seats')) || [];
            let html = `<div class="toolbar"><button onclick="addSeat()">➕ 添加座位</button></div><table>
                <thead><tr><th>座位号</th><th>楼层</th><th>区域</th><th>电源</th><th>状态</th><th>操作</th></tr></thead><tbody>`;
            seats.forEach(s => {
                html += `<tr>
                    <td>${s.code}</td>
                    <td>${s.floor}楼</td>
                    <td>${s.area}</td>
                    <td>${s.hasPower ? '✅' : '❌'}</td>
                    <td><span class="status-badge ${s.status}">${s.status}</span></td>
                    <td>
                        <button onclick="editSeat(${s.id})">✏️编辑</button>
                        <button onclick="toggleSeat(${s.id})">${s.enabled ? '🚫禁用' : '✅启用'}</button>
                    </td>
                </tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;

        } else if (tab === 'users') {
            const users = JSON.parse(localStorage.getItem('lib_users')) || [];
            let html = '<table><thead><tr><th>姓名</th><th>学号</th><th>信用分</th><th>状态</th><th>操作</th></tr></thead><tbody>';
            users.forEach(u => {
                html += `<tr>
                    <td>${u.name}</td>
                    <td>${u.studentId}</td>
                    <td>${u.credit}</td>
                    <td>${u.banned ? '🚫封禁' : '✅正常'}</td>
                    <td><button onclick="toggleBan(${u.id})">${u.banned ? '解封' : '封禁'}</button></td>
                </tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;

        } else if (tab === 'bookings') {
            const bookings = JSON.parse(localStorage.getItem('lib_bookings')) || [];
            let html = '<table><thead><tr><th>ID</th><th>用户</th><th>座位</th><th>日期</th><th>时段</th><th>状态</th><th>操作</th></tr></thead><tbody>';
            bookings.forEach(b => {
                html += `<tr>
                    <td>${b.id}</td>
                    <td>用户${b.userId}</td>
                    <td>${b.seatCode}</td>
                    <td>${b.date}</td>
                    <td>${b.slot}</td>
                    <td>${b.status}</td>
                    <td><button onclick="cancelBooking(${b.id})">取消</button></td>
                </tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }
    };

    // ===== 操作函数 =====
    window.addSeat = function () {
        const code = prompt('请输入座位号（如 D-01）：');
        if (!code) return;
        const seats = JSON.parse(localStorage.getItem('lib_seats')) || [];
        seats.push({ id: Date.now(), code, floor: 1, area: 'quiet', hasPower: false, status: 'free', enabled: true });
        localStorage.setItem('lib_seats', JSON.stringify(seats));
        switchTab('seats');
    };

    window.editSeat = function (id) {
        const seats = JSON.parse(localStorage.getItem('lib_seats')) || [];
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        const newCode = prompt('修改座位号：', seat.code);
        if (newCode) seat.code = newCode;
        localStorage.setItem('lib_seats', JSON.stringify(seats));
        switchTab('seats');
    };

    window.toggleSeat = function (id) {
        const seats = JSON.parse(localStorage.getItem('lib_seats')) || [];
        const seat = seats.find(s => s.id === id);
        if (seat) seat.enabled = !seat.enabled;
        localStorage.setItem('lib_seats', JSON.stringify(seats));
        switchTab('seats');
    };

    window.toggleBan = function (userId) {
        const users = JSON.parse(localStorage.getItem('lib_users')) || [];
        const user = users.find(u => u.id === userId);
        if (user) user.banned = !user.banned;
        localStorage.setItem('lib_users', JSON.stringify(users));
        switchTab('users');
    };

    window.cancelBooking = function (id) {
        if (!confirm('确认取消此预约？')) return;
        let bookings = JSON.parse(localStorage.getItem('lib_bookings')) || [];
        bookings = bookings.filter(b => b.id !== id);
        localStorage.setItem('lib_bookings', JSON.stringify(bookings));
        switchTab('bookings');
    };

    // ===== 启动 =====
    initData();
    switchTab('seats');
})();
