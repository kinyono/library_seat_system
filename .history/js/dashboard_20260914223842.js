// 模拟座位数据
const mockSeats = [
    { id: 1, code: 'A-01', floor: 1, area: 'quiet', hasPower: true, status: 'free' },
    { id: 2, code: 'A-02', floor: 1, area: 'quiet', hasPower: false, status: 'used' },
    { id: 3, code: 'A-03', floor: 1, area: 'quiet', hasPower: true, status: 'free' },
    { id: 4, code: 'A-04', floor: 1, area: 'quiet', hasPower: true, status: 'away' },
    { id: 5, code: 'A-05', floor: 1, area: 'quiet', hasPower: false, status: 'free' },
    { id: 6, code: 'A-06', floor: 1, area: 'quiet', hasPower: true, status: 'reserved' },
    { id: 7, code: 'B-01', floor: 1, area: 'discuss', hasPower: true, status: 'free' },
    { id: 8, code: 'B-02', floor: 1, area: 'discuss', hasPower: false, status: 'used' },
    { id: 9, code: 'B-03', floor: 1, area: 'discuss', hasPower: true, status: 'free' },
    { id: 10, code: 'B-04', floor: 1, area: 'discuss', hasPower: true, status: 'maintenance' },
    { id: 11, code: 'B-05', floor: 1, area: 'discuss', hasPower: false, status: 'free' },
    { id: 12, code: 'B-06', floor: 1, area: 'discuss', hasPower: true, status: 'used' },
    { id: 13, code: 'C-01', floor: 1, area: 'window', hasPower: true, status: 'free' },
    { id: 14, code: 'C-02', floor: 1, area: 'window', hasPower: true, status: 'free' },
    { id: 15, code: 'C-03', floor: 1, area: 'window', hasPower: false, status: 'used' },
    { id: 16, code: 'C-04', floor: 1, area: 'window', hasPower: true, status: 'away' },
    { id: 17, code: 'C-05', floor: 1, area: 'window', hasPower: true, status: 'free' },
    { id: 18, code: 'C-06', floor: 1, area: 'window', hasPower: false, status: 'free' },
];

let currentFloor = 1;
let selectedSeatId = null;

// 渲染座位
function renderSeats(floor) {
    const grid = document.getElementById('seatGrid');
    grid.innerHTML = '';

    const seats = mockSeats.filter(s => s.floor === floor);

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
    const map = {
        free: '空闲',
        used: '使用中',
        away: '暂离',
        reserved: '已预约',
        maintenance: '维修'
    };
    return map[status] || status;
}

// 更新统计
function updateStats(floor) {
    const seats = mockSeats.filter(s => s.floor === floor);
    document.getElementById('freeCount').textContent = seats.filter(s => s.status === 'free').length;
    document.getElementById('usedCount').textContent = seats.filter(s => s.status === 'used').length;
    document.getElementById('awayCount').textContent = seats.filter(s => s.status === 'away').length;
    document.getElementById('maintenanceCount').textContent = seats.filter(s => s.status === 'maintenance').length;
}

// 弹窗
function openModal(seat) {
    selectedSeatId = seat.id;
    document.getElementById('modalSeatCode').textContent = seat.code;
    document.getElementById('bookingModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('bookingModal').style.display = 'none';
    selectedSeatId = null;
}

function confirmBooking() {
    if (!selectedSeatId) return;

    const seat = mockSeats.find(s => s.id === selectedSeatId);
    const timeSlot = document.getElementById('timeSlot').value;

    alert(`✅ 预约成功！\n座位：${seat.code}\n时段：${timeSlot}\n请按时到馆签到。`);

    // 模拟状态变更
    seat.status = 'reserved';
    renderSeats(currentFloor);
    closeModal();
}

// 楼层切换
document.querySelectorAll('.floor-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFloor = parseInt(this.dataset.floor);
        renderSeats(currentFloor);
    });
});

// 退出登录
function logout() {
    if (confirm('确认退出登录？')) {
        window.location.href = '../index.html';
    }
}

// 初始化
renderSeats(1);
