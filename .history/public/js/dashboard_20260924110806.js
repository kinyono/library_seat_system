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

    /* ========== 加载数据 ========== */
    async function loadAll() {
        renderSeats();
        updateStats();
        refreshRecommend();
    }

    function updateStats() {
        const seats = getSeats();
        const bookings = getBookings();
        const filtered = filterSeats(seats);
        document.getElementById('statTotal').textContent = filtered.length;
        document.getElementById('statFree').textContent = filtered.filter(s => s.status === 'free' && s.enabled).length;
        document.getElementById('statUsed').textContent = filtered.filter(s => s.status === 'used' || s.status === 'away').length;
        const mine = bookings.filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
        document.getElementById('statMyBooking').textContent = mine.length;  // 原 statMine -> statMyBooking
    }

    function filterSeats(seats) {
        const floor = document.getElementById('floorFilter').value;   // 原 filterFloor
        const area = document.getElementById('areaFilter').value;     // 原 filterArea
        return seats.filter(s => {
            if (floor !== 'all' && s.floor != floor) return false;
            if (area !== 'all' && s.area !== area) return false;
            return true;
        });
    }

    /* ========== 渲染座位网格 ========== */
    function renderSeats() {
        const container = document.getElementById('seatGrid');
        const seats = filterSeats(getSeats());
        const recs = getRecommendationIds(seats);

        container.innerHTML = seats.map(seat => {
            const cls = seat.enabled ? seat.status : 'disabled';
            const sel = selectedSeatId === seat.id ? ' selected' : '';
            const rec = recs.includes(seat.id) ? ' recommended' : '';
            const badge = recs.includes(seat.id) ? '<span class="badge-recommend">⭐推荐</span>' : '';
            return `<div class="seat-item ${cls}${sel}${rec}" data-id="${seat.id}" onclick="window.selectSeat(${seat.id})">
                ${badge}
                <div class="seat-code">${seat.code}</div>
                <div class="seat-status">${STATUS_TEXT[seat.status] || seat.status}</div>
                ${seat.hasPower ? '<div class="seat-power">🔌</div>' : ''}
            </div>`;
        }).join('');
    }

    /* ========== 推荐座位 ========== */
    function getRecommendationIds(seats) {
        const ctx = buildRecCtx();
        const recs = window.Recommend ? Recommend.getRecommendations(seats, ctx, 3) : [];
        return recs.map(r => r.seat.id);
    }

    function buildRecCtx() {
        const floor = document.getElementById('floorFilter').value;
        // 偏好区域：从 localStorage 读取或默认 quiet
        const prefArea = localStorage.getItem('userPrefArea') || 'quiet';
        const bookings = getBookings();
        const usageMap = {};
        bookings.forEach(b => { usageMap[b.seatCode] = (usageMap[b.seatCode] || 0) + 1; });
        return { floor, prefArea, usageMap };
    }

    function refreshRecommend() {
        const container = document.getElementById('recommendList');
        const seats = getSeats().filter(s => s.enabled && s.status === 'free');
        if (!seats.length) {
            container.innerHTML = '<div class="recommend-empty">暂无空闲座位</div>';
            return;
        }
        const ctx = buildRecCtx();
        const recs = window.Recommend ? Recommend.getRecommendations(seats, ctx, 3) : [];
        if (!recs.length) {
            container.innerHTML = '<div class="recommend-empty">无符合偏好的推荐</div>';
            return;
        }
        container.innerHTML = recs.map((r, i) => `
            <div class="recommend-item" onclick="window.selectSeat(${r.seat.id})">
                <div class="rec-rank">#${i+1}</div>
                <div class="rec-info">
                    <div class="rec-name">${r.seat.code} <span class="rec-area">${r.seat.area}</span></div>
                    <div class="rec-score-bar"><div class="rec-score-fill" style="width:${r.score}%"></div></div>
                    <div class="rec-reasons">${r.reasons.join(' · ')}</div>
                </div>
                <div class="rec-score">${r.score}</div>
            </div>
        `).join('');
        renderSeats(); // 刷新网格高亮
    }
    window.refreshRecommend = refreshRecommend;

    /* ========== 选择座位（弹窗模式） ========== */
    window.selectSeat = function (seatId) {
        selectedSeatId = seatId;
        renderSeats();
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat) return;

        // 填充弹窗详情
        document.getElementById('detailCode').textContent = seat.code;
        document.getElementById('detailFloor').textContent = seat.floor + 'F';
        document.getElementById('detailArea').textContent = seat.area;
        document.getElementById('detailPower').textContent = seat.hasPower ? '有' : '无';
        document.getElementById('detailStatus').textContent = STATUS_TEXT[seat.status] || seat.status;

        // 显示操作按钮
        showActionButtonsInModal(seat);

        // 显示弹窗
        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('seatModal').style.display = 'flex';
    };

    function showActionButtonsInModal(seat) {
        const actionContainer = document.getElementById('actionContainer');
        const actionBtn = document.getElementById('actionButton');
        if (!actionContainer || !actionBtn) return;

        const myBooking = getBookings().find(b =>
            b.userId === currentUser.id &&
            b.seatCode === seat.code &&
            ACTIVE_STATUS.includes(b.status)
        );

        if (myBooking) {
            actionContainer.style.display = 'block';
            if (myBooking.status === 'active') {
                actionBtn.textContent = '✅ 签到';
                actionBtn.className = 'btn btn-success btn-block';
                actionBtn.onclick = function () { checkIn(myBooking.id); };
            } else if (myBooking.status === 'checked_in') {
                actionBtn.textContent = '⏸ 暂离';
                actionBtn.className = 'btn btn-warning btn-block';
                actionBtn.onclick = function () { startAway(myBooking.id); };
                // 第二按钮：上课保留（如果有空间可加，但弹窗只有一个按钮，暂时忽略）
                // 释放座位通过独立按钮？这里简化：再加一个释放按钮？弹窗只有一个按钮位，我们用二级菜单？
                // 为了简单，我们用一个下拉菜单？或者修改弹窗结构？为了兼容现有弹窗，我们改为：点击暂离后，再显示释放选项。
                // 更好的做法：在actionContainer内动态生成多个按钮。但现有HTML只有单个按钮，所以我们改为在点击暂离后再提供释放。
                // 实际上用户需要释放功能，我们可以在暂离状态下再显示一个按钮？但弹窗只有一个按钮。
                // 解决办法：修改HTML增加第二个按钮，或者我们改变策略：在checked_in状态下，按钮变为“暂离”，同时下方增加一个“释放座位”的按钮（在actionContainer内追加）。
                // 为了不改动HTML太多，我们直接在actionContainer内动态生成两个按钮。
                actionContainer.innerHTML = `
                    <button class="btn btn-warning btn-block" onclick="startAway(${myBooking.id})">⏸ 暂离</button>
                    <button class="btn btn-danger btn-block" style="margin-top:8px;" onclick="releaseSeat(${myBooking.id})">🗑 释放座位</button>
                `;
                return; // 提前返回，避免覆盖
            } else if (myBooking.status === 'away' || myBooking.status === 'class_reserve') {
                actionBtn.textContent = '↩️ 返回座位';
                actionBtn.className = 'btn btn-success btn-block';
                actionBtn.onclick = function () { returnFromStatus(myBooking.id); };
            }
        } else if (seat.status === 'free' && seat.enabled) {
            actionContainer.style.display = 'block';
            actionBtn.textContent = '📅 预约座位';
            actionBtn.className = 'btn btn-primary btn-block';
            actionBtn.onclick = function () { bookSeat(seat.id); };
        } else {
            actionContainer.style.display = 'none';
        }
    }

    // 关闭弹窗
    window.closeSeatModal = function () {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('seatModal').style.display = 'none';
        selectedSeatId = null;
        renderSeats();
    };

    /* ========== 预约 ========== */
    window.bookSeat = function (seatId) {
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat || seat.status !== 'free') return toast('该座位不可预约', 'error');
        const existing = getBookings().filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
        if (existing.length > 0) return toast('您已有一个进行中的预约', 'error');
        const now = new Date();
        const booking = {
            id: Date.now(), userId: currentUser.id, userName: currentUser.name,
            seatCode: seat.code, date: now.toISOString().slice(0, 10),
            slot: now.getHours() + ':00 - ' + (now.getHours() + 1) + ':00',
            status: 'active', createTime: now.toISOString()
        };
        const bookings = getBookings();
        bookings.push(booking);
        setBookings(bookings);
        seat.status = 'reserved';
        setSeats(getSeats());
        closeSeatModal();
        loadAll();
        toast('预约成功！请在15分钟内签到', 'success');
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

    /* ========== 倒计时（无UI，仅后台逻辑） ========== */
    function startCountdown(totalMinutes, label, bookingId) {
        stopCountdown();
        let remainingSeconds = totalMinutes * 60;
        countdownInterval = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                handleTimeout(bookingId, label);
                return;
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
        // 如果存在 userRole 元素则更新
        const roleEl = document.getElementById('userRole');
        if (roleEl) roleEl.textContent = currentUser.role === 'admin' ? '管理员' : '学生';

        loadAll();
        startClock();

        // 绑定筛选器事件
        document.getElementById('floorFilter').addEventListener('change', loadAll);
        document.getElementById('areaFilter').addEventListener('change', loadAll);
        document.getElementById('powerFilter').addEventListener('change', loadAll); // 新增 powerFilter
    });
})();
