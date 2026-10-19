(function () {
    'use strict';

    let seats = [];
    let selectedSeatId = null;

    // ========== 初始化数据 ==========
    function initData() {
        const stored = localStorage.getItem('lib_seats');
        if (stored) {
            seats = JSON.parse(stored);
            return;
        }
        seats = [];
        let id = 1;
        for (let f = 1; f <= 2; f++) {
            for (let i = 1; i <= 6; i++) {
                seats.push({ id: id++, code: `A-${String(i).padStart(2,'0')}`, floor: f, area: 'quiet', hasPower: true, status: 'free', enabled: true });
                seats.push({ id: id++, code: `B-${String(i).padStart(2,'0')}`, floor: f, area: 'window', hasPower: true, status: 'free', enabled: true });
                seats.push({ id: id++, code: `C-${String(i).padStart(2,'0')}`, floor: f, area: 'quiet', hasPower: false, status: 'free', enabled: true });
            }
        }
        localStorage.setItem('lib_seats', JSON.stringify(seats));
    }

    // ========== 渲染座位网格 ==========
    function renderSeats(list) {
        const container = document.getElementById('seatGrid');
        if (!container) return;
        container.innerHTML = '';
        const data = list || seats;
        data.forEach(seat => {
            const div = document.createElement('div');
            div.className = 'seat-item';
            if (seat.status !== 'free') div.classList.add('occupied');
            div.innerHTML = `
                <span class="seat-code">${seat.code}</span>
                <span class="seat-status">${seat.status === 'free' ? '空闲' : seat.status}</span>
                ${seat.hasPower ? '<span class="power-icon">⚡</span>' : ''}
            `;
            // 关键：使用 addEventListener，不用内联 onclick
            div.addEventListener('click', function () {
                selectSeat(seat.id);
            });
            container.appendChild(div);
        });
    }

    // ========== 渲染统计卡片 ==========
    function renderStats() {
        // 如果有统计卡片，可以在此更新
    }

    // ========== 渲染推荐座位 ==========
    function renderRecommend() {
        const container = document.getElementById('recommendList');
        if (!container) return;
        const freeSeats = seats.filter(s => s.status === 'free');
        const recommend = freeSeats.slice(0, 5);
        container.innerHTML = recommend.map(s => `
            <div class="recommend-item" onclick="selectSeat(${s.id})">
                <span>${s.code}</span>
                <span class="badge">${s.area}</span>
            </div>
        `).join('');
    }

    // ========== 更新右侧详情 ==========
    function updateDetail(seat) {
        document.getElementById('detailCode').textContent = seat.code;
        document.getElementById('detailFloor').textContent = seat.floor + 'F';
        document.getElementById('detailArea').textContent = seat.area;
        document.getElementById('detailPower').textContent = seat.hasPower ? '有' : '无';
        document.getElementById('detailStatus').textContent = seat.status;
    }

    // ========== 弹窗相关 ==========
    window.selectSeat = function (id) {
        const seat = seats.find(s => s.id === id);
        if (!seat) return;

        const titleEl = document.getElementById('seatModalTitle');
        if (titleEl) titleEl.textContent = '座位 ' + seat.code;

        document.getElementById('modalCode').textContent = seat.code;
        document.getElementById('modalFloor').textContent = seat.floor + 'F';
        document.getElementById('modalArea').textContent = seat.area;
        document.getElementById('modalPower').textContent = seat.hasPower ? '有' : '无';
        document.getElementById('modalStatus').textContent = seat.status;

        showActionButtonsInModal(seat);

        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('seatModal').style.display = 'block';

        updateDetail(seat);
        selectedSeatId = id;
    };

    function showActionButtonsInModal(seat) {
        const container = document.getElementById('actionContainer');
        if (!container) return;
        container.innerHTML = '';

        if (seat.status === 'free') {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = '📅 预约座位';
            btn.addEventListener('click', function () { bookSeat(seat.id); });
            container.appendChild(btn);
        } else if (seat.status === 'reserved') {
            const checkinBtn = document.createElement('button');
            checkinBtn.className = 'btn btn-success';
            checkinBtn.textContent = '✅ 签到';
            checkinBtn.addEventListener('click', function () { checkinSeat(seat.id); });
            container.appendChild(checkinBtn);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-danger';
            cancelBtn.textContent = '❌ 取消预约';
            cancelBtn.addEventListener('click', function () { cancelReservation(seat.id); });
            container.appendChild(cancelBtn);
        } else if (seat.status === 'used') {
            const awayBtn = document.createElement('button');
            awayBtn.className = 'btn btn-warning';
            awayBtn.textContent = '🚶 暂离';
            awayBtn.addEventListener('click', function () { markAway(seat.id); });
            container.appendChild(awayBtn);

            const releaseBtn = document.createElement('button');
            releaseBtn.className = 'btn btn-danger';
            releaseBtn.textContent = '🔓 释放座位';
            releaseBtn.addEventListener('click', function () { releaseSeat(seat.id); });
            container.appendChild(releaseBtn);
        } else if (seat.status === 'away') {
            const backBtn = document.createElement('button');
            backBtn.className = 'btn btn-success';
            backBtn.textContent = '↩️ 返回';
            backBtn.addEventListener('click', function () { returnFromAway(seat.id); });
            container.appendChild(backBtn);
        }
    }

    window.closeSeatModal = function () {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('seatModal').style.display = 'none';
        selectedSeatId = null;
    };

    // ========== 预约逻辑 ==========
    function bookSeat(seatId) {
        const seat = seats.find(s => s.id === seatId);
        if (!seat || seat.status !== 'free') { toast('该座位不可预约', 'error'); return; }
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) { toast('请先登录', 'error'); setTimeout(() => location.href = '../index.html', 800); return; }
        const user = JSON.parse(userStr);
        const now = Date.now();
        const reservation = {
            id: 'R' + now,
            seatId: seat.id,
            seatCode: seat.code,
            userId: user.studentId || user.id,
            userName: user.name,
            startTime: now,
            endTime: now + 2 * 3600000,
            status: 'active'
        };
        let reservations = JSON.parse(localStorage.getItem('lib_reservations') || '[]');
        reservations.push(reservation);
        localStorage.setItem('lib_reservations', JSON.stringify(reservations));
        seat.status = 'reserved';
        localStorage.setItem('lib_seats', JSON.stringify(seats));
        closeSeatModal();
        renderSeats();
        renderStats();
        renderRecommend();
        toast('预约成功！请在2小时内签到', 'success');
    }

    function checkinSeat(seatId) {
        const seat = seats.find(s => s.id === seatId);
        if (!seat) return;
        seat.status = 'used';
        localStorage.setItem('lib_seats', JSON.stringify(seats));
        closeSeatModal();
        renderSeats();
        renderStats();
        renderRecommend();
        toast('签到成功', 'success');
    }

    function cancelReservation(seatId) {
        const seat = seats.find(s => s.id === seatId);
        if (!seat) return;
        seat.status = 'free';
        localStorage.setItem('lib_seats', JSON.stringify(seats));
        let reservations = JSON.parse(localStorage.getItem('lib_reservations') || '[]');
        reservations = reservations.filter(r => r.seatId !== seatId);
        localStorage.setItem('lib_reservations', JSON.stringify(reservations));
        closeSeatModal();
        renderSeats();
        renderStats();
        renderRecommend();
        toast('预约已取消', 'info');
    }

    function markAway(seatId) {
        const seat = seats.find(s => s.id === seatId);
        if (!seat) return;
        seat.status = 'away';
        localStorage.setItem('lib_seats', JSON.stringify(seats));
        closeSeatModal();
        renderSeats();
        renderStats();
        renderRecommend();
        startTimer();
        toast('已标记暂离，请30分钟内返回', 'warning');
    }

    function returnFromAway(seatId) {
        const seat = seats.find(s => s.id === seatId);
        if (!seat) return;
        seat.status = 'used';
        localStorage.setItem('lib_seats', JSON.stringify(seats));
        closeSeatModal();
        renderSeats();
        renderStats();
        renderRecommend();
        stopTimer();
        toast('欢迎回来', 'success');
    }

    function releaseSeat(seatId) {
        const seat = seats.find(s => s.id === seatId);
        if (!seat) return;
        seat.status = 'free';
        localStorage.setItem('lib_seats', JSON.stringify(seats));
        let reservations = JSON.parse(localStorage.getItem('lib_reservations') || '[]');
        reservations = reservations.filter(r => r.seatId !== seatId);
        localStorage.setItem('lib_reservations', JSON.stringify(reservations));
        closeSeatModal();
        renderSeats();
        renderStats();
        renderRecommend();
        toast('座位已释放', 'info');
    }

    // ========== 倒计时 ==========
    let timerInterval = null;
    function startTimer() {
        const panel = document.getElementById('timerPanel');
        if (panel) panel.style.display = 'block';
        let remaining = 1800;
        const label = document.getElementById('timerLabel');
        const remainEl = document.getElementById('timerRemaining');
        const progress = document.getElementById('timerProgress');
        if (label) label.textContent = '暂离中';
        timerInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                if (label) label.textContent = '超时！座位已释放';
                if (remainEl) remainEl.textContent = '00:00';
                if (progress) progress.style.width = '0%';
                if (selectedSeatId) {
                    const seat = seats.find(s => s.id === selectedSeatId);
                    if (seat && seat.status === 'away') {
                        seat.status = 'free';
                        localStorage.setItem('lib_seats', JSON.stringify(seats));
                        renderSeats();
                        renderStats();
                        renderRecommend();
                        toast('暂离超时，座位已自动释放', 'error');
                    }
                }
                return;
            }
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            if (remainEl) remainEl.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
            if (progress) progress.style.width = (remaining / 1800 * 100) + '%';
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        const panel = document.getElementById('timerPanel');
        if (panel) panel.style.display = 'none';
    }

    // ========== Toast ==========
    function toast(msg, type) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const div = document.createElement('div');
        div.className = 'toast toast-' + (type || 'info');
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.classList.add('show'), 10);
        setTimeout(() => {
            div.classList.remove('show');
            setTimeout(() => div.remove(), 400);
        }, 3000);
    }

    // ========== 筛选逻辑 ==========
    function applyFilters() {
        const floorVal = document.getElementById('floorFilter').value;
        const areaVal = document.getElementById('areaFilter').value;
        const powerVal = document.getElementById('powerFilter').value;
        let filtered = seats.filter(s => {
            if (floorVal !== 'all' && String(s.floor) !== floorVal) return false;
            if (areaVal !== 'all' && s.area !== areaVal) return false;
            if (powerVal === 'yes' && !s.hasPower) return false;
            if (powerVal === 'no' && s.hasPower) return false;
            return true;
        });
        renderSeats(filtered);
    }

    // ========== 加载用户信息 ==========
    function loadUserInfo() {
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) { location.href = '../index.html'; return; }
        const user = JSON.parse(userStr);
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userRole').textContent = user.role === 'admin' ? '管理员' : '学生';
        document.getElementById('userCredit').textContent = '💎 ' + (user.credit || 100);
    }

    // ========== 加载我的预约 ==========
    function loadMyBookings() {
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) return;
        const user = JSON.parse(userStr);
        const reservations = JSON.parse(localStorage.getItem('lib_reservations') || '[]');
        const mine = reservations.filter(r => r.userId === (user.studentId || user.id));
        const ul = document.getElementById('myBookings');
        if (!ul) return;
        if (mine.length === 0) {
            ul.innerHTML = '<li style="color:#999;font-size:13px;">暂无预约</li>';
            return;
        }
        ul.innerHTML = mine.map(r => `<li>${r.seatCode} - ${new Date(r.startTime).toLocaleString()}</li>`).join('');
    }

    // ========== 初始化 ==========
    function init() {
        initData();
        loadUserInfo();
        renderSeats(seats);
        renderStats();
        renderRecommend();
        loadMyBookings();

        document.getElementById('floorFilter').addEventListener('change', applyFilters);
        document.getElementById('areaFilter').addEventListener('change', applyFilters);
        document.getElementById('powerFilter').addEventListener('change', applyFilters);

        document.getElementById('closeModalBtn').addEventListener('click', closeSeatModal);
        document.getElementById('modalOverlay').addEventListener('click', closeSeatModal);
    }

    document.addEventListener('DOMContentLoaded', init);
})();