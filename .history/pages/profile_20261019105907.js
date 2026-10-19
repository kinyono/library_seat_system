// 模拟与 dashboard 共享的本地存储读取逻辑
const ACTIVE_STATUS = ['booked', 'checked_in', 'away'];

function initData() {
    // 改动：不再伪造学生数据，未登录直接跳转首页
    const cu = localStorage.getItem('currentUser');
    if (!cu) {
        window.location.href = '../index.html';
        return;
    }
}

function loadProfile() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    // 改动：使用 username 而不是 name（后端返回的字段是 username）
    document.getElementById('userName').textContent = currentUser.username;
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

// 新增：根据角色动态返回主页
function goBack() {
    const cu = localStorage.getItem('currentUser');
    if (!cu) {
        window.location.href = '../index.html';
        return;
    }
    const user = JSON.parse(cu);
    if (user.role === 'admin') {
        window.location.href = '../admin.html';
    } else {
        window.location.href = 'dashboard.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initData();
    loadProfile();
    loadBookings();
});