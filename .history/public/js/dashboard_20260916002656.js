/**
 * dashboard.js — 学生预约页（已接入后端 API + 智能推荐 + 实时统计）
 */
(function () {
    'use strict';

    const ACTIVE_STATUS = ['active', 'checked_in', 'away', 'class_reserve'];
    const STATUS_TEXT = { free: '空闲', used: '使用中', away: '暂离', reserved: '已预约', maintenance: '维修' };
    const AREA_TEXT = { quiet: '静音区', discuss: '讨论区', window: '靠窗区' };

    let currentUser = null;
    let allSeats = [];          // 当前筛选后的座位
    let allSeatsRaw = [];       // 全部座位（用于统计）
    let selectedSeatId = null;
    let countdownInterval = null;
    let usageMap = {};          // 座位使用频次（推荐用）

    /* ================= 初始化 ================= */
    document.addEventListener('DOMContentLoaded', async function () {
        const stored = localStorage.getItem('currentUser');
        if (!stored || !api.getToken()) { window.location.href = '../index.html'; return; }
        try { currentUser = JSON.parse(stored); } catch (_) { window.location.href = '../index.html'; return; }

        renderUser();
        bindEvents();
        await loadAll();
        restoreActiveTimer();
        startClock();
    });

    function renderUser() {
        document.getElementById('userName').textContent = currentUser.name || currentUser.studentId;
        document.getElementById('userCredit').textContent = currentUser.credit ?? 100;
        document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '管理员' : '学生';
    }

    function bindEvents() {
        document.getElementById('filterFloor').addEventListener('change', () => { renderSeats(); renderRecommend(); });
        document.getElementById('filterArea').addEventListener('change', () => { renderSeats(); renderRecommend(); });
        document.getElementById('prefArea').addEventListener('change', renderRecommend);
        document.getElementById('searchSeat').addEventListener('input', renderSeats);
        document.getElementById('refreshBtn').addEventListener('click', loadAll);
        document.getElementById('refreshRecommend').addEventListener('click', renderRecommend);
    }

    /* ================= 数据加载 ================= */
    async function loadAll() {
        try {
            const [seats, stats, bookings, rules] = await Promise.all([
                api.listSeats(),
                api.seatStats(),
                api.myBookings().catch(() => []),
                api.getRules().catch(() => null)
            ]);
            allSeatsRaw = seats;
            allSeats = seats;
            usageMap = computeUsage(bookings); // 统计每个座位被预约次数
            renderStats(stats);
            renderSeats();
            renderRecommend();
            renderMyBookings(bookings);
        } catch (err) {
            showToast(err.message || '加载失败', 'error');
        }
    }

    // 根据预约记录统计座位使用频次
    function computeUsage(bookings) {
        const map = {};
        (bookings || []).forEach(b => { map[b.seat_code] = (map[b.seat_code] || 0) + 1; });
        return map;
    }

    /* ================= 统计卡片 ================= */
    function renderStats(stats) {
        document.getElementById('statTotal').querySelector('.stat-value').textContent = stats.total ?? 0;
        document.getElementById('statFree').querySelector('.stat-value').textContent = stats.free ?? 0;
        document.getElementById('statUsed').querySelector('.stat-value').textContent = stats.used ?? 0;

        // 我的预约数（前端实时算，因为可能跨状态）
        const mine = allSeatsRaw.length ? null : 0;
        api.myBookings().then(bs => {
            document.getElementById('statMine').querySelector('.stat-value').textContent =
                (bs || []).filter(b => ACTIVE_STATUS.includes(b.status)).length;
        }).catch(() => {});

        const total = stats.total || 0;
        const used = stats.used || 0;
        const rate = total ? Math.round(used / total * 100) : 0;
        document.getElementById('statRate').querySelector('.stat-value').textContent = rate + '%';
    }

    /* ================= 座位网格 ================= */
    function renderSeats() {
        const container = document.getElementById('seatGrid');
        const floor = document.getElementById('filterFloor').value;
        const area = document.getElementById('filterArea').value;
        const keyword = document.getElementById('searchSeat').value.trim().toLowerCase();

        let list = allSeatsRaw.filter(s => {
            if (floor !== 'all' && s.floor != floor) return false;
            if (area !== 'all' && s.area !== area) return false;
            if (keyword && !s.code.toLowerCase().includes(keyword)) return false;
            return true;
        });
        allSeats = list;

        if (!list.length) {
            container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-icon">🔍</div><p>没有符合条件的座位</p></div>`;
            return;
        }

        // 标记推荐座位（前3名）
        const recs = Recommend.getRecommendations(list, getRecCtx(), 3);
        const recCodes = new Set(recs.map(r => r.seat.code));

        container.innerHTML = list.map(seat => {
            const statusClass = seat.enabled ? seat.status : 'disabled';
            const isSelected = selectedSeatId === seat.id ? 'selected' : '';
            const isRec = recCodes.has(seat.code) ? 'recommended' : '';
            const badge = recCodes.has(seat.code) ? `<span class="badge-recommend">推荐</span>` : '';
            return `
            <div class="seat-item ${statusClass} ${isSelected} ${isRec}" data-id="${seat.id}" onclick="window.selectSeat(${seat.id})">
                ${badge}
                <div class="seat-code">${seat.code}</div>
                <div class="seat-status">${STATUS_TEXT[seat.status] || seat.status}</div>
                ${seat.has_power ? '<div class="seat-power">🔌</div>' : ''}
            </div>`;
        }).join('');
    }

    function getRecCtx() {
        return {
            floor: document.getElementById('filterFloor').value,
            prefArea: document.getElementById('prefArea').value,
            usageMap
        };
    }

    /* ================= 推荐侧栏 ================= */
    function renderRecommend() {
        const list = allSeats.length ? allSeats : allSeatsRaw;
        const recs = Recommend.getRecommendations(list, getRecCtx(), 3);
        const ul = document.getElementById('recommendList');
        const tip = document.getElementById('recommendTip');

        if (!recs.length) {
            ul.innerHTML = '<li class="empty-state"><div class="empty-icon">😶</div><p>暂无可用推荐</p></li>';
            tip.textContent = '当前没有空闲座位，请稍后再试或调整筛选条件。';
            return;
        }

        ul.innerHTML = recs.map(({ seat, score, reasons }) => `
            <li class="recommend-item" onclick="window.selectSeat(${seat.id})" title="点击查看详情">
                <div class="rec-info">
                    <span class="rec-code">${seat.code}</span>
                    <span class="rec-meta">
                        ${seat.has_power ? '<span class="rec-tag power">🔌电源</span>' : ''}
                        ${reasons.map(r => `<span class="rec-tag">${r}</span>`).join('')}
                    </span>
                </div>
                <div class="rec-score">
                    <div class="score-num">${score}</div>
                    <div class="score-bar"><i style="width:${score}%"></i></div>
                </div>
            </li>
        `).join('');

        const top = recs[0];
        tip.innerHTML = `综合 <code>空闲</code> · <code>电源</code> · <code>区域偏好</code> · <code>楼层</code> 打分，首选 <strong>${top.seat.code}</strong>（${top.score}分）。`;

        // 更新详情区推荐度
        const detailScore = document.getElementById('detailScore');
        if (selectedSeatId) {
            const found = recs.find(r => r.seat.id === selectedSeatId);
            if (found) detailScore.textContent = found.score + '分 ⭐';
        }
    }

    /* ================= 座位详情 & 操作 ================= */
    window.selectSeat = function (seatId) {
        selectedSeatId = seatId;
        renderSeats();
        const seat = allSeatsRaw.find(s => s.id === seatId);
        if (!seat) return;
        document.getElementById('detailCode').textContent = seat.code;
        document.getElementById('detailFloor').textContent = seat.floor + 'F';
        document.getElementById('detailArea').textContent = AREA_TEXT[seat.area] || seat.area;
        document.getElementById('detailPower').textContent = seat.has_power ? '有 🔌' : '无';
        document.getElementById('detailStatus').textContent = STATUS_TEXT[seat.status] || seat.status;

        // 推荐度
        const recs = Recommend.getRecommendations(allSeats.length ? allSeats : allSeatsRaw, getRecCtx(), 20);
        const found = recs.find(r => r.seat.id === seatId);
        document.getElementById('detailScore').innerHTML = found ? `${found.score}分 ⭐` : '—';

        showActionButtons(seat);
    };

    function showActionButtons(seat) {
        const actionsDiv = document.getElementById('seatActions');
        if (!actionsDiv) return;
        const myBooking = (window.__myBookings || []).find(b =>
            b.seat_code === seat.code && ACTIVE_STATUS.includes(b.status));
        let html = '';

        if (seat.status === 'free' && seat.enabled) {
            html += `<button class="btn btn-primary btn-block" onclick="window.bookSeat('${seat.code}')">立即预约</button>`;
        }
        if (myBooking) {
            if (myBooking.status === 'active') {
                html += `<button class="btn btn-success btn-block" onclick="window.checkIn(${myBooking.id})">签到</button>`;
            }
            if (myBooking.status === 'checked_in') {
                html += `<button class="btn btn-warning btn-block" onclick="window.startAway(${myBooking.id})">暂离</button>`;
                if ((currentUser.credit ?? 100) >= 80) {
                    html += `<button class="btn btn-info btn-block" onclick="window.startClassReserve(${myBooking.id})">上课保留</button>`;
                }
                html += `<button class="btn btn-danger btn-block" onclick="window.returnSeat(${myBooking.id})">释放座位</button>`;
            }
            if (myBooking.status === 'away' || myBooking.status === 'class_reserve') {
                html += `<button class="btn btn-success btn-block" onclick="window.returnFromAway(${myBooking.id})">返回座位</button>`;
            }
        }
        actionsDiv.innerHTML = html;
    }

    /* ================= 预约操作（全部走 API）================= */
    window.bookSeat = async function (seatCode) {
        try {
            await api.createBooking(seatCode);
            showToast('预约成功！请在15分钟内签到', 'success');
            await loadAll();
        } catch (err) { showToast(err.message, 'error'); }
    };

    window.checkIn = async function (id) {
        try { await api.checkIn(id); showToast('签到成功', 'success'); await loadAll(); }
        catch (err) { showToast(err.message, 'error'); }
    };

    window.startAway = async function (id) {
        try {
            const booking = (window.__myBookings || []).find(b => b.id === id);
            await api.startAway(id);
            const rules = await api.getRules().catch(() => ({}));
            startCountdown(rules.away_minutes || 45, '暂离中', id, () => api.timeoutBooking(id, rules.away_penalty || 10));
            showToast('暂离已开始，请按时返回', 'info');
            await loadAll();
        } catch (err) { showToast(err.message, 'error'); }
    };

    window.startClassReserve = async function (id) {
        try {
            const rules = await api.getRules().catch(() => ({}));
            if ((currentUser.credit ?? 100) < (rules.class_min_creit || 80)) return showToast('信用分不足80', 'error');
            await api.startAway(id); // 后端可区分，此处复用 away 状态
            startCountdown(rules.class_minutes || 120, '上课保留中', id, () => api.timeoutBooking(id, rules.class_penalty || 20));
            showToast('上课保留已开始', 'info');
            await loadAll();
        } catch (err) { showToast(err.message, 'error'); }
    };

    window.returnFromAway = window.returnSeat = async function (id) {
        try {
            await api.returnSeat(id);  // 返回/释放统一：返回=checked_in，释放=cancel，此处按状态区分
            stopCountdown();
            showToast('操作成功', 'success');
            await loadAll();
        } catch (err) { showToast(err.message, 'error'); }
    };

    // 释放（明确取消）
    window.cancelBooking = async function (id) {
        if (!confirm('确认释放该座位？')) return;
        try { await api.cancelBooking(id); stopCountdown(); showToast('座位已释放', 'success'); await loadAll(); }
        catch (err) { showToast(err.message, 'error'); }
    };

    /* ================= 我的预约 ================= */
    function renderMyBookings(bookings) {
        window.__myBookings = bookings || [];
        const list = document.getElementById('myBookingsList');
        const active = bookings.filter(b => ACTIVE_STATUS.includes(b.status));
        if (!active.length) {
            list.innerHTML = '<li class="empty-state"><div class="empty-icon">📭</div><p>暂无进行中的预约</p></li>';
            return;
        }
        list.innerHTML = active.map(b => `
            <li class="booking-item status-${b.status}">
                <div class="booking-head">
                    <strong>${b.seat_code}</strong>
                    <span class="booking-status">${STATUS_TEXT[b.status] || b.status}</span>
                </div>
                <div class="booking-meta">${b.date} · ${b.slot}</div>
                ${b.status === 'active' ? `<button class="btn btn-sm btn-success" onclick="window.checkIn(${b.id})">签到</button>` : ''}
                ${b.status === 'checked_in' ? `<button class="btn btn-sm btn-danger" onclick="window.cancelBooking(${b.id})">释放</button>` : ''}
            </li>
        `).join('');
    }

    /* ================= 倒计时 ================= */
    function startCountdown(totalMinutes, label, bookingId, onTimeout) {
        stopCountdown();
        const panel = document.getElementById('timerPanel');
        if (!panel) return;
        panel.style.display = 'block';
        document.getElementById('timerLabel').textContent = label;
        const remainingSpan = document.getElementById('timerRemaining');
        const progressBar = document.getElementById('timerProgress');
        let remainingSeconds = totalMinutes * 60;

        const update = () => {
            const mins = Math.floor(remainingSeconds / 60);
            const secs = remainingSeconds % 60;
            remainingSpan.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
            progressBar.style.width = (remainingSeconds / (totalMinutes * 60) * 100) + '%';
        };
        update();
        countdownInterval = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                stopCountdown();
                if (onTimeout) onTimeout();
                return;
            }
            update();
        }, 1000);
    }

    function stopCountdown() {
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        const panel = document.getElementById('timerPanel');
        if (panel) panel.style.display = 'none';
        const pb = document.getElementById('timerProgress'); if (pb) pb.style.width = '100%';
        const rs = document.getElementById('timerRemaining'); if (rs) rs.textContent = '--:--';
    }

    function restoreActiveTimer() {
        // 刷新后若有进行中的 away/class_reserve，恢复倒计时（简化：按创建时间估算）
        const active = (window.__myBookings || []).find(b => b.status === 'away' || b.status === 'class_reserve');
        if (!active) return;
        // 此处可选实现：根据 create_time 计算剩余，这里仅提示
        console.log('[倒计时] 检测到进行中的', active.status, '，可在此恢复倒计时');
    }

    /* ================= 工具 ================= */
    function startClock() {
        const el = document.getElementById('updateTime');
        if (!el) return;
        const tick = () => { const d = new Date(); el.textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`; };
        tick(); setInterval(tick, 1000);
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) { alert(message); return; }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 350); }, 2600);
    }

    // 暴露给内联 onclick
    window.showToast = showToast;
})();
