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
    function getCurrentUser(){ return JSON.parse(localStorage.getItem('currentUser')); }

    const AREA_LABEL = { quiet: '静音区', discuss: '讨论区', window: '靠窗区' };
    const STATUS_TEXT = { free: '空闲', used: '使用中', away: '暂离', reserved: '已预约', maintenance: '维修' };
    const STATUS_CLASS = { free: 'free', used: 'used', away: 'away', reserved: 'reserved', maintenance: 'maintenance' };

    let currentUser = null;
    let selectedSeatId = null; // 当前选中的座位ID

    /* ========== 初始化 ========== */
    function init() {
        currentUser = getCurrentUser();
        if (!currentUser) { window.location.href = '../index.html'; return; }
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userCredit').textContent = currentUser.credit ?? 100;
        startClock();
        loadAll();
        // 点击外部关闭弹窗
        document.addEventListener('click', function(e) {
            const modal = document.getElementById('seatModal');
            if (modal.style.display === 'flex' && !modal.querySelector('.modal-card').contains(e.target) && e.target !== modal) {
                closeSeatModal();
            }
        });
    }

    /* ========== 实时时钟 ========== */
    function startClock() {
        const el = document.getElementById('realtimeClock');
        function tick() {
            const d = new Date();
            const p = n => String(n).padStart(2,'0');
            el.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        }
        tick();
        setInterval(tick, 1000);
    }

    /* ========== 加载所有 ========== */
    function loadAll() {
        updateStats();
        renderGrid();
        refreshRecommend();
    }

    /* ========== 更新统计 ========== */
    function updateStats() {
        const seats = getSeats();
        const total = seats.length;
        const free = seats.filter(s => s.status === 'free' && s.enabled).length;
        const used = seats.filter(s => s.status === 'used' || s.status === 'away').length;
        const occupancy = total > 0 ? Math.round((used / total) * 100) : 0;
        const myBookings = getBookings().filter(b => b.userId === currentUser.id && ['active','checked_in','away','class_reserve'].includes(b.status)).length;
        document.getElementById('statTotal').textContent = total;
        document.getElementById('statFree').textContent = free;
        document.getElementById('statUsed').textContent = used;
        document.getElementById('statMyBooking').textContent = myBookings;
        document.getElementById('statOccupancy').textContent = occupancy + '%';
    }

    /* ========== 渲染座位网格 ========== */
    function renderGrid() {
        const container = document.getElementById('seatGrid');
        let seats = getSeats();
        const floorFilter = document.getElementById('floorFilter').value;
        const areaFilter = document.getElementById('areaFilter').value;
        const powerFilter = document.getElementById('powerFilter').value;

        if (floorFilter !== 'all') seats = seats.filter(s => s.floor === parseInt(floorFilter));
        if (areaFilter !== 'all') seats = seats.filter(s => s.area === areaFilter);
        if (powerFilter !== 'all') seats = seats.filter(s => s.hasPower === (powerFilter === 'yes'));

        container.innerHTML = seats.map(seat => {
            const isSelected = selectedSeatId === seat.id;
            const disabled = !seat.enabled || seat.status === 'maintenance';
            return `<div class="seat-item ${STATUS_CLASS[seat.status]} ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}" 
                         data-id="${seat.id}" onclick="onSeatClick(${seat.id})" title="${seat.code} - ${AREA_LABEL[seat.area] || seat.area}">
                        <span class="seat-code">${seat.code}</span>
                        <span class="seat-power">${seat.hasPower ? '⚡' : ''}</span>
                        <span class="seat-status-dot"></span>
                    </div>`;
        }).join('');
    }
    window.renderGrid = renderGrid;

    /* ========== 座位点击处理 ========== */
    window.onSeatClick = function(seatId) {
        const seats = getSeats();
        const seat = seats.find(s => s.id === seatId);
        if (!seat) return;
        if (!seat.enabled || seat.status === 'maintenance') {
            toast('该座位不可用', 'error');
            return;
        }
        selectedSeatId = seatId;
        renderGrid(); // 重新渲染以高亮选中
        showSeatDetail(seat);
    };

    /* ========== 显示座位详情弹窗 ========== */
    function showSeatDetail(seat) {
        const modal = document.getElementById('seatModal');
        const overlay = document.getElementById('modalOverlay');
        document.getElementById('detailCode').textContent = seat.code;
        document.getElementById('detailFloor').textContent = seat.floor + 'F';
        document.getElementById('detailArea').textContent = AREA_LABEL[seat.area] || seat.area;
        document.getElementById('detailPower').textContent = seat.hasPower ? '✅ 有电源' : '❌ 无电源';
        document.getElementById('detailStatus').textContent = STATUS_TEXT[seat.status] || seat.status;
        document.getElementById('detailStatus').className = 'status-tag status-' + (STATUS_CLASS[seat.status] || 'free');

        // 判断当前用户对该座位的操作
        const bookings = getBookings();
        const myActiveBooking = bookings.find(b => b.userId === currentUser.id && b.seatId === seat.id && ['active','checked_in','away','class_reserve'].includes(b.status));
        const actionBtn = document.getElementById('actionButton');
        const actionContainer = document.getElementById('actionContainer');

        if (myActiveBooking) {
            // 已有预约 → 显示释放/暂离等
            actionContainer.style.display = 'block';
            if (myActiveBooking.status === 'checked_in') {
                actionBtn.textContent = '🔄 释放座位';
                actionBtn.className = 'btn btn-danger';
                actionBtn.onclick = function() { releaseSeat(myActiveBooking); };
            } else if (myActiveBooking.status === 'away') {
                actionBtn.textContent = '↩️ 返回座位';
                actionBtn.className = 'btn btn-success';
                actionBtn.onclick = function() { returnToSeat(myActiveBooking); };
            } else if (myActiveBooking.status === 'reserved' || myActiveBooking.status === 'active') {
                actionBtn.textContent = '❌ 取消预约';
                actionBtn.className = 'btn btn-outline';
                actionBtn.onclick = function() { cancelBooking(myActiveBooking); };
            } else {
                actionContainer.style.display = 'none';
            }
        } else if (seat.status === 'free') {
            // 空闲 → 显示预约按钮
            actionContainer.style.display = 'block';
            actionBtn.textContent = '📅 预约座位';
            actionBtn.className = 'btn btn-primary';
            actionBtn.onclick = function() { bookSeat(seat); };
        } else {
            actionContainer.style.display = 'none';
        }

        overlay.style.display = 'flex';
        modal.style.display = 'flex';
    }

    window.closeSeatModal = function() {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('seatModal').style.display = 'none';
        selectedSeatId = null;
        renderGrid();
    };

    /* ========== 预约座位 ========== */
    function bookSeat(seat) {
        if (getBookings().some(b => b.userId === currentUser.id && ['active','checked_in','away','class_reserve'].includes(b.status))) {
            toast('你已有进行中的预约', 'error');
            closeSeatModal();
            return;
        }
        const rules = getRules();
        const booking = {
            id: Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            seatId: seat.id,
            seatCode: seat.code,
            floor: seat.floor,
            area: seat.area,
            date: new Date().toISOString().slice(0,10),
            slot: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            status: 'active',
            createTime: new Date().toISOString()
        };
        const bookings = getBookings();
        bookings.push(booking);
        setBookings(bookings);

        const seats = getSeats();
        const s = seats.find(x => x.id === seat.id);
        if (s) s.status = 'reserved';
        setSeats(seats);

        closeSeatModal();
        loadAll();
        toast(`座位 ${seat.code} 预约成功！请在 ${rules.graceMinutes || 15} 分钟内签到`, 'success');
    }

    /* ========== 释放座位 ========== */
    function releaseSeat(booking) {
        if (!confirm('确认释放座位？')) return;
        const bookings = getBookings();
        const b = bookings.find(x => x.id === booking.id);
        if (b) b.status = 'completed';
        setBookings(bookings);

        const seats = getSeats();
        const s = seats.find(x => x.id === booking.seatId);
        if (s) s.status = 'free';
        setSeats(seats);

        closeSeatModal();
        loadAll();
        toast('座位已释放', 'success');
    }

    /* ========== 返回座位（暂离归来） ========== */
    function returnToSeat(booking) {
        const bookings = getBookings();
        const b = bookings.find(x => x.id === booking.id);
        if (b) b.status = 'checked_in';
        setBookings(bookings);

        const seats = getSeats();
        const s = seats.find(x => x.id === booking.seatId);
        if (s) s.status = 'used';
        setSeats(seats);

        closeSeatModal();
        loadAll();
        toast('欢迎回来，座位已恢复使用', 'success');
    }

    /* ========== 取消预约 ========== */
    function cancelBooking(booking) {
        if (!confirm('确认取消预约？')) return;
        const bookings = getBookings();
        const b = bookings.find(x => x.id === booking.id);
        if (b) b.status = 'cancelled';
        setBookings(bookings);

        const seats = getSeats();
        const s = seats.find(x => x.id === booking.seatId);
        if (s) s.status = 'free';
        setSeats(seats);

        closeSeatModal();
        loadAll();
        toast('预约已取消', 'info');
    }

    /* ========== 推荐座位（改进版） ========== */
    window.refreshRecommend = function() {
        const container = document.getElementById('recommendList');
        container.innerHTML = '<div class="loading">计算推荐中...</div>';

        const seats = getSeats();
        const freeSeats = seats.filter(s => s.status === 'free' && s.enabled);
        if (freeSeats.length === 0) {
            container.innerHTML = '<div class="empty">暂无空闲座位</div>';
            return;
        }

        // 获取用户偏好（从 localStorage 读取，如果没有则默认）
        const pref = JSON.parse(localStorage.getItem('userPref') || '{"preferArea":"quiet","preferFloor":1,"preferPower":true}');
        const bookings = getBookings();
        const userHistory = bookings.filter(b => b.userId === currentUser.id);
        const historyCount = {};
        userHistory.forEach(b => { historyCount[b.seatId] = (historyCount[b.seatId] || 0) + 1; });

        // 计算各区域空闲率（用于邻座空闲评分）
        const areaStats = {};
        seats.forEach(s => {
            if (!areaStats[s.area]) areaStats[s.area] = { total: 0, free: 0 };
            areaStats[s.area].total++;
            if (s.status === 'free') areaStats[s.area].free++;
        });

        const scored = freeSeats.map(seat => {
            let score = 40; // 基础分

            // 电源 +15
            if (seat.hasPower) score += 15;

            // 偏好区域 +12~28
            if (seat.area === pref.preferArea) score += 28;
            else if (seat.area === 'quiet') score += 12; // 静音区额外加分
            else score += 18;

            // 偏好楼层 +12
            if (seat.floor === pref.preferFloor) score += 12;

            // 低楼层优先（1楼+8，2楼+4，3楼+0）
            score += Math.max(0, 8 - (seat.floor - 1) * 4);

            // 邻座空闲率（同层同区空闲比例 * 8）
            const areaFreeRate = areaStats[seat.area] ? areaStats[seat.area].free / Math.max(areaStats[seat.area].total, 1) : 0;
            score += Math.round(areaFreeRate * 8);

            // 历史频次 +0~10
            const freq = historyCount[seat.id] || 0;
            score += Math.min(freq * 3, 10);

            return { seat, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const top3 = scored.slice(0, 3);

        container.innerHTML = top3.map((item, index) => {
            const star = index === 0 ? '⭐' : (index === 1 ? '🌟' : '✨');
            return `<div class="recommend-item ${index === 0 ? 'top1' : ''}" onclick="focusSeat(${item.seat.id})">
                        <div class="ri-rank">${star}</div>
                        <div class="ri-info">
                            <div class="ri-code">${item.seat.code}</div>
                            <div class="ri-detail">${item.seat.floor}F · ${AREA_LABEL[item.seat.area] || item.seat.area} ${item.seat.hasPower ? '⚡' : ''}</div>
                        </div>
                        <div class="ri-score">${item.score}分</div>
                    </div>`;
        }).join('');
    };

    /* ========== 聚焦到指定座位 ========== */
    window.focusSeat = function(seatId) {
        // 清除所有筛选，确保能看到该座位
        document.getElementById('floorFilter').value = 'all';
        document.getElementById('areaFilter').value = 'all';
        document.getElementById('powerFilter').value = 'all';
        selectedSeatId = seatId;
        renderGrid();
        // 滚动到该座位
        setTimeout(() => {
            const el = document.querySelector(`.seat-item[data-id="${seatId}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlight-flash');
                setTimeout(() => el.classList.remove('highlight-flash'), 1500);
                // 自动打开详情
                onSeatClick(seatId);
            }
        }, 100);
    };

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

    document.addEventListener('DOMContentLoaded', init);
})();
