// 管理后台核心逻辑
(function() {
    'use strict';

    // ---------- 初始化 localStorage 数据 ----------
    function initData() {
        if (!localStorage.getItem('seats')) {
            const defaultSeats = [];
            for (let f = 1; f <= 3; f++) {
                for (let r = 1; r <= 6; r++) {
                    defaultSeats.push({
                        id: `${f}-${r}`,
                        code: `${String.fromCharCode(64 + f)}-${String(r).padStart(2, '0')}`,
                        floor: f,
                        area: ['quiet','discuss','window'][Math.floor(Math.random()*3)],
                        hasPower: Math.random() > 0.5,
                        status: 'free',
                        enabled: true
                    });
                }
            }
            localStorage.setItem('seats', JSON.stringify(defaultSeats));
        }
        if (!localStorage.getItem('users')) {
            localStorage.setItem('users', JSON.stringify([
                { id: 1, name: '张三', studentId: '2021001', credit: 95, banned: false },
                { id: 2, name: '李四', studentId: '2021002', credit: 82, banned: false },
                { id: 3, name: '王五', studentId: '2021003', credit: 70, banned: true }
            ]));
        }
        if (!localStorage.getItem('bookings')) {
            localStorage.setItem('bookings', JSON.stringify([
                { id: 1, userId: 1, seatId: '1-1', date: '2026-09-14', slot: '08:00-12:00', status: 'active' },
                { id: 2, userId: 2, seatId: '1-3', date: '2026-09-14', slot: '14:00-18:00', status: 'completed' }
            ]));
        }
        if (!localStorage.getItem('rules')) {
            localStorage.setItem('rules', JSON.stringify({
                maxDuration: 240,
                gracePeriod: 15,
                leaveDuration: 45,
                dailyLeaveLimit: 3,
                leavePenalty: 10,
                classReserveMax: 120,
                dailyClassReserve: 1,
                classReservePenalty: 20,
                minCreditForClass: 80
            }));
        }
    }

    // ---------- 渲染各个选项卡 ----------
    function renderSeatsTab() {
        const container = document.getElementById('tab-content');
        const seats = JSON.parse(localStorage.getItem('seats')) || [];
        let html = `
            <div class="toolbar">
                <input type="text" id="searchSeat" placeholder="搜索座位号..." oninput="renderSeatsTab()">
                <select id="filterFloor" onchange="renderSeatsTab()">
                    <option value="">全部楼层</option>
                    <option value="1">一楼</option>
                    <option value="2">二楼</option>
                    <option value="3">三楼</option>
                </select>
                <select id="filterStatus" onchange="renderSeatsTab()">
                    <option value="">全部状态</option>
                    <option value="free">空闲</option>
                    <option value="used">使用中</option>
                    <option value="away">暂离</option>
                    <option value="reserved">已预约</option>
                    <option value="maintenance">维修</option>
                </select>
                <button onclick="showAddSeatModal()">➕ 添加座位</button>
            </div>
            <table>
                <thead><tr><th>座位号</th><th>楼层</th><th>区域</th><th>电源</th><th>状态</th><th>启用</th><th>操作</th></tr></thead>
                <tbody>
        `;
        const keyword = (document.getElementById('searchSeat')?.value || '').toLowerCase();
        const floorFilter = document.getElementById('filterFloor')?.value || '';
        const statusFilter = document.getElementById('filterStatus')?.value || '';
        seats.forEach(s => {
            if (keyword && !s.code.toLowerCase().includes(keyword)) return;
            if (floorFilter && s.floor != floorFilter) return;
            if (statusFilter && s.status !== statusFilter) return;
            html += `<tr>
                <td>${s.code}</td>
                <td>${s.floor}楼</td>
                <td>${s.area}</td>
                <td>${s.hasPower ? '✅' : '❌'}</td>
                <td><span class="status-badge ${s.status}">${s.status}</span></td>
                <td>${s.enabled ? '✅' : '❌'}</td>
                <td>
                    <button onclick="editSeat('${s.id}')">✏️</button>
                    <button onclick="toggleSeat('${s.id}')">${s.enabled ? '禁用' : '启用'}</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function renderUsersTab() {
        const container = document.getElementById('tab-content');
        const users = JSON.parse(localStorage.getItem('users')) || [];
        let html = `
            <table>
                <thead><tr><th>姓名</th><th>学号</th><th>信用分</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
        `;
        users.forEach(u => {
            html += `<tr>
                <td>${u.name}</td>
                <td>${u.studentId}</td>
                <td>${u.credit}</td>
                <td>${u.banned ? '🚫 封禁' : '✅ 正常'}</td>
                <td><button onclick="toggleBan(${u.id})">${u.banned ? '解封' : '封禁'}</button></td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function renderBookingsTab() {
        const container = document.getElementById('tab-content');
        const bookings = JSON.parse(localStorage.getItem('bookings')) || [];
        let html = `
            <table>
                <thead><tr><th>ID</th><th>用户</th><th>座位</th><th>日期</th><th>时段</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
        `;
        bookings.forEach(b => {
            html += `<tr>
                <td>${b.id}</td>
                <td>用户${b.userId}</td>
                <td>${b.seatId}</td>
                <td>${b.date}</td>
                <td>${b.slot}</td>
                <td>${b.status}</td>
                <td><button onclick="cancelBooking(${b.id})">取消</button></td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function renderRulesTab() {
        const rules = JSON.parse(localStorage.getItem('rules')) || {};
        const container = document.getElementById('tab-content');
        container.innerHTML = `
            <div class="rules-form">
                <label>最长预约时长（分钟）：<input type="number" id="maxDuration" value="${rules.maxDuration}"></label>
                <label>签到宽限时间（分钟）：<input type="number" id="gracePeriod" value="${rules.gracePeriod}"></label>
                <label>暂离最长保留（分钟）：<input type="number" id="leaveDuration" value="${rules.leaveDuration}"></label>
                <label>每日暂离次数：<input type="number" id="dailyLeaveLimit" value="${rules.dailyLeaveLimit}"></label>
                <label>暂离超时扣分：<input type="number" id="leavePenalty" value="${rules.leavePenalty}"></label>
                <label>上课保留最长（分钟）：<input type="number" id="classReserveMax" value="${rules.classReserveMax}"></label>
                <label>每日上课保留次数：<input type="number" id="dailyClassReserve" value="${rules.dailyClassReserve}"></label>
                <label>上课保留超时扣分：<input type="number" id="classReservePenalty" value="${rules.classReservePenalty}"></label>
                <label>上课保留最低信用分：<input type="number" id="minCreditForClass" value="${rules.minCreditForClass}"></label>
                <button onclick="saveRules()">💾 保存规则</button>
            </div>
        `;
    }

    // ---------- 操作函数 ----------
    window.showAddSeatModal = function() {
        const code = prompt('请输入新座位号（如 D-01）：');
        if (!code) return;
        const seats = JSON.parse(localStorage.getItem('seats')) || [];
        const newId = Date.now().toString();
        seats.push({ id: newId, code, floor: 1, area: 'quiet', hasPower: false, status: 'free', enabled: true });
        localStorage.setItem('seats', JSON.stringify(seats));
        renderSeatsTab();
    };

    window.editSeat = function(id) {
        const seats = JSON.parse(localStorage.getItem('seats')) || [];
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        const newCode = prompt('修改座位号：', seat.code);
        if (newCode) seat.code = newCode;
        localStorage.setItem('seats', JSON.stringify(seats));
        renderSeatsTab();
    };

    window.toggleSeat = function(id) {
        const seats = JSON.parse(localStorage.getItem('seats')) || [];
        const seat = seats.find(s => s.id === id);
        if (seat) {
            seat.enabled = !seat.enabled;
            localStorage.setItem('seats', JSON.stringify(seats));
            renderSeatsTab();
        }
    };

    window.toggleBan = function(userId) {
        const users = JSON.parse(localStorage.getItem('users')) || [];
        const user = users.find(u => u.id === userId);
        if (user) {
            user.banned = !user.banned;
            localStorage.setItem('users', JSON.stringify(users));
            renderUsersTab();
        }
    };

    window.cancelBooking = function(bookingId) {
        if (!confirm('确认取消此预约？')) return;
        let bookings = JSON.parse(localStorage.getItem('bookings')) || [];
        bookings = bookings.filter(b => b.id !== bookingId);
        localStorage.setItem('bookings', JSON.stringify(bookings));
        renderBookingsTab();
    };

    window.saveRules = function() {
        const rules = {
            maxDuration: parseInt(document.getElementById('maxDuration').value),
            gracePeriod: parseInt(document.getElementById('gracePeriod').value),
            leaveDuration: parseInt(document.getElementById('leaveDuration').value),
            dailyLeaveLimit: parseInt(document.getElementById('dailyLeaveLimit').value),
            leavePenalty: parseInt(document.getElementById('leavePenalty').value),
            classReserveMax: parseInt(document.getElementById('classReserveMax').value),
            dailyClassReserve: parseInt(document.getElementById('dailyClassReserve').value),
            classReservePenalty: parseInt(document.getElementById('classReservePenalty').value),
            minCreditForClass: parseInt(document.getElementById('minCreditForClass').value)
        };
        localStorage.setItem('rules', JSON.stringify(rules));
        alert('规则已保存！');
    };

    // ---------- 选项卡切换 ----------
    window.switchTab = function(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        switch(tab) {
            case 'seats': renderSeatsTab(); break;
            case 'users': renderUsersTab(); break;
            case 'bookings': renderBookingsTab(); break;
            case 'rules': renderRulesTab(); break;
        }
    };

    // ---------- 启动 ----------
    initData();
    renderSeatsTab();
})();
