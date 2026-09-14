(function() {
    'use strict';

    // ---------- 初始化座位数据 ----------
    function initSeatsIfNeeded() {
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
    }

    // ---------- 获取当前用户 ----------
    function getCurrentUser() {
        const raw = localStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    }

    // ---------- 保存用户（更新信用分等） ----------
    function saveUser(user) {
        const users = JSON.parse(localStorage.getItem('lib_users')) || [];
        const idx = users.findIndex(u => u.id === user.id);
        if (idx >= 0) {
            users[idx] = user;
        } else {
            users.push(user);
        }
        localStorage.setItem('lib_users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(user)); // 同步当前会话
    }

    // ---------- 渲染座位 ----------
    function renderSeats(floor) {
        const grid = document.getElementById('seatGrid');
        if (!grid) return;
        grid.innerHTML = '';

        const allSeats = JSON.parse(localStorage.getItem('lib_seats')) || [];
        const seats = allSeats.filter(s => s.floor === floor && s.enabled);

        seats.forEach(seat => {
            const div = document.createElement('div');
            div.className = `seat ${seat.status}`;
            div.dataset.id = seat.id;
            div.innerHTML = `
                <span>${seat.code}</span>
                <span class="seat-label">${getStatusLabel(seat.status)}</span>
            `;

            // 可点击的状态：free（预约）、used（暂离/上课保留）、reserved（签到）、away（返回）
            if (['free', 'used', 'reserved', 'away'].includes(seat.status)) {
                div.addEventListener('click', () => openModal(seat));
            }

            grid.appendChild(div);
        });

        updateStats(floor);
    }

    function getStatusLabel(status) {
        const map = { free: '空闲', used: '使用中', away: '暂离', reserved: '已预约', maintenance: '维修' };
        return map[status] || status;
    }

    function updateStats(floor) {
        const allSeats = JSON.parse(localStorage.getItem('lib_seats')) || [];
        const seats = allSeats.filter(s => s.floor === floor);
        document.getElementById('freeCount').textContent = seats.filter(s => s.status === 'free').length;
        document.getElementById('usedCount').textContent = seats.filter(s => s.status === 'used').length;
        document.getElementById('awayCount').textContent = seats.filter(s => s.status === 'away').length;
        document.getElementById('maintenanceCount').textContent = seats.filter(s => s.status === 'maintenance').length;
    }

    // ---------- 弹窗逻辑 ----------
    let selectedSeatId = null;
    let currentModalMode = ''; // 'book', 'checkin', 'leave', 'class', 'return'

    window.openModal = function(seat) {
        selectedSeatId = seat.id;
        document.getElementById('modalSeatCode').textContent = seat.code;
        document.getElementById('modalStatus').textContent = getStatusLabel(seat.status);
        document.getElementById('bookingModal').style.display = 'flex';

        const primaryBtn = document.getElementById('btnPrimary');
        const secondaryBtn = document.getElementById('btnSecondary');
        const tertiaryBtn = document.getElementById('btnTertiary');
        const bookingSection = document.getElementById('bookingSection');

        // 根据状态显示不同按钮
        switch(seat.status) {
            case 'free':
                currentModalMode = 'book';
                primaryBtn.textContent = '确认预约';
                primaryBtn.style.display = 'block';
                secondaryBtn.style.display = 'none';
                tertiaryBtn.style.display = 'none';
                bookingSection.style.display = 'block';
                break;
            case 'reserved':
                currentModalMode = 'checkin';
                primaryBtn.textContent = '✅ 签到入座';
                primaryBtn.style.display = 'block';
                secondaryBtn.style.display = 'none';
                tertiaryBtn.style.display = 'none';
                bookingSection.style.display = 'none';
                break;
            case 'used':
                currentModalMode = 'actions';
                primaryBtn.textContent = '⏳ 暂离';
                secondaryBtn.textContent = '📚 上课保留';
                primaryBtn.style.display = 'block';
                secondaryBtn.style.display = 'block';
                tertiaryBtn.style.display = 'none';
                bookingSection.style.display = 'none';
                break;
            case 'away':
                currentModalMode = 'return';
                primaryBtn.textContent = '↩️ 返回座位';
                primaryBtn.style.display = 'block';
                secondaryBtn.style.display = 'none';
                tertiaryBtn.style.display = 'none';
                bookingSection.style.display = 'none';
                break;
            default:
                closeModal();
                alert('该座位不可操作');
        }
    };

    window.closeModal = function() {
        document.getElementById('bookingModal').style.display = 'none';
        selectedSeatId = null;
        currentModalMode = '';
    };

    // ---------- 主要操作按钮 ----------
    window.handlePrimaryAction = function() {
        const allSeats = JSON.parse(localStorage.getItem('lib_seats')) || [];
        const seat = allSeats.find(s => s.id === selectedSeatId);
        if (!seat) return;

        const user = getCurrentUser();
        if (!user) {
            alert('请先登录');
            window.location.href = '../index.html';
            return;
        }

        switch(currentModalMode) {
            case 'book':
                doBooking(seat, user);
                break;
            case 'checkin':
                doCheckin(seat, user);
                break;
            case 'actions':
                doLeave(seat, user);
                break;
            case 'return':
                doReturn(seat, user);
                break;
        }
    };

    // 次要操作按钮（暂离时的上课保留）
    window.handleSecondaryAction = function() {
        if (currentModalMode !== 'actions') return;
        const allSeats = JSON.parse(localStorage.getItem('lib_seats')) || [];
        const seat = allSeats.find(s => s.id === selectedSeatId);
        if (!seat) return;
        const user = getCurrentUser();
        if (!user) return;
        doClassReserve(seat, user);
    };

    // 第三个按钮暂时不用
    window.handleTertiaryAction = function() {}

    // ---------- 具体功能 ----------

    // 预约
    function doBooking(seat, user) {
        const timeSlot = document.getElementById('timeSlot').value;
        seat.status = 'reserved';
        localStorage.setItem('lib_seats', JSON.stringify(
            JSON.parse(localStorage.getItem('lib_seats')).map(s => s.id === seat.id ? seat : s)
        ));
        // 添加预约记录
        const bookings = JSON.parse(localStorage.getItem('lib_bookings')) || [];
        bookings.push({
            id: Date.now(),
            userId: user.id,
            userName: user.name,
            seatCode: seat.code,
            date: new Date().toISOString().slice(0, 10),
            slot: timeSlot,
            status: 'active'
        });
        localStorage.setItem('lib_bookings', JSON.stringify(bookings));
        alert(`✅ 预约成功！座位：${seat.code}，时段：${timeSlot}`);
        closeModal();
        renderSeats(currentFloor);
    }

    // 签到
    function doCheckin(seat, user) {
        seat.status = 'used';
        localStorage.setItem('lib_seats', JSON.stringify(
            JSON.parse(localStorage.getItem('lib_seats')).map(s => s.id === seat.id ? seat : s)
        ));
        // 更新预约记录状态
        const bookings = JSON.parse(localStorage.getItem('lib_bookings')) || [];
        const booking = bookings.find(b => b.seatCode === seat.code && b.status === 'active');
        if (booking) booking.status = 'checked_in';
        localStorage.setItem('lib_bookings', JSON.stringify(bookings));
        alert(`✅ 签到成功！座位 ${seat.code} 已入座。`);
        closeModal();
        renderSeats(currentFloor);
    }

    // 暂离（45分钟计时）
    function doLeave(seat, user) {
        if (user.credit < 10) {
            alert('信用分不足10分，无法暂离');
            return;
        }
        seat.status = 'away';
        localStorage.setItem('lib_seats', JSON.stringify(
            JSON.parse(localStorage.getItem('lib_seats')).map(s => s.id === seat.id ? seat : s)
        ));
        alert(`⏳ 暂离模式启动，请45分钟内返回，超时将扣10分。`);

        // 设置45分钟倒计时（实际开发应由后端定时任务处理，此处用setTimeout模拟）
        setTimeout(() => {
            const currentSeats = JSON.parse(localStorage.getItem('lib_seats')) || [];
            const currentSeat = currentSeats.find(s => s.id === seat.id);
            if (currentSeat && currentSeat.status === 'away') {
                // 超时：释放座位，扣分
                currentSeat.status = 'free';
                localStorage.setItem('lib_seats', JSON.stringify(currentSeats));
                user.credit -= 10;
                if (user.credit < 0) user.credit = 0;
                saveUser(user);
                // 更新页面显示
                renderSeats(currentFloor);
                // 更新信用分显示
                const creditEl = document.querySelector('.credit-badge strong');
                if (creditEl) creditEl.textContent = user.credit;
                alert(`⚠️ 暂离超时！座位 ${currentSeat.code} 已释放，信用分扣除10分（当前：${user.credit}分）`);
            }
        }, 45 * 60 * 1000); // 45分钟，测试时可改为短时间如5000（5秒）

        closeModal();
        renderSeats(currentFloor);
    }

    // 上课保留（120分钟计时，需信用分>=80）
    function doClassReserve(seat, user) {
        if (user.credit < 80) {
            alert('信用分不足80分，无法使用上课保留功能');
            return;
        }
        seat.status = 'reserved'; // 保留状态，但标记为上课保留（可用其他字段区分，这里简单复用reserved）
        localStorage.setItem('lib_seats', JSON.stringify(
            JSON.parse(localStorage.getItem('lib_seats')).map(s => s.id === seat.id ? seat : s)
        ));
        alert(`📚 上课保留已开启，座位将保留120分钟，超时将扣20分。`);

        setTimeout(() => {
            const currentSeats = JSON.parse(localStorage.getItem('lib_seats')) || [];
            const currentSeat = currentSeats.find(s => s.id === seat.id);
            if (currentSeat && currentSeat.status === 'reserved') {
                currentSeat.status = 'free';
                localStorage.setItem('lib_seats', JSON.stringify(currentSeats));
                user.credit -= 20;
                if (user.credit < 0) user.credit = 0;
                saveUser(user);
                renderSeats(currentFloor);
                const creditEl = document.querySelector('.credit-badge strong');
                if (creditEl) creditEl.textContent = user.credit;
                alert(`⚠️ 上课保留超时！座位 ${currentSeat.code} 已释放，信用分扣除20分（当前：${user.credit}分）`);
            }
        }, 120 * 60 * 1000); // 120分钟，测试可改为10000（10秒）

        closeModal();
        renderSeats(currentFloor);
    }

    // 返回座位（暂离或上课保留中返回）
    function doReturn(seat, user) {
        seat.status = 'used';
        localStorage.setItem('lib_seats', JSON.stringify(
            JSON.parse(localStorage.getItem('lib_seats')).map(s => s.id === seat.id ? seat : s)
        ));
        alert(`↩️ 已返回座位，继续使用。`);
        closeModal();
        renderSeats(currentFloor);
    }

    // ---------- 楼层切换 ----------
    let currentFloor = 1;

    document.addEventListener('DOMContentLoaded', function() {
        initSeatsIfNeeded();

        const user = getCurrentUser();
        if (!user) {
            alert('请先登录');
            window.location.href = '../index.html';
            return;
        }
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = user.name;
        const creditEl = document.querySelector('.credit-badge strong');
        if (creditEl) creditEl.textContent = user.credit;

        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFloor = parseInt(this.dataset.floor);
                renderSeats(currentFloor);
            });
        });

        renderSeats(1);
    });

    // ---------- 退出登录 ----------
    window.logout = function() {
        if (confirm('确认退出登录？')) {
            localStorage.removeItem('currentUser');
            window.location.href = '../index.html';
        }
    };
})();
