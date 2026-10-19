(function () {
    'use strict';

    let currentUser = JSON.parse(localStorage.getItem('currentUser'));
    let selectedSeatId = null;
    let countdownInterval = null;

    const STATUS_TEXT = { free: '空闲', reserved: '已预约', used: '使用中', away: '暂离', disabled: '不可用' };
    const ACTIVE_STATUS = ['active', 'checked_in', 'away', 'class_reserve'];

    // 初始化数据
    function initData() {
        if (!localStorage.getItem('lib_seats')) {
            const seats = [];
            let id = 1;
            for (let f = 1; f <= 2; f++) {
                for (let i = 1; i <= 6; i++) {
                    seats.push({ id: id++, code: `A-0${i}`, floor: f, area: 'quiet', hasPower: true, status: 'free', enabled: true });
                }
                for (let i = 1; i <= 6; i++) {
                    seats.push({ id: id++, code: `B-0${i}`, floor: f, area: 'window', hasPower: true, status: 'free', enabled: true });
                }
                for (let i = 1; i <= 6; i++) {
                    seats.push({ id: id++, code: `C-0${i}`, floor: f, area: 'quiet', hasPower: false, status: 'free', enabled: true });
                }
            }
            localStorage.setItem('lib_seats', JSON.stringify(seats));
        }
        if (!localStorage.getItem('lib_bookings')) localStorage.setItem('lib_bookings', '[]');
        if (!localStorage.getItem('lib_rules')) localStorage.setItem('lib_rules', JSON.stringify({ awayMinutes: 45, classMinutes: 120, awayPenalty: 10, classPenalty: 20, classMinCredit: 80 }));
    }

    function getSeats() { return JSON.parse(localStorage.getItem('lib_seats')); }
    function setSeats(seats) { localStorage.setItem('lib_seats', JSON.stringify(seats)); }
    function getBookings() { return JSON.parse(localStorage.getItem('lib_bookings')); }
    function setBookings(b) { localStorage.setItem('lib_bookings', JSON.stringify(b)); }
    function getRules() { return JSON.parse(localStorage.getItem('lib_rules')); }

    function toast(msg, type) { alert(msg); }

    function loadAll() {
        renderSeats();
        refreshRecommend();
        renderBookings();
    }

    function renderSeats() {
        const container = document.getElementById('seatsGrid');
        let seats = getSeats();
        const f = document.getElementById('floorFilter').value;
        const a = document.getElementById('areaFilter').value;
        const p = document.getElementById('powerFilter').value;
        
        if (f !== 'all') seats = seats.filter(s => s.floor == f);
        if (a !== 'all') seats = seats.filter(s => s.area === a);
        if (p !== 'all') seats = seats.filter(s => s.hasPower == (p === 'true'));

        if (!seats.length) { container.innerHTML = '<div class="loading">暂无座位</div>'; return; }
        
        container.innerHTML = seats.map(seat => `
            <div class="seat-item ${seat.enabled ? seat.status : 'disabled'} ${selectedSeatId === seat.id ? 'selected' : ''}" data-id="${seat.id}">
                <div class="seat-code">${seat.code}</div>
                <div class="seat-status">${STATUS_TEXT[seat.status] || seat.status}</div>
                ${seat.hasPower ? '<div class="seat-power">🔌</div>' : ''}
            </div>
        `).join('');

        // 动态绑定点击事件（解决作用域问题）
        container.querySelectorAll('.seat-item').forEach(el => {
            el.addEventListener('click', function() {
                selectSeat(parseInt(this.dataset.id));
            });
        });
    }

    function refreshRecommend() {
        const container = document.getElementById('recommendList');
        const seats = getSeats().filter(s => s.enabled && s.status === 'free');
        if (!seats.length) { container.innerHTML = '<div class="recommend-empty">暂无空闲座位</div>'; return; }
        
        const scored = seats.map(seat => {
            let score = 40;
            if (seat.hasPower) score += 25;
            if (seat.floor === 1) score += 15;
            if (seat.area === 'quiet') score += 12;
            return { seat, score };
        }).sort((a, b) => b.score - a.score).slice(0, 3);

        container.innerHTML = scored.map((r, i) => `
            <div class="recommend-item" data-id="${r.seat.id}">
                <div class="rec-rank">#${i+1}</div>
                <div class="rec-info">
                    <div class="rec-name">${r.seat.code} <span class="rec-area">${r.seat.area}</span></div>
                    <div class="rec-score-bar"><div class="rec-score-fill" style="width:${Math.min(r.score, 95)}%"></div></div>
                    <div class="rec-reasons">${r.seat.hasPower ? '有电源' : '无电源'} · ${r.seat.floor}F</div>
                </div>
                <div class="rec-score">${r.score}</div>
            </div>
        `).join('');

        container.querySelectorAll('.recommend-item').forEach(el => {
            el.addEventListener('click', function() {
                selectSeat(parseInt(this.dataset.id));
            });
        });
    }

    // 全局暴露关键函数
    window.selectSeat = function (seatId) {
        selectedSeatId = seatId;
        renderSeats();
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat) return;

        document.getElementById('modalCode').textContent = seat.code;
        document.getElementById('modalFloor').textContent = seat.floor + 'F';
        document.getElementById('modalArea').textContent = seat.area;
        document.getElementById('modalPower').textContent = seat.hasPower ? '有' : '无';
        document.getElementById('modalStatus').textContent = STATUS_TEXT[seat.status] || seat.status;

        showActionButtonsInModal(seat);

        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('seatModal').style.display = 'flex';
    };

    function showActionButtonsInModal(seat) {
        const container = document.getElementById('actionContainer');
        if (!container) return;
        container.innerHTML = '';

        const myBooking = getBookings().find(b => b.userId === currentUser.id && b.seatCode === seat.code && ACTIVE_STATUS.includes(b.status));

        if (myBooking) {
            if (myBooking.status === 'active') {
                container.innerHTML = `<button class="btn btn-success btn-block" id="actionBtn">✅ 签到</button>`;
                document.getElementById('actionBtn').addEventListener('click', () => checkIn(myBooking.id));
            } else if (myBooking.status === 'checked_in') {
                container.innerHTML = `<button class="btn btn-warning btn-block" id="awayBtn">⏸ 暂离</button><button class="btn btn-danger btn-block" style="margin-top:8px;" id="releaseBtn">🗑 释放座位</button>`;
                document.getElementById('awayBtn').addEventListener('click', () => startAway(myBooking.id));
                document.getElementById('releaseBtn').addEventListener('click', () => releaseSeat(myBooking.id));
            } else if (['away', 'class_reserve'].includes(myBooking.status)) {
                container.innerHTML = `<button class="btn btn-success btn-block" id="actionBtn">↩️ 返回座位</button>`;
                document.getElementById('actionBtn').addEventListener('click', () => returnFromStatus(myBooking.id));
            }
        } else if (seat.status === 'free' && seat.enabled) {
            container.innerHTML = `<button class="btn btn-primary btn-block" id="actionBtn">📅 预约座位</button>`;
            document.getElementById('actionBtn').addEventListener('click', () => bookSeat(seat.id));
        }
    }

    window.closeSeatModal = function () {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('seatModal').style.display = 'none';
        selectedSeatId = null;
        renderSeats();
    };

    // 绑定弹窗关闭按钮
    document.getElementById('closeModalBtn').addEventListener('click', closeSeatModal);
    document.getElementById('modalOverlay').addEventListener('click', closeSeatModal);

    window.bookSeat = function (seatId) {
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat || seat.status !== 'free') return toast('该座位不可预约', 'error');
        if (getBookings().filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status)).length > 0) return toast('您已有一个进行中的预约', 'error');
        
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

    window.checkIn = function (bookingId) { /* 简化逻辑保持核心功能 */ 
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        booking.status = 'checked_in';
        if(seat) seat.status = 'used';
        setBookings(bookings);
        if(seat) setSeats(seats);
        closeSeatModal();
        loadAll();
        toast('签到成功！');
    };

    window.releaseSeat = function (bookingId) {
        if (!confirm('确认释放当前座位？')) return;
        const bookings = getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;
        const seats = getSeats();
        const seat = seats.find(s => s.code === booking.seatCode);
        booking.status = 'cancelled';
        if(seat) seat.status = 'free';
        setBookings(bookings);
        if(seat) setSeats(seats);
        closeSeatModal();
        loadAll();
        toast('座位已释放');
    };

    function renderBookings() { /* 渲染我的预约列表 */ }

    window.logout = function() {
        localStorage.removeItem('currentUser');
        window.location.href = '../index.html';
    };

    // 启动
    document.addEventListener('DOMContentLoaded', function () {
        initData();
        if (!currentUser) { window.location.href = '../index.html'; return; }
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userCredit').textContent = currentUser.credit || 100;

        loadAll();

        document.getElementById('floorFilter').addEventListener('change', renderSeats);
        document.getElementById('areaFilter').addEventListener('change', renderSeats);
        document.getElementById('powerFilter').addEventListener('change', renderSeats);
    });
})();