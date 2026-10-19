(function () {
    'use strict';

    /* ========== 数据工具 ========== */
    function getSeats()      { return JSON.parse(localStorage.getItem('lib_seats')      || '[]'); }
    function setSeats(v)     { localStorage.setItem('lib_seats', JSON.stringify(v)); }
    function getUsers()      { return JSON.parse(localStorage.getItem('lib_users')      || '[]'); }
    function setUsers(v)     { localStorage.setItem('lib_users', JSON.stringify(v)); }
    function getBookings()   { return JSON.parse(localStorage.getItem('lib_bookings')   || '[]'); }
    function setBookings(v)  { localStorage.setItem('lib_bookings', JSON.stringify(v)); }
    function getRules()      { return JSON.parse(localStorage.getItem('lib_rules')      || '{}'); }
    function setRules(v)     { localStorage.setItem('lib_rules', JSON.stringify(v)); }
    function getLogs()       { return JSON.parse(localStorage.getItem('lib_logs')       || '[]'); }
    function setLogs(v)      { localStorage.setItem('lib_logs', JSON.stringify(v)); }
    function getCurrentUser(){ return JSON.parse(localStorage.getItem('currentUser')); }

    const STATUS_TEXT = { free:'空闲', used:'使用中', away:'暂离', reserved:'已预约', maintenance:'维修' };

    /* ========== 初始化默认数据 ========== */
    function initData() {
        if (!localStorage.getItem('lib_seats')) {
            const seats = []; const areas = ['quiet','discuss','window'];
            for (let f=1; f<=3; f++)
                for (let i=1; i<=6; i++)
                    seats.push({ id:(f-1)*6+i, code:String.fromCharCode(64+f)+'-'+String(i).padStart(2,'0'),
                                 floor:f, area:areas[Math.floor(Math.random()*3)], hasPower:Math.random()>0.5,
                                 status:'free', enabled:true });
            setSeats(seats);
        }
        if (!localStorage.getItem('lib_users')) setUsers([]);
        if (!localStorage.getItem('lib_bookings')) setBookings([]);
        if (!localStorage.getItem('lib_rules')) {
            setRules({ maxMinutes:240, graceMinutes:15, awayMinutes:45, awayTimes:3, awayPenalty:10,
                       classMinutes:120, classTimes:1, classPenalty:20, classMinCredit:80 });
        }
        if (!localStorage.getItem('lib_logs')) setLogs([]);
    }

    /* ========== Toast ========== */
    function toast(msg, type) {
        type = type || 'info';
        const old = document.querySelector('.toast');
        if (old) old.remove();
        const t = document.createElement('div');
        t.className = 'toast toast-' + type;
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2100);
    }

    /* ========== 写入日志 ========== */
    function addLog(action) {
        const logs = getLogs();
        logs.unshift({ time: new Date().toLocaleString(), action: action });
        if (logs.length > 200) logs.length = 200;
        setLogs(logs);
        renderLogs();
    }

    /* ========== 加载所有 ========== */
    function loadAll() {
        updateStats();
        renderSeatTable();
        renderUserTable();
        renderRulesForm();
        renderLogs();
    }

    /* ========== 更新统计 ========== */
    function updateStats() {
        const seats = getSeats();
        const users = getUsers();
        const today = new Date().toISOString().slice(0,10);
        const todayBookings = getBookings().filter(b => b.date === today).length;
        document.getElementById('statTotal').textContent = seats.length;
        document.getElementById('statFree').textContent = seats.filter(s => s.status==='free' && s.enabled).length;
        document.getElementById('statUsed').textContent = seats.filter(s => s.status==='used' || s.status==='away').length;
        document.getElementById('statUsers').textContent = users.length;
        document.getElementById('statBookings').textContent = todayBookings;
    }

    /* ========== 座位表格 ========== */
    function renderSeatTable() {
        const tbody = document.getElementById('seatTableBody');
        const seats = getSeats();
        tbody.innerHTML = seats.map(seat => `
            <tr>
                <td>${seat.code}</td>
                <td>${seat.floor}F</td>
                <td>${seat.area}</td>
                <td>${seat.hasPower ? '✅' : '❌'}</td>
                <td><span class="status-tag status-${seat.status}">${STATUS_TEXT[seat.status] || seat.status}</span></td>
                <td>${seat.enabled ? '✅' : '⛔'}</td>
                <td>
                    <button class="btn btn-xs btn-outline" onclick="toggleSeatEnabled(${seat.id})">${seat.enabled ? '禁用' : '启用'}</button>
                    <button class="btn btn-xs btn-outline" onclick="deleteSeat(${seat.id})">删除</button>
                </td>
            </tr>
        `).join('');
    }

    window.toggleSeatEnabled = function (id) {
        const seats = getSeats();
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        seat.enabled = !seat.enabled;
        setSeats(seats);
        renderSeatTable();
        updateStats();
        addLog(`${seat.enabled ? '启用' : '禁用'}座位 ${seat.code}`);
        toast(`座位 ${seat.code} 已${seat.enabled ? '启用' : '禁用'}`, 'info');
    };

    window.deleteSeat = function (id) {
        if (!confirm('确认删除此座位？')) return;
        let seats = getSeats();
        const seat = seats.find(s => s.id === id);
        if (!seat) return;
        seats = seats.filter(s => s.id !== id);
        setSeats(seats);
        renderSeatTable();
        updateStats();
        addLog(`删除座位 ${seat.code}`);
        toast(`座位 ${seat.code} 已删除`, 'success');
    };

    /* ========== 添加座位弹窗 ========== */
    window.openAddSeatModal = function () {
        document.getElementById('addSeatModal').style.display = 'flex';
    };
    window.closeAddSeatModal = function () {
        document.getElementById('addSeatModal').style.display = 'none';
    };

    document.getElementById('addSeatForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const fd = new FormData(this);
        const code = fd.get('code').trim().toUpperCase();
        const floor = parseInt(fd.get('floor'), 10);
        const area = fd.get('area');
        const hasPower = fd.get('hasPower') === 'true';
        const seats = getSeats();
        if (seats.some(s => s.code === code)) {
            toast('座位编号已存在', 'error');
            return;
        }
        const maxId = seats.reduce((m, s) => Math.max(m, s.id), 0);
        seats.push({ id: maxId + 1, code, floor, area, hasPower, status: 'free', enabled: true });
        setSeats(seats);
        closeAddSeatModal();
        this.reset();
        renderSeatTable();
        updateStats();
        addLog(`添加座位 ${code}`);
        toast(`座位 ${code} 添加成功`, 'success');
    });

    /* ========== 重置所有座位 ========== */
    window.resetAllSeats = function () {
        if (!confirm('确认重置所有座位为空闲状态？（不会删除座位）')) return;
        const seats = getSeats();
        seats.forEach(s => { s.status = 'free'; s.enabled = true; });
        setSeats(seats);
        // 取消所有活跃预约
        const bookings = getBookings();
        bookings.forEach(b => { if (['active','checked_in','away','class_reserve'].includes(b.status)) b.status = 'cancelled'; });
        setBookings(bookings);
        renderSeatTable();
        updateStats();
        addLog('重置所有座位');
        toast('所有座位已重置为空闲', 'success');
    };

    /* ========== 用户表格 ========== */
    function renderUserTable(filter) {
        filter = filter || '';
        const tbody = document.getElementById('userTableBody');
        let users = getUsers();
        if (filter) {
            const lower = filter.toLowerCase();
            users = users.filter(u => (u.studentId || '').toLowerCase().includes(lower) || (u.name || '').toLowerCase().includes(lower));
        }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.name}</td>
                <td>${u.studentId || '-'}</td>
                <td>${u.credit ?? 100}</td>
                <td><span class="status-tag ${u.banned ? 'status-banned' : 'status-normal'}">${u.banned ? '封禁' : '正常'}</span></td>
                <td>
                    <button class="btn btn-xs btn-outline" onclick="toggleUserBan(${u.id})">${u.banned ? '解封' : '封禁'}</button>
                    <button class="btn btn-xs btn-outline" onclick="resetUserCredit(${u.id})">重置信用分</button>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('userSearch').addEventListener('input', function () {
        renderUserTable(this.value);
    });

    window.toggleUserBan = function (userId) {
        const users = getUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;
        user.banned = !user.banned;
        setUsers(users);
        renderUserTable(document.getElementById('userSearch').value);
        addLog(`${user.banned ? '封禁' : '解封'}用户 ${user.name}(${user.studentId})`);
        toast(`用户 ${user.name} 已${user.banned ? '封禁' : '解封'}`, 'info');
    };

    window.resetUserCredit = function (userId) {
        if (!confirm('确认将该用户信用分重置为100？')) return;
        const users = getUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;
        user.credit = 100;
        setUsers(users);
        renderUserTable(document.getElementById('userSearch').value);
        addLog(`重置用户 ${user.name} 信用分为100`);
        toast(`用户 ${user.name} 信用分已重置`, 'success');
    };

    /* ========== 规则表单 ========== */
    function renderRulesForm() {
        const rules = getRules();
        const form = document.getElementById('rulesForm');
        const fields = ['maxMinutes','graceMinutes','awayMinutes','awayTimes','awayPenalty',
                        'classMinutes','classTimes','classPenalty','classMinCredit'];
        fields.forEach(name => {
            const input = form.querySelector(`[name="${name}"]`);
            if (input && rules[name] !== undefined) input.value = rules[name];
        });
    }

    document.getElementById('rulesForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const fd = new FormData(this);
        const rules = {};
        fd.forEach((val, key) => { rules[key] = parseInt(val, 10) || 0; });
        setRules(rules);
        addLog('更新规则设置');
        toast('规则已保存', 'success');
    });

    /* ========== 操作日志 ========== */
    function renderLogs() {
        const container = document.getElementById('logList');
        const logs = getLogs();
        if (!logs.length) {
            container.innerHTML = '<div class="log-empty">暂无操作记录</div>';
            return;
        }
        container.innerHTML = logs.map(log => `
            <div class="log-item">
                <span>${log.action}</span>
                <span class="log-time">${log.time}</span>
            </div>
        `).join('');
    }

    window.clearLogs = function () {
        if (!confirm('确认清空所有操作日志？')) return;
        setLogs([]);
        renderLogs();
        addLog('清空操作日志');
        toast('日志已清空', 'info');
    };

    /* ========== Tab 切换 ========== */
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const tabId = this.dataset.tab;
            document.getElementById('tab-' + tabId).classList.add('active');
        });
    });

    /* ========== 实时时钟 ========== */
    function startClock() {
        const el = document.getElementById('realtimeClock');
        if (!el) return;
        function tick() {
            const d = new Date();
            const p = n => String(n).padStart(2,'0');
            el.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        }
        tick();
        setInterval(tick, 1000);
    }

    /* ========== 权限检查 ========== */
    document.addEventListener('DOMContentLoaded', function () {
        initData();
        const user = getCurrentUser();
        if (!user || user.role !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
        loadAll();
        startClock();
        addLog('管理员登录');
    });
})();
