/* ============================================================
   statistics.js - 图书馆座位管理系统数据统计页
   依赖：Chart.js 4.4 (CDN)
   数据源：localStorage (lib_seats, lib_bookings, currentUser)
   核心逻辑：基于预约记录实时同步座位状态，图表反映实际操作
   ============================================================ */

/* ---------- 数据读写 ---------- */
function getSeats()    { return JSON.parse(localStorage.getItem('lib_seats')    || '[]'); }
function getBookings() { return JSON.parse(localStorage.getItem('lib_bookings') || '[]'); }
function getUser()     { return JSON.parse(localStorage.getItem('currentUser')); }

/* ---------- 初始化座位（仅首次创建，全部空闲） ---------- */
function initData() {
    if (localStorage.getItem('lib_seats')) return; // 已有则不覆盖

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
                status: 'free',          // 全部初始空闲
                enabled: true
            });
        }
    }
    localStorage.setItem('lib_seats', JSON.stringify(seats));
    if (!localStorage.getItem('lib_bookings')) localStorage.setItem('lib_bookings', JSON.stringify([]));
}

/* ---------- 根据有效预约同步座位状态 ---------- */
function syncSeatStatusWithBookings() {
    const seats = getSeats();
    const bookings = getBookings();
    const now = new Date();

    // 重置所有可用座位为空闲
    seats.forEach(seat => {
        if (seat.enabled !== false) seat.status = 'free';
    });

    // 遍历预约记录，更新对应座位状态
    bookings.forEach(booking => {
        const seat = seats.find(s => s.id === booking.seatId);
        if (!seat || seat.enabled === false) return;

        const start = new Date(booking.date + 'T' + booking.startTime);
        const end   = new Date(booking.date + 'T' + booking.endTime);

        if (now < start) {
            seat.status = 'reserved';           // 未开始 → 已预约
        } else if (now >= start && now < end) {
            seat.status = 'used';               // 进行中 → 使用中
        } else {
            seat.status = 'free';               // 已结束 → 空闲
        }
    });

    localStorage.setItem('lib_seats', JSON.stringify(seats));
}

/* ---------- 工具函数 ---------- */
function getWeekRange(date = new Date()) {
    const day = date.getDay() || 7; // 周日返回7
    const diff = day - 1;
    const monday = new Date(date);
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    return { start: monday, end: sunday };
}

function getMonthRange(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start: first, end: last };
}

function filterBookingsByRange(rangeType) {
    const all = getBookings();
    const now = new Date();
    let range;
    if (rangeType === 'week') range = getWeekRange(now);
    else if (rangeType === 'month') range = getMonthRange(now);
    else return all; // 'all'

    return all.filter(b => {
        const d = new Date(b.date + 'T' + b.startTime);
        return d >= range.start && d <= range.end;
    });
}

/* ---------- 渲染图表 ---------- */
let chartInstances = {}; // 保存图表实例以便销毁

function destroyCharts() {
    Object.values(chartInstances).forEach(c => c?.destroy());
    chartInstances = {};
}

