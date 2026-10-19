(function () {
    'use strict';

    function getSeats()    { return JSON.parse(localStorage.getItem('lib_seats')    || '[]'); }
    function setSeats(v)   { localStorage.setItem('lib_seats', JSON.stringify(v)); }
    function getBookings() { return JSON.parse(localStorage.getItem('lib_bookings') || '[]'); }
    function setBookings(v){ localStorage.setItem('lib_bookings', JSON.stringify(v)); }
    function getRules()    { return JSON.parse(localStorage.getItem('lib_rules')    || '{}'); }
    function getCurrentUser(){ return JSON.parse(localStorage.getItem('currentUser')); }
    function updateUserInStorage(user) {
        let users = JSON.parse(localStorage.getItem('lib_users')) || [];
        const idx = users.findIndex(u => u.id === user.id);
        if (idx !== -1) users[idx] = user; else users.push(user);
        localStorage.setItem('lib_users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(user));
    }

    const ACTIVE_STATUS = ['active', 'checked_in', 'away', 'class_reserve'];
    const STATUS_TEXT = { free: '空闲', used: '使用中', away: '暂离', reserved: '已预约', maintenance: '维修' };

    let currentUser = getCurrentUser();
    let selectedSeatId = null;
    let countdownInterval = null;

    function initData() {
        if (!localStorage.getItem('lib_seats')) {
            const seats = []; const areas = ['quiet', 'discuss', 'window'];
            for (let f = 1; f <= 3; f++)
                for (let i = 1; i <= 6; i++)
                    seats.push({ id: (f-1)*6+i, code: String.fromCharCode(64+f)+'-'+String(i).padStart(2,'0'),
                                 floor: f, area: areas[Math.floor(Math.random()*3)], hasPower: Math.random()>0.5,
                                 status: 'free', enabled: true });
            setSeats(seats);
        }
        if (!localStorage.getItem('lib_bookings')) setBookings([]);
        if (!localStorage.getItem('lib_rules')) {
            localStorage.setItem('lib_rules', JSON.stringify({
                maxMinutes: 240, graceMinutes: 15, awayMinutes: 45, awayTimes: 3, awayPenalty: 10,
                classMinutes: 120, classTimes: 1, classPenalty: 20, classMinCredit: 80
            }));
        }
    }

    function toast(msg, type) {
        type = type || 'info';
        const old = document.querySelector('.toast');
        if (old) old.remove();
        const t = document.createElement('div');
        t.className = 'toast toast-' + type;
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 2300);
    }

    function loadAll() { renderSeats(); renderMyBookings(); updateStats(); refreshRecommend(); }

    function updateStats() {
        const seats = getSeats(); const bookings = getBookings();
        const filtered = filterSeats(seats);
        document.getElementById('statTotal').textContent = filtered.length;
        document.getElementById('statFree').textContent = filtered.filter(s => s.status==='free' && s.enabled).length;
        document.getElementById('statUsed').textContent = filtered.filter(s => s.status==='used' || s.status==='away').length;
        document.getElementById('statMine').textContent = bookings.filter(b => b.userId===currentUser.id && ACTIVE_STATUS.includes(b.status)).length;
    }

    function filterSeats(seats) {
        const floor = document.getElementById('filterFloor').value;
        const area = document.getElementById('filterArea').value;
        return seats.filter(s => {
            if (floor !== 'all' && s.floor != floor) return false;
            if (area !== 'all' && s.area !== area) return false;
            return true;
        });
    }

    function renderSeats() {
        const container = document.getElementById('seatGrid');
        const seats = filterSeats(getSeats());
        const recs = getRecommendationIds(seats);
        container.innerHTML = seats.map(seat => {
            const cls = seat.enabled ? seat.status : 'disabled';
            const sel = selectedSeatId === seat.id ? ' selected' : '';
            const rec = recs.includes(seat.id) ? ' recommended' : '';
            const badge = rec ? '<span class="badge-recommend">⭐推荐</span>' : '';
            return `<div class="seat-item ${cls}${sel}${rec}" data-id="${seat.id}" onclick="window.selectSeat(${seat.id})">
                ${badge}
                <div class="seat-code">${seat.code}</div>
                <div class="seat-status">${STATUS_TEXT[seat.status] || seat.status}</div>
                ${seat.hasPower ? '<div class="seat-power">🔌</div>' : ''}
            </div>`;
        }).join('');
    }

    function getRecommendationIds(seats) {
        const ctx = buildRecCtx();
        const recs = window.Recommend ? Recommend.getRecommendations(seats, ctx, 3) : [];
        return recs.map(r => r.seat.id);
    }

    function buildRecCtx() {
        const floor = document.getElementById('filterFloor').value;
        const prefArea = document.getElementById('prefArea').value;
        const usageMap = {};
        getBookings().forEach(b => { usageMap[b.seatCode] = (usageMap[b.seatCode]||0) + 1; });
        return { floor, prefArea, usageMap };
    }

    function refreshRecommend() {
        const container = document.getElementById('recommendList');
        const seats = getSeats().filter(s => s.enabled && s.status === 'free');
        if (!seats.length) { container.innerHTML = '<div class="recommend-empty">暂无空闲座位</div>'; return; }
        const ctx = buildRecCtx();
        const recs = window.Recommend ? Recommend.getRecommendations(seats, ctx, 3) : [];
        if (!recs.length) { container.innerHTML = '<div class="recommend-empty">无符合偏好的推荐</div>'; return; }
        container.innerHTML = recs.map((r, i) => `
            <div class="recommend-item" onclick="window.selectSeat(${r.seat.id})">
                <div class="rec-rank">#${i+1}</div>
                <div class="rec-info">
                    <div class="rec-name">${r.seat.code} <span class="rec-area">${r.seat.area}</span></div>
                    <div class="rec-score-bar"><div class="rec-score-fill" style="width:${r.score}%"></div></div>
                    <div class="rec-reasons">${r.reasons.join(' · ')}</div>
                </div>
                <div class="rec-score">${r.score}</div>
            </div>`).join('');
        if (selectedSeatId) {
            const rec = recs.find(r => r.seat.id === selectedSeatId);
            const row = document.getElementById('recScoreRow');
            if (rec) { row.style.display = 'flex'; document.getElementById('detailScore').textContent = rec.score + '分'; }
            else row.style.display = 'none';
        }
        renderSeats();
    }
    window.refreshRecommend = refreshRecommend;

    window.selectSeat = function (seatId) {
        selectedSeatId = seatId;
        renderSeats();
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat) return;
        document.getElementById('detailCode').textContent = seat.code;
        document.getElementById('detailFloor').textContent = seat.floor + 'F';
        document.getElementById('detailArea').textContent = seat.area;
        document.getElementById('detailPower').textContent = seat.hasPower ? '有' : '无';
        document.getElementById('detailStatus').textContent = STATUS_TEXT[seat.status] || seat.status;
        showActionButtons(seat);
        const ctx = buildRecCtx();
        const rec = window.Recommend ? Recommend.scoreSeat(seat, ctx) : -1;
        const row = document.getElementById('recScoreRow');
        if (rec >= 0 && seat.status === 'free') { row.style.display = 'flex'; document.getElementById('detailScore').textContent = rec + '分'; }
        else row.style.display = 'none';
    };

    function showActionButtons(seat) {
        const actionsDiv = document.getElementById('seatActions');
        const myBooking = getBookings().find(b =>
            b.userId === currentUser.id && b.seatCode === seat.code && ACTIVE_STATUS.includes(b.status));
        let html = '';
        if (seat.status === 'free' && seat.enabled)
            html += `<button class="btn btn-primary btn-block" onclick="window.bookSeat(${seat.id})">预约</button>`;
        if (myBooking) {
            if (myBooking.status === 'active')
                html += `<button class="btn btn-success btn-block" onclick="window.checkIn(${myBooking.id})">签到</button>`;
            if (myBooking.status === 'checked_in') {
                html += `<button class="btn btn-warning btn-block" onclick="window.startAway(${myBooking.id})">暂离</button>`;
                if ((currentUser.credit ?? 100) >= (getRules().classMinCredit || 80))
                    html += `<button class="btn btn-info btn-block" onclick="window.startClassReserve(${myBooking.id})">上课保留</button>`;
                html += `<button class="btn btn-danger btn-block" onclick="window.releaseSeat(${myBooking.id})">释放座位</button>`;
            }
            if (myBooking.status === 'away' || myBooking.status === 'class_reserve')
                html += `<button class="btn btn-success btn-block" onclick="window.returnFromStatus(${myBooking.id})">返回座位</button>`;
        }
        actionsDiv.innerHTML = html;
    }

    window.bookSeat = function (seatId) {
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat || seat.status !== 'free') return toast('该座位不可预约', 'error');
        if (getBookings().filter(b => b.userId===currentUser.id && ACTIVE_STATUS.includes(b.status)).length > 0)
            return toast('您已有一个进行中的预约', 'error');
        const now = new Date();
        const booking = { id: Date.now(), userId: currentUser.id, userName: currentUser.name, seatCode: seat.code,
            date: now.toISOString().slice(0,10), slot: now.getHours()+':00 - '+(now.getHours()+1)+':00',
            status: 'active', createTime: now.toISOString() };
        const bookings = getBookings(); bookings.push(booking); setBookings(bookings);
        seat.status = 'reserved'; setSeats(getSeats());
        loadAll(); showActionButtons(seat);
        toast('预约成功！请在15分钟内签到', 'success');
    };

    window.checkIn = function (bookingId) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'active') return toast('预约状态异常', 'error');
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return toast('座位不存在', 'error');
        booking.status = 'checked_in'; seat.status = 'used';
        setBookings(bookings); setSeats(seats);
        loadAll(); showActionButtons(seat);
        toast('签到成功！', 'success');
    };

    window.startAway = function (bookingId) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'checked_in') return toast('当前状态不允许暂离', 'error');
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'away'; seat.status = 'away';
        setBookings(bookings); setSeats(seats);
        const awayMinutes = (getRules().awayMinutes || 45);
        startCountdown(awayMinutes, '暂离中', bookingId);
        loadAll(); showActionButtons(seat);
        toast(`暂离已启动，${awayMinutes}分钟内返回`, 'info');
    };

    window.startClassReserve = function (bookingId) {
        const rules = getRules();
        if ((currentUser.credit ?? 100) < (rules.classMinCredit || 80))
            return toast('信用分不足80，无法使用上课保留', 'error');
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'checked_in') return toast('当前状态不允许上课保留', 'error');
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'class_reserve'; seat.status = 'reserved';
        setBookings(bookings); setSeats(seats);
        const classMinutes = rules.classMinutes || 120;
        startCountdown(classMinutes, '上课保留中', bookingId);
        loadAll(); showActionButtons(seat);
        toast(`上课保留已启动，座位保留${classMinutes}分钟`, 'info');
    };

    window.returnFromStatus = function (bookingId) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || !['away','class_reserve'].includes(booking.status)) return toast('当前状态无需返回', 'error');
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'checked_in'; seat.status = 'used';
        setBookings(bookings); setSeats(seats);
        stopCountdown();
        loadAll(); showActionButtons(seat);
        toast('已返回座位，计时暂停', 'success');
    };

    window.releaseSeat = function (bookingId) {
        if (!confirm('确认释放当前座位？')) return;
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || !ACTIVE_STATUS.includes(booking.status)) return toast('当前状态不允许释放', 'error');
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'cancelled'; seat.status = 'free';
        setBookings(bookings); setSeats(seats);
        stopCountdown();
        loadAll(); showActionButtons(seat);
        toast('座位已释放', 'success');
    };

    function startCountdown(totalMinutes, label, bookingId) {
        stopCountdown();
        const panel = document.getElementById('timerPanel');
        if (!panel) return;
        panel.style.display = 'block';
        document.getElementById('timerLabel').textContent = label;
        const remainingSpan = document.getElementById('timerRemaining');
        const progressBar = document.getElementById('timerProgress');
        let remainingSeconds = totalMinutes * 60;
        updateDisplay();
        countdownInterval = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval); countdownInterval = null;
                handleTimeout(bookingId, label); panel.style.display = 'none'; return;
            }
            updateDisplay();
        }, 1000);
        function updateDisplay() {
            const mins = Math.floor(remainingSeconds/60); const secs = remainingSeconds%60;
            remainingSpan.textContent = `${mins}:${String(secs).padStart(2,'0')}`;
            progressBar.style.width = (remainingSeconds/(totalMinutes*60))*100 + '%';
        }
    }

    function stopCountdown() {
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        const panel = document.getElementById('timerPanel');
        if (panel) panel.style.display = 'none';
        const pb = document.getElementById('timerProgress'); if (pb) pb.style.width = '100%';
        const rs = document.getElementById('timerRemaining'); if (rs) rs.textContent = '--:--';
    }

    function handleTimeout(bookingId, label) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return;
        const rules = getRules();
        let penalty = 0;
        if (label === '暂离中') penalty = rules.awayPenalty || 10;
        else if (label === '上课保留中') penalty = rules.classPenalty || 20;
        if (penalty > 0) {
            currentUser.credit = Math.max(0, (currentUser.credit ?? 100) - penalty);
            updateUserInStorage(currentUser);
            document.getElementById('userCredit').textContent = currentUser.credit;
        }
        booking.status = 'cancelled'; seat.status = 'free';
        setBookings(bookings); setSeats(seats);
        loadAll();
        toast(`${label}超时，扣除${penalty}分`, 'error');
    }

    function restoreActiveTimer() {
        const activeBooking = getBookings().find(b =>
            b.userId === currentUser.id && (b.status === 'away' || b.status === 'class_reserve'));
        if (!activeBooking) return;
        const rules = getRules();
        let totalMinutes, label;
        if (activeBooking.status === 'away') { totalMinutes = rules.awayMinutes || 45; label = '暂离中'; }
        else { totalMinutes = rules.classMinutes || 120; label = '上课保留中'; }
        const elapsed = (Date.now() - new Date(activeBooking.createTime).getTime())/1000;
        const remaining = Math.max(0, totalMinutes*60 - elapsed);
        if (remaining <= 0) { handleTimeout(activeBooking.id, label); return; }
        const panel = document.getElementById('timerPanel');
        if (!panel) return;
        panel.style.display = 'block';
        document.getElementById('timerLabel').textContent = label;
        const remainingSpan = document.getElementById('timerRemaining');
        const progressBar = document.getElementById('timerProgress');
        let remainingSeconds = Math.round(remaining);
        updateDisplay();
        countdownInterval = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval); countdownInterval = null;
                handleTimeout(activeBooking.id, label); panel.style.display = 'none'; return;
            }
            updateDisplay();
        }, 1000);
        function updateDisplay() {
            const mins = Math.floor(remainingSeconds/60); const secs = remainingSeconds%60;
            remainingSpan.textContent = `${mins}:${String(secs).padStart(2,'0')}`;
            progressBar.style.width = (remainingSeconds/(totalMinutes*60))*100 + '%';
        }
    }

    function renderMyBookings() {
        const list = document.getElementById('myBookingsList');
        const bookings = getBookings().filter(b => b.userId === currentUser.id && b.status !== 'cancelled');
        list.innerHTML = bookings.length === 0
            ? '<li class="empty">暂无进行中的预约</li>'
            : bookings.map(b => `<li>${b.seatCode} · ${b.date} ${b.slot} <span class="status-tag status-${b.status}">${b.status}</span></li>`).join('');
    }

    function startClock() {
        const el = document.getElementById('realtimeClock');
        if (!el) return;
        function tick() {
            const d = new Date(); const p = n => String(n).padStart(2,'0');
            el.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        }
        tick(); setInterval(tick, 1000);
    }

    document.addEventListener('DOMContentLoaded', function () {
        initData();
        if (!currentUser) { window.location.href = '../index.html'; return; }
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userCredit').textContent = currentUser.credit;
        document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '管理员' : '学生';
        loadAll(); startClock(); restoreActiveTimer();
        document.getElementById('filterFloor').addEventListener('change', loadAll);
        document.getElementById('filterArea').addEventListener('change', loadAll);
        document.getElementById('prefArea').addEventListener('change', refreshRecommend);
    });
})();
