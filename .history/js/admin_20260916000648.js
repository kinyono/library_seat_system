(function() {
    'use strict';

    const ACTIVE_STATUS = ['active', 'checked_in', 'away', 'class_reserve'];

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
                        status: 'free',
                        enabled: true
                    });
                }
            }
            localStorage.setItem('lib_seats', JSON.stringify(seats));
        }
        if (!localStorage.getItem('lib_users')) {
            localStorage.setItem('lib_users', JSON.stringify([]));
        }
        if (!localStorage.getItem('lib_bookings')) {
            localStorage.setItem('lib_bookings', JSON.stringify([]));
        }
        if (!localStorage.getItem('lib_rules')) {
            const rules = { maxMinutes: 240, graceMinutes: 15, awayMinutes: 45, awayTimes: 3, awayPenalty: 10, classMinutes: 120, classTimes: 1, classPenalty: 20, classMinCredit: 80 };
            localStorage.setItem('lib_rules', JSON.stringify(rules));
        }
    }

    function getSeats() { return JSON.parse(localStorage.getItem('lib_seats')) || []; }
    function setSeats(d) { localStorage.setItem('lib_seats', JSON.stringify(d)); }
    function getUsers() { return JSON.parse(localStorage.getItem('lib_users')) || []; }
    function setUsers(d) { localStorage.setItem('lib_users', JSON.stringify(d)); }
    function getBookings() { return JSON.parse(localStorage.getItem('lib_bookings')) || []; }
    function setBookings(d) { localStorage.setItem('lib_bookings', JSON.stringify(d)); }
    function getRules() { return JSON.parse(localStorage.getItem('lib_rules')) || {}; }
    function setRules(d) { localStorage.setItem('lib_rules', JSON.stringify(d)); }

    function hasActiveBooking(userId) {
        return getBookings().some(b => b.userId === userId && ACTIVE_STATUS.includes(b.status));
    }

    function renderSeats() {
        const tbody = document.getElementById('seatsTableBody');
        if (!tbody) return;
        const seats = getSeats();
        const statusMap = { free: '空闲', used: '使用中', away: '暂离', reserved: '已预约', maintenance: '维修' };
        tbody.innerHTML = seats.map(s => `
            <tr>
                <td>${s.code}</td>
                <td>${s.floor}F</td>
                <td>${s.area}</td>
                <td>${s.hasPower ? '✅' : '❌'}</td>
                <td>${statusMap[s.status] || s.status}</td>
                <td>${s.enabled ? '✅' : '❌'}</td>
                <td class="action-btns">
                    <button class="btn btn-warning" onclick="editSeat(${s.id})">编辑</button>
                    <button class="btn ${s.enabled?'btn-danger':'btn-success'}" onclick="toggleSeat(${s.id})">${s.enabled?'禁用':'启用'}</button>
                </td>
            </tr>
        `).join('');
    }

    function renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        const users = getUsers();
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.name}</td>
                <td>${u.studentId}</td>
                <td>${u.credit}</td>
                <td>${u.banned ? '❌ 封禁' : '✅ 正常'}</td>
                <td class="action-btns">
                    <button class="btn ${u.banned?'btn-success':'btn-danger'}" onclick="toggleBan(${u.id})">${u.banned?'解封':'封禁'}</button>
                </td>
            </tr>
        `).join('');
    }

    function renderBookings() {
        const tbody = document.getElementById('bookingsTableBody');
        if (!tbody) return;
        const bookings = getBookings();
        const statusMap = { active: '待签到', checked_in: '使用中', away: '暂离', class_reserve: '上课保留', cancelled: '已取消' };
        tbody.innerHTML = bookings.map(b => `
            <tr>
                <td>${b.userName}</td>
                <td>${b.seatCode}</td>
                <td>${b.date}</td>
                <td>${b.slot}</td>
                <td>${statusMap[b.status] || b.status}</td>
                <td class="action-btns">
                    ${ACTIVE_STATUS.includes(b.status) ? `<button class="btn btn-danger" onclick="cancelBooking(${b.id})">取消</button>` : '-'}
                </td>
            </tr>
        `).join('');
    }

    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tabName));
        if (tabName === 'seats') renderSeats();
        else if (tabName === 'users') renderUsers();
        else if (tabName === 'bookings') renderBookings();
        else if (tabName === 'rules') loadRules();
    }

    function loadRules() {
        const r = getRules();
        document.getElementById('ruleMaxMinutes').value = r.maxMinutes || 240;
        document.getElementById('ruleGraceMinutes').value = r.graceMinutes || 15;
        document.getElementById('ruleAwayMinutes').value = r.awayMinutes || 45;
        document.getElementById('ruleAwayTimes').value = r.awayTimes || 3;
        document.getElementById('ruleAwayPenalty').value = r.awayPenalty || 10;
        document.getElementById('ruleClassMinutes').value = r.classMinutes || 120;
        document.getElementById('ruleClassTimes').value = r.classTimes || 1;
        document.getElementById('ruleClassPenalty').value = r.classPenalty || 20;
        document.getElementById('ruleClassMinCredit').value = r.classMinCredit || 80;
    }

    window.saveRules = function() {
        const rules = {
            maxMinutes: +document.getElementById('ruleMaxMinutes').value || 240,
            graceMinutes: +document.getElementById('ruleGraceMinutes').value || 15,
            awayMinutes: +document.getElementById('ruleAwayMinutes').value || 45,
            awayTimes: +document.getElementById('ruleAwayTimes').value || 3,
            awayPenalty: +document.getElementById('ruleAwayPenalty').value || 10,
            classMinutes: +document.getElementById('ruleClassMinutes').value || 120,
            classTimes: +document.getElementById('ruleClassTimes').value || 1,
            classPenalty: +document.getElementById('ruleClassPenalty').value || 20,
            classMinCredit: +document.getElementById('ruleClassMinCredit').value || 80
        };
        setRules(rules);
        alert('规则已保存');
    };

    window.editSeat = function(id) {
        const seats = getSeats();
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        const floor = prompt('楼层 (1-3):', seat.floor);
        if (floor === null) return;
        const area = prompt('区域 (quiet/discuss/window):', seat.area);
        if (area === null) return;
        const power = confirm('是否有电源？确定=是');
        seat.floor = +floor || seat.floor;
        seat.area = area || seat.area;
        seat.hasPower = power;
        setSeats(seats);
        renderSeats();
    };

    window.toggleSeat = function(id) {
        const seats = getSeats();
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        seat.enabled = !seat.enabled;
        if (!seat.enabled && seat.status !== 'free') seat.status = 'free';
        setSeats(seats);
        renderSeats();
    };

    window.showAddSeatForm = function() {
        const floor = prompt('楼层 (1-3):', '1');
        if (!floor) return;
        const area = prompt('区域 (quiet/discuss/window):', 'quiet');
        if (!area) return;
        const power = confirm('是否有电源？');
        const seats = getSeats();
        const maxId = seats.reduce((max, s) => Math.max(max, s.id), 0);
        const newSeat = {
            id: maxId + 1,
            code: String.fromCharCode(64 + +floor) + '-' + String(seats.filter(s => s.floor === +floor).length + 1).padStart(2,'0'),
            floor: +floor,
            area: area,
            hasPower: power,
            status: 'free',
            enabled: true
        };
        seats.push(newSeat);
        setSeats(seats);
        renderSeats();
    };

    window.toggleBan = function(id) {
        const users = getUsers();
        const user = users.find(u => u.id === id);
        if (!user) return;
        user.banned = !user.banned;
        setUsers(users);
        renderUsers();
    };

    window.cancelBooking = function(id) {
        if (!confirm('确认取消该预约？')) return;
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === id);
        if (!booking) return;
        booking.status = 'cancelled';
        setBookings(bookings);
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        if (seat && ['reserved','used','away'].includes(seat.status)) {
            seat.status = 'free';
            setSeats(seats);
        }
        renderBookings();
    };

    document.addEventListener('DOMContentLoaded', function() {
        initData();
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() { switchTab(this.dataset.tab); });
        });
        switchTab('seats');
    });
})();