// 模拟与 dashboard 共享的本地存储读取逻辑
const ACTIVE_STATUS = ['booked', 'checked_in', 'away'];

function initData() {
    if (!localStorage.getItem('currentUser')) {
        // 如果没登录，模拟一个用户数据供演示
        const mockUser = { name: '测试同学', credit: 100, role: 'student' };
        localStorage.setItem('currentUser', JSON.stringify(mockUser));
    }
    if (!localStorage.getItem('bookings')) {
        localStorage.setItem('bookings', JSON.stringify([]));
    }
}

function loadProfile() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userCredit').textContent = currentUser.credit || 100;
    document.getElementById('userRole').textContent = `角色：${currentUser.role === 'admin' ? '管理员' : '学生'}`;
}

function loadBookings() {
    const bookings = JSON.parse(localStorage.getItem('bookings')) || [];
    const currentBookingEl = document.getElementById('currentBooking');
    const historyListEl = document.getElementById('historyList');
    
    currentBookingEl.innerHTML = '';
    historyListEl.innerHTML = '';
    
    let hasCurrent = false;
    let historyHtml = '';

    bookings.forEach(b => {
        if (ACTIVE_STATUS.includes(b.status)) {
            hasCurrent = true;
            currentBookingEl.innerHTML += `
                <div class="booking-item">
                    <div class="b-item-info">
                        <p><strong>座位：</strong>${b.seatCode}</p>
                        <p><strong>时段：</strong>${b.startHour}:00 - ${b.endHour}:00</p>
                        <span class="status">${b.status}</span>
                    </div>
                </div>
            `;
        } else {
            // 渲染最近3条历史
            if (!historyHtml) historyHtml = '';
            historyHtml += `
                <div class="booking-item">
                    <div class="b-item-info">
                        <p><strong>座位：</strong>${b.seatCode} | <strong>时间：</strong>${b.startHour}:00-${b.endHour}:00</p>
                        <span class="status ${b.status}">${b.status === 'cancelled' ? '已取消/超时' : '已完成'}</span>
                    </div>
                </div>
            `;
        }
    });

    if (!hasCurrent) {
        currentBookingEl.innerHTML = '<div class="empty-state">暂无进行中的预约</div>';
    }
    if (!historyHtml) {
        historyListEl.innerHTML = '<div class="empty-state">暂无历史记录</div>';
    } else {
        historyListEl.innerHTML = historyHtml;
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = '../index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    initData();
    loadProfile();
    loadBookings();
});