function renderCharts(rangeType = 'all') {
    destroyCharts();
    const seats = getSeats();
    const filteredBookings = filterBookingsByRange(rangeType);

    // 1. 座位实时余量环形图
    const statusCount = { free: 0, used: 0, reserved: 0, away: 0, disabled: 0 };
    seats.forEach(s => {
        const st = s.enabled === false ? 'disabled' : (s.status || 'free');
        statusCount[st] = (statusCount[st] || 0) + 1;
    });
    const ctx1 = document.getElementById('seatChart')?.getContext('2d');
    if (ctx1) {
        chartInstances.seat = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['空闲', '使用中', '已预约', '暂离', '不可用'],
                datasets: [{
                    data: [statusCount.free, statusCount.used, statusCount.reserved, statusCount.away, statusCount.disabled],
                    backgroundColor: ['#22c55e', '#6366f1', '#f59e0b', '#ec4899', '#94a3b8'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // 2. 区域偏好极坐标图（基于预约记录）
    const areaCount = { quiet: 0, discuss: 0, window: 0 };
    filteredBookings.forEach(b => {
        const seat = seats.find(s => s.id === b.seatId);
        if (seat && areaCount[seat.area] !== undefined) areaCount[seat.area]++;
    });
    // 如果没有任何预约记录，则按座位总数显示（避免空图）
    const totalArea = Object.values(areaCount).reduce((a,b)=>a+b,0);
    if (totalArea === 0) {
        seats.forEach(s => { if (areaCount[s.area] !== undefined) areaCount[s.area]++; });
    }
    const ctx2 = document.getElementById('areaChart')?.getContext('2d');
    if (ctx2) {
        chartInstances.area = new Chart(ctx2, {
            type: 'polarArea',
            data: {
                labels: ['静音区', '讨论区', '靠窗区'],
                datasets: [{
                    data: [areaCount.quiet, areaCount.discuss, areaCount.window],
                    backgroundColor: ['#6366f1', '#22c55e', '#f59e0b']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // 3. 楼层偏好柱状图（基于预约记录）
    const floorCount = { 1: 0, 2: 0, 3: 0 };
    filteredBookings.forEach(b => {
        const seat = seats.find(s => s.id === b.seatId);
        if (seat && floorCount[seat.floor] !== undefined) floorCount[seat.floor]++;
    });
    const totalFloor = Object.values(floorCount).reduce((a,b)=>a+b,0);
    if (totalFloor === 0) {
        seats.forEach(s => { if (floorCount[s.floor] !== undefined) floorCount[s.floor]++; });
    }
    const ctx3 = document.getElementById('floorChart')?.getContext('2d');
    if (ctx3) {
        chartInstances.floor = new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: ['1楼', '2楼', '3楼'],
                datasets: [{
                    label: '预约次数',
                    data: [floorCount[1], floorCount[2], floorCount[3]],
                    backgroundColor: ['#6366f1', '#22c55e', '#f59e0b'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // 4. 学习时长统计（柱状图，按天聚合）
    const durationMap = {};
    filteredBookings.forEach(b => {
        if (!b.actualStart || !b.actualEnd) return; // 无实际记录则跳过
        const day = b.date; // 格式 YYYY-MM-DD
        const start = new Date(b.date + 'T' + b.actualStart);
        const end   = new Date(b.date + 'T' + b.actualEnd);
        const minutes = (end - start) / 60000;
        if (minutes > 0) {
            durationMap[day] = (durationMap[day] || 0) + minutes;
        }
    });
    const sortedDays = Object.keys(durationMap).sort();
    const durations = sortedDays.map(d => +(durationMap[d] / 60).toFixed(1)); // 转换为小时
    const ctx4 = document.getElementById('durationChart')?.getContext('2d');
    if (ctx4) {
        chartInstances.duration = new Chart(ctx4, {
            type: 'bar',
            data: {
                labels: sortedDays.length ? sortedDays : ['暂无数据'],
                datasets: [{
                    label: '学习时长 (小时)',
                    data: durations.length ? durations : [0],
                    backgroundColor: '#6366f1',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: '小时' } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

/* ---------- 时间范围切换 ---------- */
function switchRange(rangeType) {
    // 更新按钮高亮样式
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === rangeType);
    });
    renderCharts(rangeType);
}

/* ---------- 页面初始化 ---------- */
function init() {
    // 确保数据已初始化
    if (!localStorage.getItem('lib_seats')) initData();
    if (!localStorage.getItem('lib_bookings')) localStorage.setItem('lib_bookings', JSON.stringify([]));

    // 同步座位状态
    syncSeatStatusWithBookings();

    // 绑定时间范围切换事件
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', () => switchRange(btn.dataset.range));
    });

    // 默认显示全部
    renderCharts('all');
}

// DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', init);