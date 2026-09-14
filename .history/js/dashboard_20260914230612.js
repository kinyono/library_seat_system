(function() {
    'use strict';

    // ---------- 初始化座位数据（如果 localStorage 中没有则创建默认） ----------
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

            if (seat.status === 'free') {
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

    // ---------- 弹窗 ----------
    let selectedSeatId = null;

    window.openModal = function(seat) {
        selectedSeatId = seat.id;
        document.getElementById('modalSeatCode').textContent = seat.code;
        document.getElementById('bookingModal').style.display = 'flex';
    };

    window.closeModal = function() {
        document.getElementById('bookingModal').style.display = 'none';
        selectedSeatId = null;
    };

    window.confirmBooking = function() {
        if (!selectedSeatId) return;

        const allSeats = JSON.parse(localStorage.getItem('lib_seats')) || [];
        const seat = allSeats.find(s => s.id === selectedSeatId);
        if (!seat) return;

        const timeSlot = document.getElementById('timeSlot').value;
        const user = getCurrentUser();
        if (!user) {
            alert('请先登录');
            window.location.href = '../index.html';
            return;
        }

        // 更新座位状态
        seat.status = 'reserved';
        localStorage.setItem('lib_seats', JSON.stringify(allSeats));

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

        alert(`✅ 预约成功！\n座位：${seat.code}\n时段：${timeSlot}\n请按时到馆签到。`);
        closeModal();
        renderSeats(currentFloor);
    };

    // ---------- 楼层切换 ----------
    let currentFloor = 1;

    document.addEventListener('DOMContentLoaded', function() {
        // 初始化数据
        initSeatsIfNeeded();

        // 检查是否登录
        const user = getCurrentUser();
        if (!user) {
            alert('请先登录');
            window.location.href = '../index.html';
            return;
        }
        // 显示用户名
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = user.name;
        // 显示信用分
        const creditEl = document.querySelector('.credit-badge strong');
        if (creditEl) creditEl.textContent = user.credit;

        // 楼层按钮事件
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFloor = parseInt(this.dataset.floor);
                renderSeats(currentFloor);
            });
        });

        // 初始渲染
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
