(function () {
  'use strict';

  // ---------- 数据初始化（新增） ----------
  function initData() {
    // 如果本地没有座位数据，自动生成默认座位
    if (!localStorage.getItem('lib_seats')) {
      const defaultSeats = [
        { id: 1, code: 'A01', floor: 1, area: 'quiet', hasPower: true, status: 'free', enabled: true },
        { id: 2, code: 'A02', floor: 1, area: 'quiet', hasPower: true, status: 'free', enabled: true },
        { id: 3, code: 'A03', floor: 1, area: 'quiet', hasPower: false, status: 'free', enabled: true },
        { id: 4, code: 'B01', floor: 1, area: 'discuss', hasPower: true, status: 'free', enabled: true },
        { id: 5, code: 'B02', floor: 1, area: 'discuss', hasPower: false, status: 'free', enabled: true },
        { id: 6, code: 'C01', floor: 2, area: 'window', hasPower: true, status: 'free', enabled: true },
        { id: 7, code: 'C02', floor: 2, area: 'window', hasPower: true, status: 'free', enabled: true },
        { id: 8, code: 'D01', floor: 2, area: 'quiet', hasPower: false, status: 'free', enabled: true }
      ];
      localStorage.setItem('lib_seats', JSON.stringify(defaultSeats));
    }
    if (!localStorage.getItem('lib_bookings')) {
      localStorage.setItem('lib_bookings', JSON.stringify([]));
    }
    if (!localStorage.getItem('lib_rules')) {
      const defaultRules = {
        maxMinutes: 240,
        graceMinutes: 15,
        awayMinutes: 45,
        awayTimes: 3,
        awayPenalty: 10,
        classMinutes: 120,
        classTimes: 1,
        classPenalty: 20,
        classMinCredit: 80
      };
      localStorage.setItem('lib_rules', JSON.stringify(defaultRules));
    }
  }

  // ---------- 数据读写 ----------
  function getSeats() {
    return JSON.parse(localStorage.getItem('lib_seats')) || [];
  }
  function setSeats(data) {
    localStorage.setItem('lib_seats', JSON.stringify(data));
  }
  function getBookings() {
    return JSON.parse(localStorage.getItem('lib_bookings')) || [];
  }
  function setBookings(data) {
    localStorage.setItem('lib_bookings', JSON.stringify(data));
  }
  function getRules() {
    return JSON.parse(localStorage.getItem('lib_rules')) || {};
  }
  function getCurrentUser() {
    return JSON.parse(localStorage.getItem('currentUser'));
  }
  function updateUserInStorage(user) {
    let users = JSON.parse(localStorage.getItem('lib_users')) || [];
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) users[idx] = user;
    else users.push(user);
    localStorage.setItem('lib_users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  const ACTIVE_STATUS = ['active', 'checked_in', 'away', 'class_reserve'];
  let currentUser = getCurrentUser();
  let selectedSeatId = null;
  let countdownInterval = null;

  document.addEventListener('DOMContentLoaded', function () {
    // 首次加载时初始化数据
    initData();

    if (!currentUser) {
      window.location.href = '../index.html';
      return;
    }
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userCredit').textContent = currentUser.credit;
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '管理员' : '学生';
    renderSeats();
    renderMyBookings();
    updateStats();
    document.getElementById('filterFloor').addEventListener('change', function() { renderSeats(); updateStats(); });
    document.getElementById('filterArea').addEventListener('change', function() { renderSeats(); updateStats(); });
    restoreActiveTimer();
  });

  // ---------- 渲染座位网格 ----------
  function renderSeats() {
    const container = document.getElementById('seatGrid');
    if (!container) return;
    const seats = getSeats();
    const floorFilter = document.getElementById('filterFloor').value;
    const areaFilter = document.getElementById('filterArea').value;
    const filtered = seats.filter(s => {
      if (floorFilter !== 'all' && s.floor != floorFilter) return false;
      if (areaFilter !== 'all' && s.area !== areaFilter) return false;
      return true;
    });
    container.innerHTML = filtered.map(seat => {
      const statusClass = seat.enabled ? seat.status : 'disabled';
      const statusText = getStatusText(seat.status);
      const isSelected = selectedSeatId === seat.id ? 'selected' : '';
      return `<div class="seat-item ${statusClass} ${isSelected}" data-id="${seat.id}" onclick="window.selectSeat(${seat.id})">
          <div class="seat-code">${seat.code}</div>
          <div class="seat-status">${statusText}</div>
          ${seat.hasPower ? '<div class="seat-power">🔌</div>' : ''}
        </div>`;
    }).join('');
  }

  function getStatusText(status) {
    const map = { free: '空闲', used: '使用中', away: '暂离', reserved: '已预约', maintenance: '维修' };
    return map[status] || status;
  }

  // ---------- 统计卡片 ----------
  function updateStats() {
    const seats = getSeats();
    const floorFilter = document.getElementById('filterFloor').value;
    const areaFilter = document.getElementById('filterArea').value;
    const filtered = seats.filter(s => {
      if (floorFilter !== 'all' && s.floor != floorFilter) return false;
      if (areaFilter !== 'all' && s.area !== areaFilter) return false;
      return true;
    });
    document.getElementById('totalSeats').textContent = filtered.length;
    document.getElementById('freeSeats').textContent = filtered.filter(s => s.status === 'free' && s.enabled).length;
    document.getElementById('usedSeats').textContent = filtered.filter(s => s.status === 'used' || s.status === 'away').length;
    const myBookings = getBookings().filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
    document.getElementById('myBookingsCount').textContent = myBookings.length;
  }

  // ---------- 选择座位 ----------
  window.selectSeat = function (seatId) {
    selectedSeatId = seatId;
    renderSeats();
    const seat = getSeats().find(s => s.id === seatId);
    if (!seat) return;
    document.getElementById('detailCode').textContent = seat.code;
    document.getElementById('detailFloor').textContent = seat.floor + 'F';
    document.getElementById('detailArea').textContent = seat.area;
    document.getElementById('detailPower').textContent = seat.hasPower ? '有' : '无';
    document.getElementById('detailStatus').textContent = getStatusText(seat.status);
    showActionButtons(seat);
  };

  function showActionButtons(seat) {
    const actionsDiv = document.getElementById('seatActions');
    if (!actionsDiv) return;
    const userId = currentUser.id;
    const myBooking = getBookings().find(b => b.userId === userId && b.seatCode === seat.code && ACTIVE_STATUS.includes(b.status));
    let html = '';
    if (seat.status === 'free' && seat.enabled) {
      html += `<button class="btn btn-primary" onclick="window.bookSeat(${seat.id})">预约</button>`;
    }
    if (myBooking) {
      if (myBooking.status === 'active') {
        html += `<button class="btn btn-success" onclick="window.checkIn(${myBooking.id})">签到</button>`;
      }
      if (myBooking.status === 'checked_in') {
        html += `<button class="btn btn-warning" onclick="window.startAway(${myBooking.id})">暂离</button>`;
        if (currentUser.credit >= (getRules().classMinCredit || 80)) {
          html += `<button class="btn btn-info" onclick="window.startClassReserve(${myBooking.id})">上课保留</button>`;
        }
        html += `<button class="btn btn-danger" onclick="window.returnSeat(${myBooking.id})">释放座位</button>`;
      }
      if (myBooking.status === 'away') {
        html += `<button class="btn btn-success" onclick="window.returnFromAway(${myBooking.id})">返回座位</button>`;
      }
      if (myBooking.status === 'class_reserve') {
        html += `<button class="btn btn-success" onclick="window.returnFromClass(${myBooking.id})">返回座位</button>`;
      }
    }
    actionsDiv.innerHTML = html;
  }

  // ---------- 预约 ----------
  window.bookSeat = function (seatId) {
    const seat = getSeats().find(s => s.id === seatId);
    if (!seat || seat.status !== 'free') return alert('该座位不可预约');
    const existing = getBookings().filter(b => b.userId === currentUser.id && ACTIVE_STATUS.includes(b.status));
    if (existing.length > 0) return alert('您已有一个进行中的预约，请先完成或取消当前预约后再预约新座位。');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const slot = `${now.getHours()}:00 - ${now.getHours() + 1}:00`;
    const booking = {
      id: Date.now(), userId: currentUser.id, userName: currentUser.name,
      seatCode: seat.code, date: dateStr, slot: slot,
      status: 'active', createTime: now.toISOString()
    };
    const bookings = getBookings();
    bookings.push(booking);
    setBookings(bookings);
    seat.status = 'reserved';
    setSeats(getSeats());
    renderSeats();
    renderMyBookings();
    updateStats();
    showActionButtons(seat);
    alert('预约成功！请在15分钟内签到。');
  };

  // ---------- 签到 ----------
  window.checkIn = function (bookingId) {
    const bookings = getBookings();
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || booking.status !== 'active') return alert('预约状态异常');
    const seats = getSeats();
    const seat = seats.find(s => s.code === booking.seatCode);
    if (!seat) return alert('座位不存在');
    booking.status = 'checked_in';
    seat.status = 'used';
    setBookings(bookings);
    setSeats(seats);
    renderSeats();
    renderMyBookings();
    updateStats();
    showActionButtons(seat);
    alert('签到成功！');
  };

  // ---------- 暂离 ----------
  window.startAway = function (bookingId) {
    const bookings = getBookings();
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || booking.status !== 'checked_in') return alert('当前状态不允许暂离');
    const seats = getSeats();
    const seat = seats.find(s => s.code === booking.seatCode);
    if (!seat) return;
    booking.status = 'away';
    seat.status = 'away';
    setBookings(bookings);
    setSeats(seats);
    const awayMinutes = (getRules().awayMinutes || 45);
    startCountdown(awayMinutes, '暂离中', bookingId);
    renderSeats();
    renderMyBookings();
    updateStats();
    showActionButtons(seat);
    alert(`暂离模式已启动，请在${awayMinutes}分钟内返回，否则将扣分。`);
  };

  // ---------- 上课保留 ----------
  window.startClassReserve = function (bookingId) {
    const rules = getRules();
    if (currentUser.credit < (rules.classMinCredit || 80)) return alert('信用分不足80，无法使用上课保留功能。');
    const bookings = getBookings();
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || booking.status !== 'checked_in') return alert('当前状态不允许上课保留');
    const seats = getSeats();
    const seat = seats.find(s => s.code === booking.seatCode);
    if (!seat) return;
    booking.status = 'class_reserve';
    seat.status = 'reserved';
    setBookings(bookings);
    setSeats(seats);
    const classMinutes = rules.classMinutes || 120;
    startCountdown(classMinutes, '上课保留中', bookingId);
    renderSeats();
    renderMyBookings();
    updateStats();
    showActionButtons(seat);
    alert(`上课保留已启动，座位将保留${classMinutes}分钟。`);
  };

  // ---------- 返回座位 ----------
  window.returnFromAway = function (bookingId) { finishReturn(bookingId, 'away'); };
  window.returnFromClass = function (bookingId) { finishReturn(bookingId, 'class_reserve'); };

  function finishReturn(bookingId, expectedStatus) {
    const bookings = getBookings();
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || booking.status !== expectedStatus) return alert('状态异常');
    const seats = getSeats();
    const seat = seats.find(s => s.code === booking.seatCode);
    if (!seat) return;
    booking.status = 'checked_in';
    seat.status = 'used';
    setBookings(bookings);
    setSeats(seats);
    stopCountdown();
    renderSeats();
    renderMyBookings();
    updateStats();
    showActionButtons(seat);
    alert('已返回座位。');
  }

  // ---------- 释放座位 ----------
  window.returnSeat = function (bookingId) {
    const bookings = getBookings();
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || !ACTIVE_STATUS.includes(booking.status)) return alert('当前状态不允许释放座位');
    const seats = getSeats();
    const seat = seats.find(s => s.code === booking.seatCode);
    if (!seat) return;
    booking.status = 'cancelled';
    seat.status = 'free';
    setBookings(bookings);
    setSeats(seats);
    stopCountdown();
    renderSeats();
    renderMyBookings();
    updateStats();
    showActionButtons(seat);
    alert('座位已释放。');
  };

  // ---------- 倒计时 ----------
  function startCountdown(totalMinutes, label, bookingId) {
    stopCountdown();
    const panel = document.getElementById('timerPanel');
    if (!panel) return;
    panel.style.display = 'block';
    document.getElementById('timerLabel').textContent = label;
    const remainingSpan = document.getElementById('timerRemaining');
    const progressBar = document.getElementById('timerProgress');
    let remainingSeconds = totalMinutes * 60;
    updateDisplay();
    countdownInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        handleTimeout(bookingId, label);
        panel.style.display = 'none';
        return;
      }
      updateDisplay();
    }, 1000);
    function updateDisplay() {
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      remainingSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      const percent = (remainingSeconds / (totalMinutes * 60)) * 100;
      progressBar.style.width = percent + '%';
    }
  }

  function stopCountdown() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    const panel = document.getElementById('timerPanel');
    if (panel) panel.style.display = 'none';
    const progressBar = document.getElementById('timerProgress');
    if (progressBar) progressBar.style.width = '100%';
    const remainingSpan = document.getElementById('timerRemaining');
    if (remainingSpan) remainingSpan.textContent = '--:--';
  }

  function handleTimeout(bookingId, label) {
    const bookings = getBookings();
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;
    const seats = getSeats();
    const seat = seats.find(s => s.code === booking.seatCode);
    if (!seat) return;
    const rules = getRules();
    let penalty = 0;
    if (label === '暂离中') penalty = rules.awayPenalty || 10;
    else if (label === '上课保留中') penalty = rules.classPenalty || 20;
    if (penalty > 0) {
      currentUser.credit = Math.max(0, currentUser.credit - penalty);
      updateUserInStorage(currentUser);
      document.getElementById('userCredit').textContent = currentUser.credit;
    }
    booking.status = 'cancelled';
    seat.status = 'free';
    setBookings(bookings);
    setSeats(seats);
    renderSeats();
    renderMyBookings();
    updateStats();
    showActionButtons(seat);
    alert(`${label}超时，已释放座位并扣除${penalty}分信用分。`);
  }

  function restoreActiveTimer() {
    const bookings = getBookings();
    const activeBooking = bookings.find(b => b.userId === currentUser.id && (b.status === 'away' || b.status === 'class_reserve'));
    if (!activeBooking) return;
    const rules = getRules();
    let totalMinutes, label;
    if (activeBooking.status === 'away') { totalMinutes = rules.awayMinutes || 45; label = '暂离中'; }
    else { totalMinutes = rules.classMinutes || 120; label = '上课保留中'; }
    const created = new Date(activeBooking.createTime);
    const elapsed = (Date.now() - created.getTime()) / 1000;
    const remaining = Math.max(0, totalMinutes * 60 - elapsed);
    if (remaining <= 0) { handleTimeout(activeBooking.id, label); return; }
    const panel = document.getElementById('timerPanel');
    if (!panel) return;
    panel.style.display = 'block';
    document.getElementById('timerLabel').textContent = label;
    const remainingSpan = document.getElementById('timerRemaining');
    const progressBar = document.getElementById('timerProgress');
    let remainingSeconds = Math.round(remaining);
    updateDisplay();
    countdownInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        handleTimeout(activeBooking.id, label);
        panel.style.display = 'none';
        return;
      }
      updateDisplay();
    }, 1000);
    function updateDisplay() {
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      remainingSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      const percent = (remainingSeconds / (totalMinutes * 60)) * 100;
      progressBar.style.width = percent + '%';
    }
  }

  function renderMyBookings() {
    const list = document.getElementById('myBookingsList');
    if (!list) return;
    const bookings = getBookings().filter(b => b.userId === currentUser.id && b.status !== 'cancelled');
    list.innerHTML = bookings.length === 0
      ? '<li class="empty">暂无进行中的预约</li>'
      : bookings.map(b => `<li>${b.seatCode} - ${b.date} ${b.slot} (${b.status})</li>`).join('');
  }
})();