(function() {
    let seats = [];
    let selectedSeatId = null;

    // ========== 初始化数据 ==========
    function initData() {
        const stored = localStorage.getItem('lib_seats');
        if (stored) {
            seats = JSON.parse(stored);
        } else {
            // 默认数据
            seats = [
                { id: 1, code: 'A-01', floor: 1, area: 'quiet', hasPower: true, status: 'free' },
                { id: 2, code: 'A-02', floor: 1, area: 'quiet', hasPower: false, status: 'free' },
                { id: 3, code: 'A-03', floor: 1, area: 'quiet', hasPower: true, status: 'free' },
                { id: 4, code: 'A-04', floor: 1, area: 'window', hasPower: true, status: 'free' },
                { id: 5, code: 'A-05', floor: 1, area: 'window', hasPower: false, status: 'free' },
                { id: 6, code: 'A-06', floor: 1, area: 'quiet', hasPower: true, status: 'free' }
            ];
            localStorage.setItem('lib_seats', JSON.stringify(seats));
        }
    }

    // ========== 渲染座位（动态生成） ==========
    function renderSeats(list) {
        const grid = document.getElementById('seatGrid');
        if (!grid) return;
        grid.innerHTML = '';
        (list || seats).forEach(s => {
            const div = document.createElement('div');
            div.className = 'seat-card ' + s.status;
            div.dataset.id = s.id; // 使用 data-id 记录座位ID，绝不使用内联 onclick
            div.innerHTML = `
                <div class="seat-code">${s.code}</div>
                <div class="seat-status">${s.status}</div>
                <div class="seat-info">${s.floor}F · ${s.area}</div>
            `;
            grid.appendChild(div);
        });
    }

    // ========== 选择座位（核心修复：事件委托触发） ==========
    function selectSeat(id) {
        selectedSeatId = id;
        const seat = seats.find(s => s.id === id);
        if (!seat) return;

        // 防御性编程：即使 HTML 里漏了这些 id，也不会报错崩溃
        const titleEl = document.getElementById('seatModalTitle');
        const codeEl = document.getElementById('modalCode');
        const floorEl = document.getElementById('modalFloor');
        const areaEl = document.getElementById('modalArea');
        const powerEl = document.getElementById('modalPower');
        const statusEl = document.getElementById('modalStatus');
        const actionContainer = document.getElementById('actionContainer');
        const modal = document.getElementById('seatModal');
        const overlay = document.getElementById('modalOverlay');

        if (titleEl) titleEl.textContent = `座位详情 - ${seat.code}`;
        if (codeEl) codeEl.textContent = seat.code;
        if (floorEl) floorEl.textContent = seat.floor + 'F';
        if (areaEl) areaEl.textContent = seat.area;
        if (powerEl) powerEl.textContent = seat.hasPower ? '有' : '无';
        if (statusEl) statusEl.textContent = seat.status;

        if (actionContainer) {
            actionContainer.innerHTML = '';
            if (seat.status === 'free') {
                const btn = document.createElement('button');
                btn.textContent = '📅 预约座位';
                btn.onclick = reserveSeat; // 动态绑定预约按钮事件
                actionContainer.appendChild(btn);
            }
        }
        
        if (modal) modal.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
    }

    // ========== 关闭弹窗 ==========
    function closeSeatModal() {
        const modal = document.getElementById('seatModal');
        const overlay = document.getElementById('modalOverlay');
        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    }

    // ========== 预约座位 ==========
    function reserveSeat() {
        if (!selectedSeatId) return;
        const seat = seats.find(s => s.id === selectedSeatId);
        if (seat) {
            seat.status = 'reserved';
            localStorage.setItem('lib_seats', JSON.stringify(seats));
            renderSeats(seats);
            closeSeatModal();
            toast('预约成功！', 'success');
        }
    }

    // ========== Toast 提示 ==========
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
        }, 2500);
    }

    // ========== 筛选与推荐（简版） ==========
    function applyFilters() {
        const floorVal = document.getElementById('floorFilter').value;
        const areaVal = document.getElementById('areaFilter').value;
        const powerVal = document.getElementById('powerFilter').value;
        const filtered = seats.filter(s => {
            if (floorVal !== 'all' && String(s.floor) !== floorVal) return false;
            if (areaVal !== 'all' && s.area !== areaVal) return false;
            if (powerVal === 'yes' && !s.hasPower) return false;
            if (powerVal === 'no' && s.hasPower) return false;
            return true;
        });
        renderSeats(filtered);
    }

    // ========== 初始化绑定 ==========
    function init() {
        initData();
        renderSeats(seats);
        
        // 核心修复：使用事件委托绑定动态生成的座位卡片[3](@ref)
        const seatGrid = document.getElementById('seatGrid');
        if (seatGrid) {
            seatGrid.addEventListener('click', (e) => {
                const card = e.target.closest('.seat-card');
                if (card && card.dataset.id) {
                    selectSeat(Number(card.dataset.id));
                }
            });
        }

        // 绑定筛选器
        document.getElementById('floorFilter').addEventListener('change', applyFilters);
        document.getElementById('areaFilter').addEventListener('change', applyFilters);
        document.getElementById('powerFilter').addEventListener('change', applyFilters);
        
        // 绑定弹窗关闭
        document.getElementById('closeModalBtn').addEventListener('click', closeSeatModal);
        document.getElementById('modalOverlay').addEventListener('click', closeSeatModal);
    }

    // 确保 DOM 加载完毕后执行[6](@ref)
    document.addEventListener('DOMContentLoaded', init);
})();