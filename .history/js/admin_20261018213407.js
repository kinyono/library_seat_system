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
    const STATUS_CLASS = { free:'status-free', used:'status-used', away:'status-away', reserved:'status-reserved', maintenance:'status-banned' };
    let trendChartInstance = null;

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
        renderTrendChart();
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

    /* ========== 座位表格（含筛选） ========== */
    function renderSeatTable() {
        const tbody = document.getElementById('seatTableBody');
        let seats = getSeats();
        const floorFilter = document.getElementById('seatFloorFilter').value;
        const areaFilter = document.getElementById('seatAreaFilter').value;
        if (floorFilter !== 'all') seats = seats.filter(s => s.floor == floorFilter);
        if (areaFilter !== 'all') seats = seats.filter(s => s.area === areaFilter);

        tbody.innerHTML = seats.map(seat => `
            <tr>
                <td>${seat.code}</td>
                <td>${seat.floor}F</td>
                <td>${seat.area}</td>
                <td>${seat.hasPower ? '<i class="fas fa-plug" style="color:#22c55e;"></i>' : '<i class="fas fa-ban" style="color:#9ca3af;"></i>'}</td>
                <td><span class="status-tag ${STATUS_CLASS[seat.status] || ''}">${STATUS_TEXT[seat.status] || seat.status}</span></td>
                <td>${seat.enabled ? '<span style="color:#22c55e;">✅</span>' : '<span style="color:#ef4444;">⛔</span>'}</td>
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
    window.openAddSeatModal = function () { document.getElementById('addSeatModal').style.display = 'flex'; };
    window.closeAddSeatModal = function () { document.getElementById('addSeatModal').style.display = 'none'; };

    document.getElementById('addSeatForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const fd = new FormData(this);
        const code = fd.get('code').trim().toUpperCase();
        const floor = parseInt(fd.get('floor'), 10);
        const area = fd.get('area');
        const hasPower = fd.get('hasPower') === 'true';
        const seats = getSeats();
        if (seats.some(s => s.code === code)) { toast('座位编号已存在', 'error'); return; }
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
        const bookings = getBookings();
        bookings.forEach(b => { if (['active','checked_in','away','class_reserve'].includes(b.status)) b.status = 'cancelled'; });
        setBookings(bookings);
        renderSeatTable();
        updateStats();
        addLog('重置所有座位');
        toast('所有座位已重置为空闲', 'success');
    };

    /* ========== 用户表格（含多选） ========== */
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
                <td><input type="checkbox" class="user-check" value="${u.id}" onchange="updateSelectedCount()"></td>
                <td>${u.id}</td>
                <td>${u.name}</td>
                <td>${u.studentId || '-'}</td>
                <td><span class="status-tag ${u.credit < 60 ? 'status-banned' : 'status-normal'}">${u.credit ?? 100}</span></td>
                <td><span class="status-tag ${u.banned ? 'status-banned' : 'status-normal'}">${u.banned ? '封禁' : '正常'}</span></td>
                <td>
                    <button class="btn btn-xs btn-outline" onclick="toggleUserBan(${u.id})">${u.banned ? '解封' : '封禁'}</button>
                    <button class="btn btn-xs btn-outline" onclick="resetUserCredit(${u.id})">重置信用分</button>
                </td>
            </tr>
        `).join('');
        updateSelectedCount();
    }

    window.toggleCheckAll = function (master) {
        document.querySelectorAll('.user-check').forEach(cb => cb.checked = master.checked);
        updateSelectedCount();
    };

    window.updateSelectedCount = function () {
        const count = document.querySelectorAll('.user-check:checked').length;
        document.getElementById('userSelectedCount').textContent = `已选 ${count} 人`;
    };

    window.batchBanUsers = function () {
        const ids = [...document.querySelectorAll('.user-check:checked')].map(cb => parseInt(cb.value, 10));
        if (!ids.length) { toast('请先选择用户', 'error'); return; }
        if (!confirm(`确认封禁选中的 ${ids.length} 位用户？`)) return;
        const users = getUsers();
        ids.forEach(id => { const u = users.find(x => x.id === id); if (u) u.banned = true; });
        setUsers(users);
        renderUserTable(document.getElementById('userSearch').value);
        addLog(`批量封禁 ${ids.length} 位用户`);
        toast(`已封禁 ${ids.length} 位用户`, 'success');
    };

    window.batchResetCredit = function () {
        const ids = [...document.querySelectorAll('.user-check:checked')].map(cb => parseInt(cb.value, 10));
        if (!ids.length) { toast('请先选择用户', 'error'); return; }
        if (!confirm(`确认将选中的 ${ids.length} 位用户信用分重置为100？`)) return;
        const users = getUsers();
        ids.forEach(id => { const u = users.find(x => x.id === id); if (u) u.credit = 100; });
        setUsers(users);
        renderUserTable(document.getElementById('userSearch').value);
        addLog(`批量重置 ${ids.length} 位用户信用分`);
        toast(`已重置 ${ids.length} 位用户信用分`, 'success');
    };

    document.getElementById('userSearch').addEventListener('input', function () { renderUserTable(this.value); });

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

    /* ========== 规则表单（分区块） ========== */
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

    /* ========== 操作日志（含搜索 + 导出） ========== */
    function renderLogs(filter) {
        const container = document.getElementById('logList');
        let logs = getLogs();
        if (filter) {
            const lower = filter.toLowerCase();
            logs = logs.filter(l => l.action.toLowerCase().includes(lower));
        }
        if (!logs.length) { container.innerHTML = '<div class="log-empty">暂无操作记录</div>'; return; }
        container.innerHTML = logs.map(log => `
            <div class="log-item">
                <span>${log.action}</span>
                <span class="log-time">${log.time}</span>
            </div>
        `).join('');
    }

    document.getElementById('logSearch').addEventListener('input', function () { renderLogs(this.value); });

    window.exportLogs = function () {
        const logs = getLogs();
        if (!logs.length) { toast('暂无日志可导出', 'error'); return; }
        let csv = '时间,操作\n';
        logs.forEach(l => { csv += `"${l.time}","${l.action}"\n`; });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = '操作日志.csv'; a.click();
        URL.revokeObjectURL(url);
        toast('日志已导出', 'success');
    };

    window.clearLogs = function () {
        if (!confirm('确认清空所有操作日志？')) return;
        setLogs([]);
        renderLogs();
        addLog('清空操作日志');
        toast('日志已清空', 'info');
    };

    /* ========== 预约趋势图 ========== */
    function renderTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;
        const bookings = getBookings();
        const days = 7;
        const labels = []; const data = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now); d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0,10);
            labels.push(d.toISOString().slice(5,10));
            data.push(bookings.filter(b => b.date === key).length);
        }
        document.getElementById('trendEmpty').style.display = data.every(v => v === 0) ? 'block' : 'none';
        if (trendChartInstance) trendChartInstance.destroy();
        trendChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: { labels, datasets: [{ label:'预约次数', data, fill:true,
                backgroundColor:'rgba(99,102,241,0.12)', borderColor:'#6366f1',
                tension:0.3, pointBackgroundColor:'#6366f1', pointRadius:3 }] },
            options: { responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{ display:false } },
                scales:{ y:{ beginAtZero:true, title:{ display:true, text:'次数' } } } }
        });
    }

    /* ========== Tab 切换 ========== */
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab-' + this.dataset.tab).classList.add('active');
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
        tick(); setInterval(tick, 1000);
    }

    /* ========== 权限检查 ========== */
    document.addEventListener('DOMContentLoaded', function () {
        initData();
        const user = getCurrentUser();
        if (!user || user.role !== 'admin') { window.location.href = 'index.html'; return; }
        loadAll();
        startClock();
        addLog('管理员登录');
    });
})();