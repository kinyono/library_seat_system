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
    let seatCountdownTimers = [];

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
                classMinutes: 120, classTimes: 1, classPenalty: 20, classMinCredit: 80,
                cancelPenalty: 5, cancelGraceMinutes: 30
            }));
        }
    }

    /* ========== 根据预约记录同步座位状态 ========== */
    function syncSeatStatusWithBookings() {
        const seats = getSeats();
        const bookings = getBookings();
        const now = new Date();

        seats.forEach(seat => {
            if (seat.enabled !== false && seat.status !== 'maintenance') seat.status = 'free';
        });

        bookings.forEach(booking => {
            const seat = seats.find(s => s.code === booking.seatCode);
            if (!seat || seat.enabled === false) return;
            const parts = booking.slot.split(' - ');
            if (parts.length !== 2) return;
            const [sh, sm] = parts[0].split(':').map(Number);
            const [eh, em] = parts[1].split(':').map(Number);
            const start = new Date(booking.date + 'T' + String(sh).padStart(2,'0') + ':' + String(sm).padStart(2,'0'));
            const end   = new Date(booking.date + 'T' + String(eh).padStart(2,'0') + ':' + String(em).padStart(2,'0'));

            if (now < start) {
                if (booking.status === 'active') seat.status = 'reserved';
            } else if (now >= start && now < end) {
                if (booking.status === 'checked_in') seat.status = 'used';
                else if (booking.status === 'away') seat.status = 'away';
                else if (booking.status === 'class_reserve') seat.status = 'reserved';
                else if (booking.status === 'active') seat.status = 'reserved';
            }
        });

        setSeats(seats);
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

    /* ========== 统一过滤 ========== */
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

    /* ========== 筛选状态记忆 ========== */
    function saveFilterState() {
        const state = {
            floor: document.getElementById('floorFilter').value,
            area: document.getElementById('areaFilter').value,
            power: document.getElementById('powerFilter').value
        };
        localStorage.setItem('dashboard_filter', JSON.stringify(state));
    }
    function loadFilterState() {
        const saved = localStorage.getItem('dashboard_filter');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                if (state.floor !== undefined) document.getElementById('floorFilter').value = state.floor;
                if (state.area !== undefined) document.getElementById('areaFilter').value = state.area;
                if (state.power !== undefined) document.getElementById('powerFilter').value = state.power;
            } catch(e) {}
        }
    }

    /* ========== 加载所有 ========== */
    function loadAll() {
        syncSeatStatusWithBookings();
        renderSeats();
        updateStats();
        refreshRecommend();
        attachCountdownToMySeats();
    }
    window.renderGrid = loadAll;

    /* ========== 统计 ========== */
    function updateStats() {
        const seats = getSeats();
        const bookings = getBookings();
        const filtered = filterSeats(seats);
        document.getElementById('statTotal').textContent = filtered.length;
        document.getElementById('statFree').textContent = filtered.filter(s => s.status === 'free' && s.enabled).length;
        document.getElementById('statUsed').textContent = filtered.filter(s => s.status === 'used' || s.status === 'away').length;
        const mine = bookings.filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
        document.getElementById('statMyBooking').textContent = mine.length;
        const occupied = filtered.filter(s => s.status !== 'free' && s.status !== 'maintenance').length;
        const pct = filtered.length ? Math.round((occupied / filtered.length) * 100) : 0;
        document.getElementById('statOccupancy').textContent = pct + '%';
    }

    /* ========== 渲染座位网格 ========== */
    function renderSeats() {
        const container = document.getElementById('seatGrid');
        const seats = filterSeats(getSeats());
        if (seats.length === 0) { container.innerHTML = '<div class="loading">暂无座位</div>'; return; }

        const bookings = getBookings();
        const activeBookings = bookings.filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
        const myBookedCodes = new Set(activeBookings.map(b => b.seatCode));

        container.innerHTML = seats.map(seat => {
            const baseCls = seat.enabled ? seat.status : 'disabled';
            const sel = selectedSeatId === seat.id ? ' selected' : '';
            let extraCls = '';
            if (myBookedCodes.has(seat.code)) extraCls = ' my-booking';
            else if (seat.status === 'reserved') extraCls = ' booked-by-other';
            const areaName = { quiet:'静音', discuss:'讨论', window:'靠窗' }[seat.area] || '';
            return `<div class="seat-item ${baseCls}${sel}${extraCls}" data-id="${seat.id}" onclick="window.selectSeat(${seat.id})">
                <div class="seat-code">${seat.code}</div>
                <div class="seat-area-tag">${areaName}</div>
                <div class="seat-status">${STATUS_TEXT[seat.status] || seat.status}</div>
                ${seat.hasPower ? '<div class="seat-power">🔌</div>' : ''}
            </div>`;
        }).join('');
    }

    /* ========== 推荐座位 ========== */
    function refreshRecommend() {
        const container = document.getElementById('recommendList');
        const seats = getSeats().filter(s => s.enabled && s.status === 'free');
        if (!seats.length) { container.innerHTML = '<div class="recommend-empty">暂无空闲座位</div>'; return; }
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
            <div class="recommend-item ${i===0?'top1':''}" onclick="window.selectSeat(${r.seat.id}); scrollToSeatInGrid(${r.seat.id});">
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

    /* ========== 推荐联动滚动高亮 ========== */
    function scrollToSeatInGrid(seatId) {
        const card = document.querySelector(`.seat-item[data-id="${seatId}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('recommend-highlight');
        setTimeout(() => card.classList.remove('recommend-highlight'), 2000);
    }
    window.scrollToSeatInGrid = scrollToSeatInGrid;

    /* ========== 我的座位倒计时 ========== */
    function attachCountdownToMySeats() {
        seatCountdownTimers.forEach(clearInterval);
        seatCountdownTimers = [];
        const bookings = getBookings();
        const now = new Date();
        bookings.forEach(b => {
            if (b.userId !== currentUser.id || b.status !== 'active') return;
            const parts = b.slot.split(' - ');
            const [sh, sm] = parts[0].split(':').map(Number);
            const start = new Date(b.date + 'T' + String(sh).padStart(2,'0') + ':' + String(sm).padStart(2,'0'));
            if (start <= now) return;
            const card = document.querySelector(`.seat-item[data-id="${getSeatIdByCode(b.seatCode)}"]`);
            if (!card) return;
            let cdEl = card.querySelector('.seat-countdown');
            if (!cdEl) { cdEl = document.createElement('div'); cdEl.className = 'seat-countdown'; card.appendChild(cdEl); }
            const update = () => {
                const diff = start - new Date();
                if (diff <= 0) { cdEl.textContent = '⏰ 可签到'; cdEl.classList.add('urgent'); return true; }
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                cdEl.textContent = `⏱ ${h>0?h+':':''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                return false;
            };
            if (!update()) {
                const timer = setInterval(() => { if (update()) { clearInterval(timer); loadAll(); } }, 1000);
                seatCountdownTimers.push(timer);
            }
        });
    }
    function getSeatIdByCode(code) {
        const seat = getSeats().find(s => s.code === code);
        return seat ? seat.id : null;
    }

    /* ========== 时段选择 ========== */
    function populateTimeSlots() {
        const startSelect = document.getElementById('startHour');
        const endSelect = document.getElementById('endHour');
        if (!startSelect || !endSelect) return;
        startSelect.innerHTML = ''; endSelect.innerHTML = '';
        const now = new Date();
        const currentHour = Math.floor(now.getHours());
        for (let i = currentHour; i <= 22; i++) {
            const opt = document.createElement('option');
            opt.value = i; opt.textContent = `${String(i).padStart(2,'0')}:00`;
            startSelect.appendChild(opt);
        }
        const defaultEnd = Math.min(currentHour + 1, 23);
        for (let i = defaultEnd; i <= 23; i++) {
            const opt = document.createElement('option');
            opt.value = i; opt.textContent = `${String(i).padStart(2,'0')}:00`;
            endSelect.appendChild(opt);
        }
        startSelect.value = currentHour; endSelect.value = defaultEnd;
        startSelect.onchange = function () {
            const startVal = parseInt(this.value, 10);
            endSelect.innerHTML = '';
            for (let i = startVal + 1; i <= 23; i++) {
                const opt = document.createElement('option');
                opt.value = i; opt.textContent = `${String(i).padStart(2,'0')}:00`;
                endSelect.appendChild(opt);
            }
            endSelect.value = Math.min(startVal + 1, 23);
        };
    }

    function getRemainingTimeText(slot) {
        const [startStr] = slot.split(' - ');
        const [sh, sm] = startStr.split(':').map(Number);
        const startTime = new Date();
        startTime.setHours(sh, sm, 0, 0);
        const diffMs = startTime - new Date();
        if (diffMs <= 0) return '预约已开始';
        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `距开始还有 ${hours} 小时 ${mins} 分钟` : `距开始还有 ${mins} 分钟`;
    }

    /* ========== 选择座位弹窗 ========== */
    window.selectSeat = function (seatId) {
        selectedSeatId = seatId;
        renderSeats();
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat) return;
        document.getElementById('detailCode').textContent = seat.code;
        document.getElementById('detailCodeValue').textContent = seat.code;
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
        const timeSlotSelector = document.getElementById('timeSlotSelector');
        const myBooking = getBookings().find(b => b.userId === currentUser.id && b.seatCode === seat.code && ACTIVE_STATUS.includes(b.status));

        if (myBooking) {
            timeSlotSelector.style.display = 'none';
            if (myBooking.status === 'active') {
                const remainingText = getRemainingTimeText(myBooking.slot);
                actionContainer.innerHTML = `
                    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;text-align:center;">${remainingText}</div>
                    <button class="btn btn-success btn-block" onclick="checkIn(${myBooking.id})">✅ 签到</button>
                    <button class="btn btn-danger btn-block" style="margin-top:8px;" onclick="cancelBooking(${myBooking.id})">❌ 取消预约</button>`;
            } else if (myBooking.status === 'checked_in') {
                actionContainer.innerHTML = `
                    <button class="btn btn-warning btn-block" onclick="startAway(${myBooking.id})">⏸ 暂离</button>
                    <button class="btn btn-danger btn-block" style="margin-top:8px;" onclick="releaseSeat(${myBooking.id})">🗑 释放座位</button>`;
            } else if (myBooking.status === 'away' || myBooking.status === 'class_reserve') {
                actionContainer.innerHTML = `<button class="btn btn-success btn-block" onclick="returnFromStatus(${myBooking.id})">↩️ 返回座位</button>`;
            }
        } else if (seat.status === 'free' && seat.enabled) {
            timeSlotSelector.style.display = 'block';
            populateTimeSlots();
            actionContainer.innerHTML = `<button class="btn btn-primary btn-block" onclick="bookSeat(${seat.id})">📅 预约座位</button>`;
        } else {
            timeSlotSelector.style.display = 'none';
            actionContainer.innerHTML = '';
        }
    }

    window.closeSeatModal = function () {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('seatModal').style.display = 'none';
        document.getElementById('detailCode').textContent = '座位详情';
        document.getElementById('detailCodeValue').textContent = '';
        document.getElementById('detailFloor').textContent = '';
        document.getElementById('detailArea').textContent = '';
        document.getElementById('detailPower').textContent = '';
        document.getElementById('detailStatus').textContent = '';
        document.getElementById('timeSlotSelector').style.display = 'none';
        document.getElementById('actionContainer').innerHTML = '';
        selectedSeatId = null;
        renderSeats();
    };

    /* ========== 预约 ========== */
    window.bookSeat = function (seatId) {
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat || seat.status !== 'free') return toast('该座位不可预约', 'error');
        const existing = getBookings().filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
        if (existing.length > 0) return toast('您已有一个进行中的预约', 'error');
        const startHour = parseInt(document.getElementById('startHour').value, 10);
        const endHour = parseInt(document.getElementById('endHour').value, 10);
        if (isNaN(startHour) || isNaN(endHour) || endHour <= startHour) return toast('请选择有效的时段', 'error');
        const now = new Date();
        const currentHour = Math.floor(now.getHours());
        if (startHour < currentHour) return toast('不能预约已经过去的时间段', 'error');
        const endSlotTime = new Date(); endSlotTime.setHours(endHour, 0, 0, 0);
        if (endSlotTime <= now) return toast('该时段已结束，请选择当前时间之后的时段', 'error');
        const dateStr = now.toISOString().slice(0, 10);
        const slot = `${String(startHour).padStart(2,'0')}:00 - ${String(endHour).padStart(2,'0')}:00`;
        const booking = { id: Date.now(), userId: currentUser.id, userName: currentUser.name, seatCode: seat.code, date: dateStr, slot: slot, status: 'active', createTime: now.toISOString() };
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
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return toast('座位不存在', 'error');
        booking.status = 'checked_in'; seat.status = 'used';
        recordActualStart(booking.id);
        setBookings(bookings); setSeats(getSeats());
        closeSeatModal(); loadAll(); toast('签到成功！', 'success');
    };

    /* ========== 取消 ========== */
    window.cancelBooking = function (bookingId) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'active') return toast('当前状态不可取消', 'error');
        if (!confirm('确定要取消此预约吗？')) return;
        const now = new Date();
        const [startStr] = booking.slot.split(' - ');
        const [sh, sm] = startStr.split(':').map(Number);
        const startTime = new Date(); startTime.setHours(sh, sm, 0, 0);
        const rules = getRules();
        const graceMinutes = rules.cancelGraceMinutes || 30;
        const isLate = now > new Date(startTime.getTime() + graceMinutes * 60 * 1000);
        booking.status = 'cancelled';
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (seat) seat.status = 'free';
        setBookings(bookings); setSeats(getSeats());
        if (isLate) {
            const penalty = rules.cancelPenalty || 5;
            currentUser.credit = Math.max(0, (currentUser.credit ?? 100) - penalty);
            updateUserInStorage(currentUser);
            document.getElementById('userCredit').textContent = currentUser.credit;
            toast(`已超过预约时间${graceMinutes}分钟，扣除 ${penalty} 信誉分`, 'error');
        } else {
            toast('预约已取消，未扣分', 'success');
        }
        stopCountdown(); loadAll(); closeSeatModal();
    };

    /* ========== 暂离 ========== */
    window.startAway = function (bookingId) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'checked_in') return toast('当前状态不允许暂离', 'error');
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'away'; seat.status = 'away';
        setBookings(bookings); setSeats(getSeats());
        const awayMinutes = (getRules().awayMinutes || 45);
        startCountdown(awayMinutes * 60, '暂离中', bookingId);
        closeSeatModal(); loadAll(); toast(`暂离已启动，${awayMinutes}分钟内返回`, 'info');
    };

    window.startClassReserve = function (bookingId) {
        const rules = getRules();
        if ((currentUser.credit ?? 100) < (rules.classMinCredit || 80)) return toast('信用分不足80，无法使用上课保留', 'error');
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== 'checked_in') return toast('当前状态不允许上课保留', 'error');
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'class_reserve'; seat.status = 'reserved';
        setBookings(bookings); setSeats(getSeats());
        const classMinutes = rules.classMinutes || 120;
        startCountdown(classMinutes * 60, '上课保留中', bookingId);
        closeSeatModal(); loadAll(); toast(`上课保留已启动，座位保留${classMinutes}分钟`, 'info');
    };

    window.returnFromStatus = function (bookingId) {
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || !['away','class_reserve'].includes(booking.status)) return toast('当前状态无需返回', 'error');
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return;
        booking.status = 'checked_in'; seat.status = 'used';
        setBookings(bookings); setSeats(getSeats());
        stopCountdown(); closeSeatModal(); loadAll(); toast('已返回座位，计时暂停', 'success');
    };

    window.releaseSeat = function (bookingId) {
        if (!confirm('确认释放当前座位？')) return;
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking || !ACTIVE_STATUS.includes(booking.status)) return toast('当前状态不允许释放', 'error');
        const seat = getSeats().find(s => s.code === booking.seatCode);
        if (!seat) return;
        recordActualEnd(bookingId);
        booking.status = 'cancelled'; seat.status = 'free';
        setBookings(bookings); setSeats(getSeats());
        stopCountdown(); loadAll(); closeSeatModal(); toast('座位已释放', 'success');
    };

    /* ========== 倒计时 ========== */
    function startCountdown(totalSeconds, label, bookingId) {
        stopCountdown();
        let remaining = totalSeconds;
        const panel = document.getElementById('timerPanel');
        const labelEl = document.getElementById('timerLabel');
        const remainEl = document.getElementById('timerRemaining');
        const progressEl = document.getElementById('timerProgress');
        labelEl.textContent = label;
        panel.style.display = 'block';
        const update = () => {
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            remainEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            progressEl.style.width = ((remaining / totalSeconds) * 100) + '%';
        };
        update();
        countdownInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(countdownInterval); countdownInterval = null;
                panel.style.display = 'none';
                handleTimeout(bookingId, label);
            } else update();
        }, 1000);
    }
    function stopCountdown() {
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        const panel = document.getElementById('timerPanel');
        if (panel) panel.style.display = 'none';
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
        recordActualEnd(bookingId);
        booking.status = 'cancelled'; seat.status = 'free';
        setBookings(bookings); setSeats(getSeats());
        loadAll(); toast(`${label}超时，扣除${penalty}分`, 'error');
    }

    /* ========== 时长记录 ========== */
    function recordActualStart(bookingId) {
        const bookings = getBookings();
        const b = bookings.find(x => x.id === bookingId);
        if (b && !b.actualStart) { b.actualStart = new Date().toISOString(); setBookings(bookings); }
    }
    function recordActualEnd(bookingId) {
        const bookings = getBookings();
        const b = bookings.find(x => x.id === bookingId);
        if (b && !b.actualEnd) { b.actualEnd = new Date().toISOString(); setBookings(bookings); }
    }

    /* ========== 时间轴视图 ========== */
    function renderTimelineView() {
        const container = document.getElementById('timelineContainer');
        if (!container) return;
        container.innerHTML = '';
        const today = new Date().toISOString().slice(0, 10);
        const todayBookings = getBookings().filter(b => b.date === today).sort((a, b) => a.slot.localeCompare(b.slot));
        if (todayBookings.length === 0) { container.innerHTML = '<div class="loading">今天暂无预约记录</div>'; return; }
        const list = document.createElement('div');
        list.className = 'timeline-list';
        const statusText = { active:'待签到', checked_in:'使用中', away:'暂离', class_reserve:'上课保留', cancelled:'已取消', completed:'已完成' };
        todayBookings.forEach(b => {
            const item = document.createElement('div');
            item.className = 'timeline-row';
            item.innerHTML = `
                <div class="tl-time">${b.slot}</div>
                <div class="tl-seat">${b.seatCode}</div>
                <div class="tl-user">${b.userName}${b.userId === currentUser.id ? ' (我)' : ''}</div>
                <div class="tl-status-tag ${b.status}">${statusText[b.status] || b.status}</div>`;
            list.appendChild(item);
        });
        container.appendChild(list);
    }
    function switchView(view) {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        const isGrid = view === 'grid';
        document.getElementById('seatGrid').style.display = isGrid ? 'grid' : 'none';
        const tl = document.getElementById('timelineContainer');
        tl.style.display = isGrid ? 'none' : 'block';
        if (!isGrid) renderTimelineView();
    }

    /* ========== 时钟 ========== */
    function startClock() {
        const el = document.getElementById('realtimeClock');
        if (!el) return;
        const tick = () => {
            const d = new Date();
            const p = n => String(n).padStart(2,'0');
            el.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        };
        tick(); setInterval(tick, 1000);
    }

    /* ========== 退出 ========== */
    window.logout = function () {
        localStorage.removeItem('currentUser');
        window.location.href = '../index.html';
    };

    /* ========== 启动 ========== */
    document.addEventListener('DOMContentLoaded', function () {
        initData();
        if (!currentUser) { window.location.href = '../index.html'; return; }
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userCredit').textContent = currentUser.credit;

        loadFilterState();
        loadAll();
        startClock();

        function onFilterChange() { saveFilterState(); loadAll(); }
        document.getElementById('floorFilter').addEventListener('change', onFilterChange);
        document.getElementById('areaFilter').addEventListener('change', onFilterChange);
        document.getElementById('powerFilter').addEventListener('change', onFilterChange);

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        });

        // 30秒自动刷新
        setInterval(() => { if (document.visibilityState === 'visible') loadAll(); }, 30000);

        // 多标签页同步
        window.addEventListener('storage', (e) => {
            if (['lib_seats','lib_bookings','currentUser'].includes(e.key)) loadAll();
        });
    });
})();