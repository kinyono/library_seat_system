// 模拟数据渲染与交互逻辑
document.addEventListener('DOMContentLoaded', () => {
    // 1. 顶部筛选标签交互
    const periodBtns = document.querySelectorAll('.period-btn');
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            periodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const period = btn.dataset.period;
            updateData(period);
        });
    });

    // 初始化图表
    initCharts();
    // 默认加载全部数据
    updateData('all');
});

// 模拟更新数据
function updateData(period) {
    console.log(`切换到: ${period}`);
    // 这里可以接入真实的本地存储数据读取逻辑
    // 示例：重置并动画显示数值
    animateValue('totalDuration', 0, 1.0, 1000);
    animateValue('totalBookings', 0, 60, 1000, true);
    animateValue('avgDuration', 0, 10, 1000, true);
    animateValue('totalPenalty', 0, 0, 1000, true);
    
    // 触发图表更新
    updateCharts(period);
}

// 数字滚动动画
function animateValue(id, start, end, duration, isInt = false) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const val = progress * (end - start) + start;
        obj.innerHTML = isInt ? Math.floor(val) : val.toFixed(1);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// 图表全局配置
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
Chart.defaults.color = '#6b7280';

let trendChart, seatChart, areaChart, floorChart, powerChart, peakChart;

function initCharts() {
    // 趋势图（折线面积图）
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: ['10-12', '10-13', '10-14', '10-15', '10-16', '10-17', '10-18'],
            datasets: [{
                label: '学习时长(小时)',
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 1.0 } }
        }
    });

    // 座位余量（环形图）
    const seatCtx = document.getElementById('seatAvailabilityChart').getContext('2d');
    seatChart = new Chart(seatCtx, {
        type: 'doughnut',
        data: {
            labels: ['空闲', '使用中', '已预约', '暂离', '不可用'],
            datasets: [{
                data: [],
                backgroundColor: ['#22c55e', '#6366f1', '#f59e0b', '#ec4899', '#9ca3af']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
    });

    // 区域偏好（极地图）
    const areaCtx = document.getElementById('areaChart').getContext('2d');
    areaChart = new Chart(areaCtx, { type: 'polarArea', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#6366f1', '#22c55e', '#f59e0b'] }] }, options: { responsive: true, maintainAspectRatio: false } });

    // 楼层偏好（柱状图）
    const floorCtx = document.getElementById('floorChart').getContext('2d');
    floorChart = new Chart(floorCtx, { type: 'bar', data: { labels: ['1F', '2F', '3F'], datasets: [{ label: '次数', data: [], backgroundColor: '#6366f1' }] }, options: { responsive: true, maintainAspectRatio: false } });

    // 电源需求（饼图）
    const powerCtx = document.getElementById('powerChart').getContext('2d');
    powerChart = new Chart(powerCtx, { type: 'pie', data: { labels: ['需要', '不需要'], datasets: [{ data: [], backgroundColor: ['#6366f1', '#e5e7eb'] }] }, options: { responsive: true, maintainAspectRatio: false } });

    // 峰值（柱状图）
    const peakCtx = document.getElementById('peakChart').getContext('2d');
    peakChart = new Chart(peakCtx, { type: 'bar', data: { labels: ['08:00', '10:00', '14:00', '16:00', '19:00'], datasets: [{ label: '人数', data: [], backgroundColor: '#22c55e' }] }, options: { responsive: true, maintainAspectRatio: false } });
}

function updateCharts(period) {
    // 模拟数据更新与空状态判断
    const hasData = period === 'all' || period === 'month'; // 模拟本周无数据
    
    if (hasData) {
        document.getElementById('trendEmpty').style.display = 'none';
        trendChart.data.datasets[0].data = [0.2, 0.5, 0.8, 0.3, 0.6, 0.9, 1.0];
        seatChart.data.datasets[0].data = [80, 15, 5, 0, 0];
        areaChart.data.datasets[0].data = [30, 20, 10];
        floorChart.data.datasets[0].data = [20, 25, 15];
        powerChart.data.datasets[0].data = [40, 20];
        peakChart.data.datasets[0].data = [5, 12, 8, 15, 10];
    } else {
        // 显示空状态
        document.getElementById('trendEmpty').style.display = 'block';
        trendChart.data.datasets[0].data = [];
        seatChart.data.datasets[0].data = [];
        areaChart.data.datasets[0].data = [];
        floorChart.data.datasets[0].data = [];
        powerChart.data.datasets[0].data = [];
        peakChart.data.datasets[0].data = [];
    }
    
    trendChart.update();
    seatChart.update();
    areaChart.update();
    floorChart.update();
    powerChart.update();
    peakChart.update();
}

// 退出登录模拟
function logout() {
    alert('已退出');
    window.location.href = '../index.html';
}