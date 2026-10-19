(function () {
    'use strict';

    // ====== 工具函数 ======
    function getSeats()    { return JSON.parse(localStorage.getItem('lib_seats')    || '[]'); }
    function getBookings() { return JSON.parse(localStorage.getItem('lib_bookings') || '[]'); }
    function getUser()     { return JSON.parse(localStorage.getItem('currentUser')); }

    // 解析时段字符串 "HH:MM - HH:MM"，返回起始和结束分钟数
    function parseSlot(slot) {
        const parts = slot.split(' - ');
        if (parts.length !== 2) return null;
        const [sh, sm] = parts[0].split(':').map(Number);
        const [eh, em] = parts[1].split(':').map(Number);
        return { start: sh * 60 + sm, end: eh * 60 + em };
    }

    // 计算两个时间之间的分钟差
    function diffMinutes(start, end) {
        return end - start;
    }

    // ====== 数据准备 ======
    function prepareData() {
        const user = getUser();
        if (!user) { alert('请先登录'); window.location.href = '../index.html'; return; }

        const bookings = getBookings().filter(b => b.userId === user.id);
        const seats = getSeats();

        // 统计有效预约（状态不为 cancelled）
        const validBookings = bookings.filter(b => b.status !== 'cancelled');

        // 计算总学习时长（分钟）
        let totalMinutes = 0;
        let bookingCount = validBookings.length;
        let totalPenalty = 0;
        const dailyMap = {};       // key: date, value: 分钟数
        const hourMap = {};        // key: 起始小时, value: 次数
        const areaMap = { quiet: 0, discuss: 0, window: 0 };
        const floorMap = {};
        const powerMap = { has: 0, no: 0 };

        validBookings.forEach(b => {
            const parsed = parseSlot(b.slot);
            if (!parsed) return;
            const duration = diffMinutes(parsed.start, parsed.end);
            totalMinutes += duration;

            // 按日期累加
            const date = b.date;
            if (!dailyMap[date]) dailyMap[date] = 0;
            dailyMap[date] += duration;

            // 按起始小时统计
            const startHour = Math.floor(parsed.start / 60);
            if (!hourMap[startHour]) hourMap[startHour] = 0;
            hourMap[startHour]++;

            // 查找座位属性
            const seat = seats.find(s => s.code === b.seatCode);
            if (seat) {
                if (areaMap.hasOwnProperty(seat.area)) areaMap[seat.area]++;
                if (!floorMap[seat.floor]) floorMap[seat.floor] = 0;
                floorMap[seat.floor]++;
                if (seat.hasPower) powerMap.has++; else powerMap.no++;
            }
        });

        // 扣分：从用户 credit 变化估算？简单做法：假设每次扣分记录在 booking 中？没有，暂时忽略
        // 实际可以从 booking 的 penalty 字段？没有。这里用 localStorage 中的信用分差值？
        // 更简单：从用户原始信用分 100 减去当前信用分，取正数
        const originalCredit = 100;
        totalPenalty = Math.max(0, originalCredit - (user.credit || 100));

        return {
            totalMinutes,
            bookingCount,
            avgDuration: bookingCount > 0 ? Math.round(totalMinutes / bookingCount) : 0,
            totalPenalty,
            dailyMap,
            hourMap,
            areaMap,
            floorMap,
            powerMap
        };
    }

    // ====== 渲染概览卡片 ======
    function renderOverview(data) {
        document.getElementById('totalHours').textContent = (data.totalMinutes / 60).toFixed(1);
        document.getElementById('totalBookings').textContent = data.bookingCount;
        document.getElementById('avgDuration').textContent = data.avgDuration;
        document.getElementById('totalPenalty').textContent = data.totalPenalty;
    }

    // ====== 绘制图表 ======
    let trendChartInstance = null;

    function drawTrendChart(data, period) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        if (trendChartInstance) trendChartInstance.destroy();

        // 生成最近 N 天的标签和数据
        const days = period;
        const labels = [];
        const values = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            labels.push(dateStr.slice(5)); // MM-DD
            values.push(((data.dailyMap[dateStr] || 0) / 60).toFixed(1));
        }

        trendChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '学习时长（小时）',
                    data: values,
                    backgroundColor: 'rgba(99,102,241,0.7)',
                    borderColor: 'rgba(99,102,241,1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: '小时' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function drawSeatAvailability() {
        const seats = getSeats();
        const counts = { free: 0, used: 0, reserved: 0, away: 0, other: 0 };
        seats.forEach(s => {
            if (!s.enabled) { counts.other++; return; }
            if (s.status === 'free') counts.free++;
            else if (s.status === 'used') counts.used++;
            else if (s.status === 'reserved') counts.reserved++;
            else if (s.status === 'away') counts.away++;
            else counts.other++;
        });

        const ctx = document.getElementById('seatAvailabilityChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['空闲', '使用中', '已预约', '暂离', '不可用'],
                datasets: [{
                    data: [counts.free, counts.used, counts.reserved, counts.away, counts.other],
                    backgroundColor: [
                        '#22c55e', '#6366f1', '#f59e0b', '#ec4899', '#94a3b8'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { usePointStyle: true, padding: 12 } }
                },
                cutout: '65%'
            }
        });
    }

    function drawAreaChart(data) {
        const ctx = document.getElementById('areaChart').getContext('2d');
        const labels = ['静音区', '讨论区', '靠窗区'];
        const values = [data.areaMap.quiet, data.areaMap.discuss, data.areaMap.window];
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '使用次数',
                    data: values,
                    backgroundColor: ['#6366f1', '#f59e0b', '#22c55e'],
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { beginAtZero: true, title: { display: true, text: '次数' } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    function drawFloorChart(data) {
        const ctx = document.getElementById('floorChart').getContext('2d');
        const floors = Object.keys(data.floorMap).sort();
        const labels = floors.map(f => f + 'F');
        const values = floors.map(f => data.floorMap[f]);
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '使用次数',
                    data: values,
                    backgroundColor: ['#a855f7', '#3b82f6', '#06b6d4'],
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { beginAtZero: true, title: { display: true, text: '次数' } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    function drawPowerChart(data) {
        const ctx = document.getElementById('powerChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['有电源', '无电源'],
                datasets: [{
                    data: [data.powerMap.has, data.powerMap.no],
                    backgroundColor: ['#6366f1', '#e2e8f0'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true } }
                },
                cutout: '60%'
            }
        });
    }

    function drawPeakChart(data) {
        const ctx = document.getElementById('peakChart').getContext('2d');
        const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8:00 ~ 22:00
        const labels = hours.map(h => h + ':00');
        const values = hours.map(h => data.hourMap[h] || 0);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: '预约次数',
                    data: values,
                    fill: true,
                    backgroundColor: 'rgba(99,102,241,0.15)',
                    borderColor: '#6366f1',
                    tension: 0.3,
                    pointBackgroundColor: '#6366f1',
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: '次数' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ====== 初始化 ======
    function init() {
        const data = prepareData();
        if (!data) return;
        renderOverview(data);

        // 默认趋势周期 7 天
        drawTrendChart(data, 7);
        drawSeatAvailability();
        drawAreaChart(data);
        drawFloorChart(data);
        drawPowerChart(data);
        drawPeakChart(data);

        // 切换趋势周期
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const period = parseInt(this.dataset.period, 10);
                drawTrendChart(data, period);
            });
        });
    }

    // 等待 DOM 加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();