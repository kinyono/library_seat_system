(function () {
    'use strict';

    function getSeats()    { return JSON.parse(localStorage.getItem('lib_seats')    || '[]'); }
    function getBookings() { return JSON.parse(localStorage.getItem('lib_bookings') || '[]'); }
    function getUser()     { return JSON.parse(localStorage.getItem('currentUser')); }

    // 是否同一周（周一为起点）
    function isSameWeek(d1, d2) {
        const one = new Date(d1); one.setHours(0,0,0,0);
        const two = new Date(d2); two.setHours(0,0,0,0);
        const day = two.getDay() || 7;
        const diff = (two - one) / 86400000;
        return two >= one && diff < day;
    }

    function getRealDurationMinutes(booking) {
        if (booking.actualStart && booking.actualEnd) {
            return Math.max(0, Math.round((new Date(booking.actualEnd) - new Date(booking.actualStart)) / 60000));
        }
        if (booking.slot) {
            const [s, e] = booking.slot.split(' - ');
            const [sh, sm] = s.split(':').map(Number);
            const [eh, em] = e.split(':').map(Number);
            return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
        }
        return 0;
    }

    function getPeriodBookings(period) {
        const user = getUser();
        if (!user) return [];
        const bookings = getBookings().filter(b => b.userId === user.id);
        const now = new Date();
        return bookings.filter(b => {
            const dateStr = b.date || (b.createTime || '').slice(0, 10);
            if (!dateStr) return false;
            const bd = new Date(dateStr);
            if (period === 'week') return isSameWeek(bd, now);
            if (period === 'month') return bd.getMonth() === now.getMonth() && bd.getFullYear() === now.getFullYear();
            return true; // all
        });
    }

    function computeStats(bookings) {
        const seats = getSeats();
        let totalMin = 0, penalty = 0;
        const dailyMap = {}, hourMap = {}, areaMap = { quiet:0, discuss:0, window:0 }, floorMap = {}, power = { has:0, no:0 };
        const completed = bookings.filter(b => b.status !== 'cancelled');

        completed.forEach(b => {
            const dur = getRealDurationMinutes(b);
            totalMin += dur;
            const dateStr = b.date || (b.createTime || '').slice(0, 10);
            if (dateStr) dailyMap[dateStr] = (dailyMap[dateStr] || 0) + dur;
            if (b.slot) {
                const startHour = parseInt(b.slot.split(' - ')[0].split(':')[0], 10);
                hourMap[startHour] = (hourMap[startHour] || 0) + 1;
            }
            const seat = seats.find(s => s.code === b.seatCode);
            if (seat) {
                if (areaMap.hasOwnProperty(seat.area)) areaMap[seat.area]++;
                floorMap[seat.floor] = (floorMap[seat.floor] || 0) + 1;
                seat.hasPower ? power.has++ : power.no++;
            }
        });

        const user = getUser();
        penalty = Math.max(0, 100 - (user.credit || 100));

        return { totalMin, count: completed.length, avg: completed.length ? Math.round(totalMin / completed.length) : 0,
                 penalty, dailyMap, hourMap, areaMap, floorMap, power };
    }

    /* ===== 渲染 ===== */
    let trendChart = null, peakChart = null;

    function renderOverview(s) {
        animateNumber('totalHours', (s.totalMin / 60).toFixed(1));
        animateNumber('totalBookings', s.count);
        animateNumber('avgDuration', s.avg);
        animateNumber('totalPenalty', s.penalty);
    }

    function animateNumber(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        const isFloat = target % 1 !== 0;
        const start = parseFloat(el.textContent) || 0;
        const end = parseFloat(target);
        const dur = 600, step = 16;
        const ticks = Math.max(1, dur / step);
        let i = 0;
        const timer = setInterval(() => {
            i++;
            const v = start + (end - start) * (i / ticks);
            el.textContent = isFloat ? v.toFixed(1) : Math.round(v);
            if (i >= ticks) { clearInterval(timer); el.textContent = target; }
        }, step);
    }

    function renderTrend(s, period) {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;
        const now = new Date();
        let labels = [], days = 0;
        if (period === 'week') {
            days = 7;
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now); d.setDate(d.getDate() - i);
                labels.push(d.toISOString().slice(5, 10));
            }
        } else if (period === 'month') {
            days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for (let i = 0; i < days; i++) {
                const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
                labels.push(d.toISOString().slice(5, 10));
            }
        } else {
            const all = Object.keys(s.dailyMap).sort();
            days = Math.max(7, Math.min(30, all.length));
            labels = all.slice(-days);
        }
        const values = labels.map(l => +((s.dailyMap[l] || 0) / 60).toFixed(1));

        if (trendChart) trendChart.destroy();
        trendChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: { labels, datasets: [{
                label: '学习时长（小时）', data: values, fill: true,
                backgroundColor: 'rgba(99,102,241,0.15)', borderColor: '#6366f1',
                tension: 0.3, pointBackgroundColor: '#6366f1', pointRadius: 3
            }]},
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, title: { display: true, text: '小时' } } } }
        });
    }

    function renderSeatDonut() {
        const seats = getSeats();
        const c = { free:0, used:0, reserved:0, away:0, other:0 };
        seats.forEach(s => {
            if (!s.enabled) c.other++;
            else if (s.status === 'free') c.free++;
            else if (s.status === 'used') c.used++;
            else if (s.status === 'reserved') c.reserved++;
            else if (s.status === 'away') c.away++;
            else c.other++;
        });
        const ctx = document.getElementById('seatAvailabilityChart');
        if (!ctx) return;
        new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['空闲','使用中','已预约','暂离','不可用'],
                datasets: [{ data: [c.free, c.used, c.reserved, c.away, c.other],
                    backgroundColor: ['#22c55e','#6366f1','#f59e0b','#ec4899','#94a3b8'],
                    borderWidth: 2, borderColor: '#fff' }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: { legend: { position: 'right', labels: { usePointStyle: true, padding: 12 } } } }
        });
    }

    function renderBar(ctxId, labels, values, colors, label) {
        const ctx = document.getElementById(ctxId);
        if (!ctx) return;
        new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: { labels, datasets: [{ label, data: values, backgroundColor: colors, borderRadius: 4 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, title: { display: true, text: label } } } }
        });
    }

    function renderPower() {
        const bks = getPeriodBookings('all');
        const s = computeStats(bks);
        const ctx = document.getElementById('powerChart');
        if (!ctx) return;
        new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['有电源','无电源'],
                datasets: [{ data: [s.power.has, s.power.no],
                    backgroundColor: ['#6366f1','#e2e8f0'], borderWidth: 2, borderColor: '#fff' }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } } }
        });
    }

    function renderPeak(s) {
        const ctx = document.getElementById('peakChart');
        if (!ctx) return;
        const hours = Array.from({ length: 15 }, (_, i) => i + 8);
        const labels = hours.map(h => h + ':00');
        const values = hours.map(h => s.hourMap[h] || 0);
        if (peakChart) peakChart.destroy();
        peakChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: { labels, datasets: [{
                label: '预约次数', data: values, fill: true,
                backgroundColor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e',
                tension: 0.3, pointBackgroundColor: '#22c55e', pointRadius: 2
            }]},
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, title: { display: true, text: '次数' } } } }
        });
    }

    function refresh(period) {
        const bks = getPeriodBookings(period);
        const s = computeStats(bks);
        renderOverview(s);
        renderTrend(s, period);
        renderSeatDonut();
        renderBar('areaChart', ['静音区','讨论区','靠窗区'],
            [s.areaMap.quiet, s.areaMap.discuss, s.areaMap.window],
            ['#6366f1','#f59e0b','#22c55e'], '次数');
        const floors = Object.keys(s.floorMap).sort();
        renderBar('floorChart', floors.map(f => f + 'F'), floors.map(f => s.floorMap[f]),
            ['#a855f7','#3b82f6','#06b6d4'], '次数');
        renderPower();
        renderPeak(s);
    }

    function init() {
        const user = getUser();
        if (!user) { window.location.href = '../index.html'; return; }
        const overview = document.getElementById('overviewCards');
        if (overview) overview.style.display = 'grid';

        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                refresh(this.dataset.period);
            });
        });
        refresh('week');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();