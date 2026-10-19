(function () {
    'use strict';

    /* ========== 数据读写 ========== */
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
        if (!localStorage.getItem('lib_bookings')) setBookings([]);
        if (!localStorage.getItem('lib_rules')) {
            localStorage.setItem('lib_rules', JSON.stringify({
                maxMinutes: 240, graceMinutes: 15, awayMinutes: 45, awayTimes: 3, awayPenalty: 10,
                classMinutes: 120, classTimes: 1, classPenalty: 20, classMinCredit: 80
            }));
        }
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
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 2300);
    }

    /* ========== 统一过滤（含电源） ========== */
    function filterSeats(seats) {
        const floor = document.getElementById('floorFilter').value;
        const area = document.getElementById('areaFilter').value;
        const power = document.getElementById('powerFilter').value;
        return seats.filter(s => {
            if (floor !== 'all' && s.floor != floor) return false;
            if (area !== 'all' && s.area !== area) return false;
            if (power === 'yes' && !s.hasPower) return false;
            if (power === 'no' && s.hasPower) return false;
            return true;
        });
    }

    /* ========== 加载所有数据 ========== */
    function loadAll() {
        renderSeats();
        updateStats();
        refreshRecommend();
    }

    /* 暴露给 HTML onchange */
    window.renderGrid = loadAll;

    function updateStats() {
        const seats = getSeats();
        const bookings = getBookings();
        const filtered = filterSeats(seats);
        document.getElementById('statTotal').textContent = filtered.length;
        document.getElementById('statFree').textContent = filtered.filter(s => s.status === 'free' && s.enabled).length;
        document.getElementById('statUsed').textContent = filtered.filter(s => s.status === 'used' || s.status === 'away').length;
        const mine = bookings.filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
        document.getElementById('statMyBooking').textContent = mine.length;
        const occupied = filtered.filter(s => s.status !== 'free').length;
        const pct = filtered.length ? Math.round((occupied / filtered.length) * 100) : 0;
        document.getElementById('statOccupancy').textContent = pct + '%';
    }

    /* ========== 渲染座位网格（修改后） ========== */
    function renderSeats() {
        const container = document.getElementById('seatGrid');
        const seats = filterSeats(getSeats());
        if (seats.length === 0) {
            container.innerHTML = '<div class="loading">暂无座位</div>';
            return;
        }

        // 获取当前用户所有活跃预约的 seatCode 集合
        const bookings = getBookings();
        const activeBookings = bookings.filter(b => 
            b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status)
        );
        const myBookedCodes = new Set(activeBookings.map(b => b.seatCode));

        container.innerHTML = seats.map(seat => {
            const baseCls = seat.enabled ? seat.status : 'disabled';
            const sel = selectedSeatId === seat.id ? ' selected' : '';

            let extraCls = '';
            if (myBookedCodes.has(seat.code)) {
                // 当前用户预约的座位（reserved / used / away / class_reserve）
                extraCls = ' my-booking';
            } else if (seat.status === 'reserved') {
                // 被其他人预约的座位
                extraCls = ' booked-by-other';
            }

            return `<div class="seat-item ${baseCls}${sel}${extraCls}" data-id="${seat.id}" onclick="window.selectSeat(${seat.id})">
                <div class="seat-code">${seat.code}</div>
                <div class="seat-status">${STATUS_TEXT[seat.status] || seat.status}</div>
                ${seat.hasPower ? '<div class="seat-power">🔌</div>' : ''}
            </div>`;
        }).join('');
    }

    /* ========== 推荐座位 ========== */
    function refreshRecommend() {
        const container = document.getElementById('recommendList');
        const seats = getSeats().filter(s => s.enabled && s.status === 'free');
        if (!seats.length) {
            container.innerHTML = '<div class="recommend-empty">暂无空闲座位</div>';
            return;
        }
        const scored = seats.map(seat => {
            let score = 40;
            if (seat.hasPower) score += 25;
            if (seat.floor === 1) score += 15;
            else if (seat.floor === 2) score += 8;
            if (seat.area === 'quiet') score += 12;
            else if (seat.area === 'window') score += 8;
            return { seat, score };
        });
        scored.sort((a, b) => b.score - a.score);
        const top3 = scored.slice(0, 3);
        container.innerHTML = top3.map((r, i) => `
            <div class="recommend-item" onclick="window.selectSeat(${r.seat.id})">
                <div class="rec-rank">#${i+1}</div>
                <div class="rec-info">
                    <div class="rec-name">${r.seat.code} <span class="rec-area">${r.seat.area}</span></div>
                    <div class="rec-score-bar"><div class="rec-score-fill" style="width:${Math.min(r.score, 95)}%"></div></div>
                    <div class="rec-reasons">${r.seat.hasPower ? '有电源' : '无电源'} · ${r.seat.floor}F</div>
                </div>
                <div class="rec-score">${r.score}</div>
            </div>
        `).join('');
    }
    window.refreshRecommend = refreshRecommend;

    /* ========== 时段选择辅助 ========== */
    function populateTimeSlots() {
        const startSelect = document.getElementById('startHour');
        const endSelect = document.getElementById('endHour');
        if (!startSelect || !endSelect) return;

        const hours = [];
        for (let h = 8; h <= 22; h++) hours.push(h);

        startSelect.innerHTML = hours.map(h => `<option value="${h}">${String(h).padStart(2,'0')}:00</option>`).join('');
        const now = new Date();
        let defaultStart = now.getHours();
        if (defaultStart < 8) defaultStart = 8;
        if (defaultStart > 22) defaultStart = 22;
        startSelect.value = defaultStart;

        updateEndOptions();

        // 移除旧的监听避免重复绑定
        startSelect.removeEventListener('change', updateEndOptions);
        startSelect.addEventListener('change', updateEndOptions);
    }

    function updateEndOptions() {
        const startSelect = document.getElementById('startHour');
        const endSelect = document.getElementById('endHour');
        if (!startSelect || !endSelect) return;
        const start = parseInt(startSelect.value, 10);
        const maxEnd = 23;
        const options = [];
        for (let h = start + 1; h <= maxEnd; h++) options.push(h);
        endSelect.innerHTML = options.map(h => `<option value="${h}">${String(h).padStart(2,'0')}:00</option>`).join('');
        if (options.length > 0) endSelect.value = options[0];
    }

    /* ========== 选择座位（弹窗） ========== */
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

        showActionButtonsInModal(seat);

        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('seatModal').style.display = 'flex';
    };

    function showActionButtonsInModal(seat) {
        const actionContainer = document.getElementById('actionContainer');
        const actionBtn = document.getElementById('actionButton');
        const timeSlotSelector = document.getElementById('timeSlotSelector');
        if (!actionContainer || !actionBtn || !timeSlotSelector) return;

        const myBooking = getBookings().find(b =>
            b.userId === currentUser.id &&
            b.seatCode === seat.code &&
            ACTIVE_STATUS.includes(b.status)
        );

        if (myBooking) {
            timeSlotSelector.style.display = 'none';
            actionContainer.style.display = 'block';
            if (myBooking.status === 'active') {
                actionBtn.textContent = '✅ 签到';
                actionBtn.className = 'btn btn-success btn-block';
                actionBtn.onclick = function () { checkIn(myBooking.id); };
            } else if (myBooking.status === 'checked_in') {
                actionContainer.innerHTML = `
                    <button class="btn btn-warning btn-block" onclick="startAway(${myBooking.id})">⏸ 暂离</button>
                    <button class="btn btn-danger btn-block" style="margin-top:8px;" onclick="releaseSeat(${myBooking.id})">🗑 释放座位</button>
                `;
                return;
            } else if (myBooking.status === 'away' || myBooking.status === 'class_reserve') {
                actionBtn.textContent = '↩️ 返回座位';
                actionBtn.className = 'btn btn-success btn-block';
                actionBtn.onclick = function () { returnFromStatus(myBooking.id); };
            }
        } else if (seat.status === 'free' && seat.enabled) {
            timeSlotSelector.style.display = 'block';
            populateTimeSlots();
            actionContainer.style.display = 'block';
            actionBtn.textContent = '📅 预约座位';
            actionBtn.className = 'btn btn-primary btn-block';
            actionBtn.onclick = function () { bookSeat(seat.id); };
        } else {
            timeSlotSelector.style.display = 'none';
            actionContainer.style.display = 'none';
        }
    }

    window.closeSeatModal = function () {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('seatModal').style.display = 'none';
        selectedSeatId = null;
        renderSeats();
    };

    /* ========== 预约（含时段） ========== */
    window.bookSeat = function (seatId) {
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat || seat.status !== 'free') return toast('该座位不可预约', 'error');

        const existing = getBookings().filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
        if (existing.length > 0) return toast('您已有一个进行中的预约', 'error');

        const startHour = parseInt(document.getElementById('startHour').value, 10);
        const endHour = parseInt(document.getElementById('endHour').value, 10);
        if (isNaN(startHour) || isNaN(endHour) || endHour <= startHour) {
            return toast('请选择有效的时段', 'error');
        }

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const slot = `${String(startHour).padStart(2,'0')}:00 - ${String(endHour).padStart(2,'0')}:00`;

        const booking = {
            id: Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            seatCode: seat.code,
            date: dateStr,
            slot: slot,
            status: 'active',
            createTime: now.toISOString()
        };

        const bookings = getBookings();
        bookings.push(booking);
        setBookings(bookings);

        seat.status = 'reserved';
        setSeats(getSeats());

        closeSeatModal();
        loadAll();
        toast(`预约成功！时段：${slot}，请在15分钟内签到`, 'success');
    };

    /* ========== 签到 ========== */
    window.checkIn = function (bookingId) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'active') return toast('预约状态异常', 'error');
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        if (!seat) return toast('座位不存在', 'error');
        booking.status = 'checked_in';
        seat.status = 'used';
        setBookings(bookings);
        setSeats(seats);
        closeSeatModal();
        loadAll();
        toast('签到成功！', 'success');
    };

    /* ========== 暂离 ========== */
    window.startAway = function (bookingId) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'checked_in') return toast('当前状态不允许暂离', 'error');
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'away';
        seat.status = 'away';
        setBookings(bookings);
        setSeats(seats);
        const awayMinutes = (getRules().awayMinutes || 45);
        startCountdown(awayMinutes, '暂离中', bookingId);
        closeSeatModal();
        loadAll();
        toast(`暂离已启动，${awayMinutes}分钟内返回`, 'info');
    };

    /* ========== 上课保留 ========== */
    window.startClassReserve = function (bookingId) {
        const rules = getRules();
        if ((currentUser.credit ?? 100) < (rules.classMinCredit || 80))
            return toast('信用分不足80，无法使用上课保留', 'error');
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'checked_in') return toast('当前状态不允许上课保留', 'error');
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'class_reserve';
        seat.status = 'reserved';
        setBookings(bookings);
        setSeats(seats);
        const classMinutes = rules.classMinutes || 120;
        startCountdown(classMinutes, '上课保留中', bookingId);
        closeSeatModal();
        loadAll();
        toast(`上课保留已启动，座位保留${classMinutes}分钟`, 'info');
    };

    /* ========== 返回座位 ========== */
    window.returnFromStatus = function (bookingId) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || !['away', 'class_reserve'].includes(booking.status))
            return toast('当前状态无需返回', 'error');
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'checked_in';
        seat.status = 'used';
        setBookings(bookings);
        setSeats(seats);
        stopCountdown();
        closeSeatModal();
        loadAll();
        toast('已返回座位，计时暂停', 'success');
    };

    /* ========== 释放座位 ========== */
    window.releaseSeat = function (bookingId) {
        if (!confirm('确认释放当前座位？')) return;
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || !ACTIVE_STATUS.includes(booking.status)) return toast('当前状态不允许释放', 'error');
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'cancelled';
        seat.status = 'free';
        setBookings(bookings);
        setSeats(seats);
        stopCountdown();
        closeSeatModal();
        loadAll();
        toast('座位已释放', 'success');
    };

    /* ========== 倒计时（后台） ========== */
    function startCountdown(totalMinutes, label, bookingId) {
        stopCountdown();
        let remainingSeconds = totalMinutes * 60;
        countdownInterval = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                handleTimeout(bookingId, label);
            }
        }, 1000);
    }

    function stopCountdown() {
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    }

    function handleTimeout(bookingId, label) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
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
        booking.status = 'cancelled';
        seat.status = 'free';
        setBookings(bookings);
        setSeats(seats);
        loadAll();
        toast(`${label}超时，扣除${penalty}分`, 'error');
    }

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
        if (!currentUser) { window.location.href = '../index.html'; return; }
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userCredit').textContent = currentUser.credit;

        loadAll();
        startClock();

        // 筛选器事件
        document.getElementById('floorFilter').addEventListener('change', loadAll);
        document.getElementById('areaFilter').addEventListener('change', loadAll);
        document.getElementById('powerFilter').addEventListener('change', loadAll);
    });
})();