(function () {
    'use strict';

    let currentUser = null;
    const ACTIVE_STATUS = ['active', 'checked_in', 'away', 'class_reserve'];

    // 安全的设置文本函数
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // 初始化数据
    function initData() {
        currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) return;

        // 兼容可能的角色字段
        if (!currentUser.role) currentUser.role = 'student';
    }

    // 获取座位/预约等基础数据（模拟）
    function getSeats() { return JSON.parse(localStorage.getItem('lib_seats') || '[]'); }
    function setSeats(seats) { localStorage.setItem('lib_seats', JSON.stringify(seats)); }
    function getBookings() { return JSON.parse(localStorage.getItem('lib_bookings') || '[]'); }
    function setBookings(bookings) { localStorage.setItem('lib_bookings', JSON.stringify(bookings)); }
    function getRules() { return JSON.parse(localStorage.getItem('lib_rules') || '{}'); }

    function updateUserInStorage(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        // 同步更新用户列表
        let users = JSON.parse(localStorage.getItem('lib_users') || '[]');
        const idx = users.findIndex(u => u.studentId === user.studentId);
        if (idx > -1) users[idx] = user;
        localStorage.setItem('lib_users', JSON.stringify(users));
    }

    // 简易 Toast
    function toast(msg, type) {
        console.log(`[${type}] ${msg}`);
        // 如果有UI toast可以挂载到这里
        alert(msg); 
    }

    // 加载所有数据并更新UI
    function loadAll() {
        const seats = getSeats();
        const bookings = getBookings();

        // 统计
        setText('statTotal', seats.length);
        setText('statFree', seats.filter(s => s.status === 'free').length);
        setText('statUsed', seats.filter(s => s.status === 'used' || s.status === 'reserved').length);
        
        const myActiveBookings = bookings.filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
        setText('statMyBooking', myActiveBookings.length);
        
        const occupied = seats.length ? Math.round((seats.filter(s => s.status !== 'free').length / seats.length) * 100) : 0;
        setText('statOccupancy', occupied + '%');

        renderGrid();
        refreshRecommend();
    }

    // 渲染座位网格
    function renderGrid() {
        const grid = document.getElementById('seatGrid');
        if (!grid) return;
        const floor = document.getElementById('floorFilter')?.value || 'all';
        const area = document.getElementById('areaFilter')?.value || 'all';
        const power = document.getElementById('powerFilter')?.value || 'all';

        let seats = getSeats();
        seats = seats.filter(s => floor === 'all' || s.floor == floor)
                       .filter(s => area === 'all' || s.area === area)
                       .filter(s => power === 'all' || (power === 'yes' ? s.power : !s.power));

        grid.innerHTML = seats.map(s => `
            <div class="seat ${s.status}" onclick="window.openSeatModal(${s.id})">
                ${s.code}<br><small>${s.status}</small>
            </div>
        `).join('');
    }

    // 推荐座位
    function refreshRecommend() {
        const list = document.getElementById('recommendList');
        if (!list) return;
        const seats = getSeats().filter(s => s.status === 'free');
        if (seats.length === 0) {
            list.innerHTML = '<div class="loading">暂无推荐</div>';
            return;
        }
        list.innerHTML = seats.slice(0, 3).map(s => `<div>💺 ${s.code} (${s.floor}F)</div>`).join('');
    }

    // 弹窗逻辑
    window.openSeatModal = function (seatId) {
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat) return;

        setText('detailCode', seat.code);
        setText('detailFloor', seat.floor + 'F');
        setText('detailArea', seat.area);
        setText('detailPower', seat.power ? '有' : '无');
        setText('detailStatus', seat.status);

        const actionsDiv = document.getElementById('actionContainer');
        if (actionsDiv) {
            let html = '';
            if (seat.status === 'free') {
                html += `<button class="btn btn-primary btn-block" onclick="window.bookSeat(${seat.id})">预约座位</button>`;
            }
            // 这里可以根据预约状态添加签到/释放按钮...
            actionsDiv.innerHTML = html;
        }

        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('seatModal').style.display = 'block';
    };

    window.closeSeatModal = function () {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('seatModal').style.display = 'none';
    };

    // 预约逻辑
    window.bookSeat = function (seatId) {
        const seat = getSeats().find(s => s.id === seatId);
        if (!seat || seat.status !== 'free') return toast('该座位不可预约', 'error');

        const existing = getBookings().filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
        if (existing.length > 0) return toast('您已有一个进行中的预约', 'error');

        const booking = {
            id: Date.now(), userId: currentUser.id, userName: currentUser.name,
            seatCode: seat.code, status: 'active', createTime: new Date().toISOString()
        };

        const bookings = getBookings();
        bookings.push(booking);
        setBookings(bookings);

        seat.status = 'reserved';
        setSeats(getSeats());

        closeSeatModal();
        loadAll();
        toast('预约成功！', 'success');
    };

    // 暴露给 HTML onchange
    window.renderGrid = renderGrid;
    window.refreshRecommend = refreshRecommend;

    // 启动
    document.addEventListener('DOMContentLoaded', function () {
        initData();
        if (!currentUser) { 
            window.location.href = '../index.html'; 
            return; 
        }

        setText('userName', currentUser.name);
        setText('userCredit', currentUser.credit ?? 100);

        loadAll();

        // 绑定筛选器
        document.getElementById('floorFilter')?.addEventListener('change', renderGrid);
        document.getElementById('areaFilter')?.addEventListener('change', renderGrid);
        document.getElementById('powerFilter')?.addEventListener('change', renderGrid);
    });
})();
