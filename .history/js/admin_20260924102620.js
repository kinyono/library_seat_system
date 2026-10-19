(function () {
    'use strict';

    /* ========== 数据读写 ========== */
    function getSeats()    { return JSON.parse(localStorage.getItem('lib_seats')    || '[]'); }
    function setSeats(v)   { localStorage.setItem('lib_seats', JSON.stringify(v)); }
    function getUsers()    { return JSON.parse(localStorage.getItem('lib_users')    || '[]'); }
    function setUsers(v)   { localStorage.setItem('lib_users', JSON.stringify(v)); }
    function getBookings() { return JSON.parse(localStorage.getItem('lib_bookings') || '[]'); }
    function setBookings(v){ localStorage.setItem('lib_bookings', JSON.stringify(v)); }
    function getRules()    { return JSON.parse(localStorage.getItem('lib_rules')    || '{}'); }
    function setRules(v)   { localStorage.setItem('lib_rules', JSON.stringify(v)); }

    const ACTIVE_STATUS = ['active', 'checked_in', 'away', 'class_reserve'];

    const STATUS_TEXT = { free: '空闲', used: '使用中', away: '暂离', reserved: '已预约', maintenance: '维修' };
    const BOOK_STATUS_TEXT = { active: '待签到', checked_in: '使用中', away: '暂离', class_reserve: '上课保留', cancelled: '已取消' };

    /* ========== 初始化数据 ========== */
    function initData() {
        if (!localStorage.getItem('lib_seats')) {
            const seats = [];
            const areas = ['quiet', 'discuss', 'window'];
            for (let f = 1; f <= 3; f++)
                for (let i = 1; i <= 6; i++)
                    seats.push({ id: (f - 1) * 6 + i, code: String.fromCharCode(64 + f) + '-' + String(i).padStart(2, '0'),
                                 floor: f, area: areas[Math.floor(Math.random() * 3)], hasPower: Math.random() > 0.5,
                                 status: 'free', enabled: true });
            setSeats(seats);
        }
        if (!localStorage.getItem('lib_users')) setUsers([]);
        if (!localStorage.getItem('lib_bookings')) setBookings([]);
        if (!localStorage.getItem('lib_rules')) {
            setRules({ maxMinutes: 240, graceMinutes: 15, awayMinutes: 45, awayTimes: 3, awayPenalty: 10,
                       classMinutes: 120, classTimes: 1, classPenalty: 20, classMinCredit: 80 });
        }
    }

    /* ========== 提示 ========== */
    function toast(msg, type) {
        type = type || 'info';
        const old = document.querySelector('.toast');
        if (old) old.remove();
        const t = document.createElement('div');
        t.className = 'toast toast-' + type;
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
    }

    /* ========== 统计 ========== */
    function updateStats() {
        const seats = getSeats();
        const bookings = getBookings();
        const activeBookings = bookings.filter(b => ACTIVE_STATUS.includes(b.status));
        document.getElementById('statTotal').textContent = seats.length;
        document.getElementById('statFree').textContent = seats.filter(s => s.status === 'free' && s.enabled).length;
        document.getElementById('statUsed').textContent = seats.filter(s => s.status === 'used' || s.status === 'away').length;
        document.getElementById('statActiveBookings').textContent = activeBookings.length;
    }

    /* ========== Tab 切换 ========== */
    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.tab === tabName));
        document.querySelectorAll('.tab-content').forEach(c =>
            c.classList.toggle('active', c.id === 'tab-' + tabName));
        if (tabName === 'seats') renderSeats();
        if (tabName === 'users') renderUsers();
        if (tabName === 'bookings') renderBookings();
        if (tabName === 'rules') loadRules();
    }

    /* ========== 座位管理 ========== */
    function renderSeats() {
        const tbody = document.getElementById('seatsTableBody');
        const seats = getSeats();
        if (!seats.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">暂无座位，请点击「添加座位」</td></tr>'; return; }
        tbody.innerHTML = seats.map(s => `
            <tr>
                <td><strong>${s.code}</strong></td>
                <td>${s.floor}F</td>
                <td>${s.area}</td>
                <td>${s.hasPower ? '✅' : '❌'}</td>
                <td><span class="status-tag status-${s.status}">${STATUS_TEXT[s.status] || s.status}</span></td>
                <td>${s.enabled ? '✅' : '❌'}</td>
                <td class="action-btns">
                    <button class="btn btn-warning btn-sm" onclick="editSeat(${s.id})">编辑</button>
                    <button class="btn ${s.enabled ? 'btn-danger' : 'btn-success'} btn-sm"
                            onclick="toggleSeatEnabled(${s.id})">${s.enabled ? '禁用' : '启用'}</button>
                </td>
            </tr>`).join('');
    }

    window.editSeat = function (id) {
        const seats = getSeats();
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        const floor = prompt('楼层 (1-5):', seat.floor);
        if (floor === null) return;
        const area = prompt('区域 (quiet 静音 / discuss 讨论 / window 靠窗):', seat.area);
        if (area === null) return;
        const power = confirm('是否有电源？\n确定 = 有，取消 = 无');
        seat.floor = Math.max(1, Math.min(5, +floor || 1));
        seat.area = ['quiet', 'discuss', 'window'].includes(area) ? area : seat.area;
        seat.hasPower = power;
        setSeats(seats);
        renderSeats();
        updateStats();
        toast('座位已更新', 'success');
    };

    window.toggleSeatEnabled = function (id) {
        const seats = getSeats();
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        seat.enabled = !seat.enabled;
        if (!seat.enabled && seat.status !== 'free') { seat.status = 'free'; }
        setSeats(seats);
        renderSeats();
        updateStats();
        toast(seat.enabled ? '座位已启用' : '座位已禁用', 'info');
    };

    /* ========== 添加座位弹窗 ========== */
    window.showAddSeatForm = function () {
        document.getElementById('addSeatModal').style.display = 'flex';
    };
    window.closeAddSeatForm = function () {
        document.getElementById('addSeatModal').style.display = 'none';
    };
    window.submitAddSeat = function () {
        const code = document.getElementById('newSeatCode').value.trim();
        const floor = +document.getElementById('newSeatFloor').value;
        const area = document.getElementById('newSeatArea').value;
        const hasPower = document.getElementById('newSeatPower').value === '1';
        if (!code) return toast('请填写座位编号', 'error');
        const seats = getSeats();
        if (seats.some(s => s.code === code)) return toast('该编号已存在', 'error');
        const maxId = seats.reduce((m, s) => Math.max(m, s.id), 0);
        seats.push({ id: maxId + 1, code, floor: Math.max(1, Math.min(5, floor || 1)),
                     area, hasPower, status: 'free', enabled: true });
        setSeats(seats);
        closeAddSeatForm();
        renderSeats();
        updateStats();
        toast('座位已添加', 'success');
        // 清空表单
        document.getElementById('newSeatCode').value = '';
    };

    /* ========== 用户管理 ========== */
    function renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        const users = getUsers();
        if (!users.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">暂无用户（学生登录后会自动创建）</td></tr>'; return; }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.name}</td>
                <td>${u.studentId}</td>
                <td><strong>${u.credit}</strong></td>
                <td>${u.banned ? '<span class="status-tag status-away">已封禁</span>' : '<span class="status-tag status-free">正常</span>'}</td>
                <td class="action-btns">
                    <button class="btn ${u.banned ? 'btn-success' : 'btn-danger'} btn-sm"
                            onclick="toggleBan(${u.id})">${u.banned ? '解封' : '封禁'}</button>
                </td>
            </tr>`).join('');
    }

    window.toggleBan = function (id) {
        const users = getUsers();
        const user = users.find(u => u.id === id);
        if (!user) return;
        user.banned = !user.banned;
        setUsers(users);
        renderUsers();
        toast(user.banned ? `已封禁 ${user.name}` : `已解封 ${user.name}`, 'info');
    };

    /* ========== 预约记录 ========== */
    function renderBookings() {
        const tbody = document.getElementById('bookingsTableBody');
        const bookings = getBookings();
        if (!bookings.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无预约记录</td></tr>'; return; }
        // 按时间倒序
        const sorted = bookings.slice().sort((a, b) => (b.createTime || '').localeCompare(a.createTime || ''));
        tbody.innerHTML = sorted.map(b => `
            <tr>
                <td>${b.userName || ('#' + b.userId)}</td>
                <td><strong>${b.seatCode}</strong></td>
                <td>${b.date}</td>
                <td>${b.slot}</td>
                <td><span class="status-tag status-${b.status}">${BOOK_STATUS_TEXT[b.status] || b.status}</span></td>
                <td class="action-btns">
                    ${ACTIVE_STATUS.includes(b.status)
                        ? `<button class="btn btn-danger btn-sm" onclick="cancelAnyBooking(${b.id})">取消</button>`
                        : '-'}
                </td>
            </tr>`).join('');
    }

    window.cancelAnyBooking = function (id) {
        if (!confirm('确认取消该预约？座位将释放为「空闲」。')) return;
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === id);
        if (!booking) return;
        booking.status = 'cancelled';
        setBookings(bookings);
        // 释放座位
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        if (seat && ['reserved', 'used', 'away'].includes(seat.status)) {
            seat.status = 'free';
            setSeats(seats);
        }
        renderBookings();
        updateStats();
        toast('预约已取消，座位已释放', 'success');
    };

    /* ========== 规则配置 ========== */
    function loadRules() {
        const r = getRules();
        document.getElementById('ruleMaxMinutes').value = r.maxMinutes ?? 240;
        document.getElementById('ruleGraceMinutes').value = r.graceMinutes ?? 15;
        document.getElementById('ruleAwayMinutes').value = r.awayMinutes ?? 45;
        document.getElementById('ruleAwayTimes').value = r.awayTimes ?? 3;
        document.getElementById('ruleAwayPenalty').value = r.awayPenalty ?? 10;
        document.getElementById('ruleClassMinutes').value = r.classMinutes ?? 120;
        document.getElementById('ruleClassTimes').value = r.classTimes ?? 1;
        document.getElementById('ruleClassPenalty').value = r.classPenalty ?? 20;
        document.getElementById('ruleClassMinCredit').value = r.classMinCredit ?? 80;
    }

    window.saveRules = function () {
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
        toast('规则已保存', 'success');
    };

    /* ========== 实时时钟 ========== */
    function startClock() {
        const el = document.getElementById('realtimeClock');
        if (!el) return;
        function tick() {
            const d = new Date();
            const p = n => String(n).padStart(2, '0');
            el.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        }
        tick();
        setInterval(tick, 1000);
    }

    /* ========== 启动 ========== */
    document.addEventListener('DOMContentLoaded', function () {
        initData();

        // 显示管理员名称
        try {
            const u = JSON.parse(localStorage.getItem('currentUser'));
            if (u && u.name) document.getElementById('adminName').textContent = u.name;
        } catch (e) {}

        // Tab 事件
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function () { switchTab(this.dataset.tab); });
        });

        // 首次加载
        updateStats();
        renderSeats();
        loadRules();
        startClock();
    });
})();
