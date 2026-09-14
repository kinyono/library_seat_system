(function() {
    'use strict';

    // ===== 初始化数据 =====
    function initData() {
        // 座位
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
                        status: 'free',
                        enabled: true
                    });
                }
            }
            localStorage.setItem('lib_seats', JSON.stringify(seats));
        }
        // 用户
        if (!localStorage.getItem('lib_users')) {
            localStorage.setItem('lib_users', JSON.stringify([]));
        }
        // 预约
        if (!localStorage.getItem('lib_bookings')) {
            localStorage.setItem('lib_bookings', JSON.stringify([]));
        }
        // 规则
        if (!localStorage.getItem('lib_rules')) {
            const rules = {
                maxMinutes: 240,
                graceMinutes: 15,
                awayMinutes: 45,
                awayTimes: 3,
                awayPenalty: 10,
                classMinutes: 120,
                classTimes: 1,
                classPenalty: 20,
                classMinCredit: 80
            };
            localStorage.setItem('lib_rules', JSON.stringify(rules));
        }
    }

    // ===== 获取数据 =====
    function getSeats() { return JSON.parse(localStorage.getItem('lib_seats')) || []; }
    function setSeats(data) { localStorage.setItem('lib_seats', JSON.stringify(data)); }
    function getUsers() { return JSON.parse(localStorage.getItem('lib_users')) || []; }
    function setUsers(data) { localStorage.setItem('lib_users', JSON.stringify(data)); }
    function getBookings() { return JSON.parse(localStorage.getItem('lib_bookings')) || []; }
    function setBookings(data) { localStorage.setItem('lib_bookings', JSON.stringify(data)); }
    function getRules() { return JSON.parse(localStorage.getItem('lib_rules')) || {}; }
    function setRules(data) { localStorage.setItem('lib_rules', JSON.stringify(data)); }

    // ===== 渲染座位表 =====
    function renderSeats() {
        const tbody = document.getElementById('seatsTableBody');
        if (!tbody) return;
        const seats = getSeats();
        tbody.innerHTML = seats.map(seat => `
            <tr>
                <td>${seat.code}</td>
                <td>${seat.floor}F</td>
                <td>${seat.area}</td>
                <td>${seat.hasPower ? '✅' : '❌'}</td>
                <td>${getStatusText(seat.status)}</td>
                <td>${seat.enabled ? '✅' : '❌'}</td>
                <td class="action-btns">
                    <button class="btn btn-warning" onclick="editSeat(${seat.id})">编辑</button>
                    <button class="btn ${seat.enabled ? 'btn-danger' : 'btn-success'}" onclick="toggleSeat(${seat.id})">
                        ${seat.enabled ? '禁用' : '启用'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function getStatusText(status) {
        const map = { free: '空闲', used: '使用中', away: '暂离', reserved: '已预约', maintenance: '维修' };
        return map[status] || status;
    }

    // ===== 渲染用户表 =====
    function renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        const users = getUsers();
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.studentId}</td>
                <td>${user.credit}</td>
                <td>${user.banned ? '❌ 封禁' : '✅ 正常'}</td>
                <td class="action-btns">
                    <button class="btn ${user.banned ? 'btn-success' : 'btn-danger'}" onclick="toggleBan(${user.id})">
                        ${user.banned ? '解封' : '封禁'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // ===== 渲染预约表 =====
    function renderBookings() {
        const tbody = document.getElementById('bookingsTableBody');
        if (!tbody) return;
        const bookings = getBookings();
        tbody.innerHTML = bookings.map(b => `
            <tr>
                <td>${b.userName}</td>
                <td>${b.seatCode}</td>
                <td>${b.date}</td>
                <td>${b.slot}</td>
                <td>${b.status === 'active' ? '进行中' : b.status === 'checked_in' ? '已签到' : '已取消'}</td>
                <td class="action-btns">
                    ${b.status === 'active' ? `<button class="btn btn-danger" onclick="cancelBooking(${b.id})">取消</button>` : '-'}
                </td>
            </tr>
        `).join('');
    }

    // ===== 选项卡切换 =====
    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === 'tab-' + tabName);
        });
        // 每次切换时刷新对应表格
        if (tabName === 'seats') renderSeats();
        else if (tabName === 'users') renderUsers();
        else if (tabName === 'bookings') renderBookings();
        else if (tabName === 'rules') loadRules();
    }

    // ===== 规则加载与保存 =====
    function loadRules() {
        const rules = getRules();
        document.getElementById('ruleMaxMinutes').value = rules.maxMinutes || 240;
        document.getElementById('ruleGraceMinutes').value = rules.graceMinutes || 15;
        document.getElementById('ruleAwayMinutes').value = rules.awayMinutes || 45;
        document.getElementById('ruleAwayTimes').value = rules.awayTimes || 3;
        document.getElementById('ruleAwayPenalty').value = rules.awayPenalty || 10;
        document.getElementById('ruleClassMinutes').value = rules.classMinutes || 120;
        document.getElementById('ruleClassTimes').value = rules.classTimes || 1;
        document.getElementById('ruleClassPenalty').value = rules.classPenalty || 20;
        document.getElementById('ruleClassMinCredit').value = rules.classMinCredit || 80;
    }

    window.saveRules = function() {
        const rules = {
            maxMinutes: parseInt(document.getElementById('ruleMaxMinutes').value) || 240,
            graceMinutes: parseInt(document.getElementById('ruleGraceMinutes').value) || 15,
            awayMinutes: parseInt(document.getElementById('ruleAwayMinutes').value) || 45,
            awayTimes: parseInt(document.getElementById('ruleAwayTimes').value) || 3,
            awayPenalty: parseInt(document.getElementById('ruleAwayPenalty').value) || 10,
            classMinutes: parseInt(document.getElementById('ruleClassMinutes').value) || 120,
            classTimes: parseInt(document.getElementById('ruleClassTimes').value) || 1,
            classPenalty: parseInt(document.getElementById('ruleClassPenalty').value) || 20,
            classMinCredit: parseInt(document.getElementById('ruleClassMinCredit').value) || 80
        };
        setRules(rules);
        alert('规则已保存');
    };

    // ===== 座位操作 =====
    window.editSeat = function(id) {
        const seats = getSeats();
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        const newFloor = prompt('楼层 (1-3):', seat.floor);
        if (newFloor === null) return;
        const newArea = prompt('区域 (quiet/discuss/window):', seat.area);
        if (newArea === null) return;
        const newPower = confirm('是否有电源？确定=是，取消=否');
        seat.floor = parseInt(newFloor) || seat.floor;
        seat.area = newArea || seat.area;
        seat.hasPower = newPower;
        setSeats(seats);
        renderSeats();
    };

    window.toggleSeat = function(id) {
        const seats = getSeats();
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        seat.enabled = !seat.enabled;
        if (!seat.enabled && seat.status !== 'free') {
            seat.status = 'free';
        }
        setSeats(seats);
        renderSeats();
    };

    window.showAddSeatForm = function() {
        const floor = prompt('楼层 (1-3):', '1');
        if (!floor) return;
        const area = prompt('区域 (quiet/discuss/window):', 'quiet');
        if (!area) return;
        const power = confirm('是否有电源？确定=是，取消=否');
        const seats = getSeats();
        const maxId = seats.reduce((max, s) => Math.max(max, s.id), 0);
        const newSeat = {
            id: maxId + 1,
            code: String.fromCharCode(64 + parseInt(floor)) + '-' + String(seats.filter(s => s.floor === parseInt(floor)).length + 1).padStart(2, '0'),
            floor: parseInt(floor),
            area: area,
            hasPower: power,
            status: 'free',
            enabled: true
        };
        seats.push(newSeat);
        setSeats(seats);
        renderSeats();
    };

    // ===== 用户操作 =====
    window.toggleBan = function(id) {
        const users = getUsers();
        const user = users.find(u => u.id === id);
        if (!user) return;
        user.banned = !user.banned;
        setUsers(users);
        renderUsers();
    };

    // ===== 预约操作 =====
    window.cancelBooking = function(id) {
        if (!confirm('确认取消该预约？')) return;
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === id);
        if (!booking) return;
        booking.status = 'cancelled';
        setBookings(bookings);
        // 释放座位
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        if (seat && seat.status === 'reserved') {
            seat.status = 'free';
            setSeats(seats);
        }
        renderBookings();
    };

    // ===== 页面初始化 =====
    document.addEventListener('DOMContentLoaded', function() {
        initData();

        // 选项卡点击事件
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                switchTab(this.dataset.tab);
            });
        });

        // 默认显示第一个选项卡（座位管理）
        switchTab('seats');
    });
})();
