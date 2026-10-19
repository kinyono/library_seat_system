const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const auth = require('../middleware/auth');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// POST /api/bookings - 预约座位
router.post('/', auth, async (req, res) => {
  const { seatId, date, timeSlot } = req.body;
  if (!seatId || !date || !timeSlot) {
    return res.status(400).json({ error: '参数不完整' });
  }
  const userId = req.user.id;
  try {
    // 检查座位是否存在且空闲
    const [seats] = await pool.query('SELECT * FROM seats WHERE id = ? AND status = ?', [seatId, 'free']);
    if (seats.length === 0) {
      return res.status(400).json({ error: '该座位不可预约' });
    }
    // 检查用户在该时间段是否已有预约（冲突检测）
    const [existing] = await pool.query(
      'SELECT * FROM bookings WHERE user_id = ? AND date = ? AND time_slot = ? AND status IN ("pending","confirmed")',
      [userId, date, timeSlot]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: '您在该时段已有预约' });
    }
    // 创建预约记录
    const [result] = await pool.query(
      'INSERT INTO bookings (user_id, seat_id, date, time_slot, status) VALUES (?, ?, ?, ?, ?)',
      [userId, seatId, date, timeSlot, 'pending']
    );
    // 更新座位状态为 occupied
    await pool.query('UPDATE seats SET status = ? WHERE id = ?', ['occupied', seatId]);
    res.status(201).json({ message: '预约成功', bookingId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '预约失败' });
  }
});

// PUT /api/bookings/:id/checkin - 签到
router.put('/:id/checkin', auth, async (req, res) => {
  const bookingId = req.params.id;
  try {
    const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [bookingId, req.user.id]);
    if (bookings.length === 0) return res.status(404).json({ error: '预约不存在' });
    const booking = bookings[0];
    if (booking.status !== 'pending') return res.status(400).json({ error: '当前状态不允许签到' });
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', ['confirmed', bookingId]);
    res.json({ message: '签到成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '签到失败' });
  }
});

// PUT /api/bookings/:id/cancel - 取消预约（超时扣分）
router.put('/:id/cancel', auth, async (req, res) => {
  const bookingId = req.params.id;
  try {
    const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [bookingId, req.user.id]);
    if (bookings.length === 0) return res.status(404).json({ error: '预约不存在' });
    const booking = bookings[0];
    if (booking.status === 'cancelled') return res.status(400).json({ error: '已取消' });
    // 如果超过签到时间（假设签到截止为预约时间前15分钟），扣信用分
    const now = new Date();
    const bookingDate = new Date(booking.date + 'T' + booking.time_slot);
    const diffMs = bookingDate - now;
    const penalty = diffMs < 15 * 60 * 1000 ? 10 : 0; // 15分钟内扣10分
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', bookingId]);
    if (penalty > 0) {
      await pool.query('UPDATE users SET credit = GREATEST(credit - ?, 0) WHERE id = ?', [penalty, req.user.id]);
    }
    // 释放座位
    await pool.query('UPDATE seats SET status = ? WHERE id = ?', ['free', booking.seat_id]);
    res.json({ message: '取消成功', penalty });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '取消失败' });
  }
});

// PUT /api/bookings/:id/away - 暂离
router.put('/:id/away', auth, async (req, res) => {
  const bookingId = req.params.id;
  try {
    const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [bookingId, req.user.id]);
    if (bookings.length === 0) return res.status(404).json({ error: '预约不存在' });
    const booking = bookings[0];
    if (booking.status !== 'confirmed') return res.status(400).json({ error: '当前状态不允许暂离' });
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', ['away', bookingId]);
    res.json({ message: '暂离成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '暂离失败' });
  }
});

// PUT /api/bookings/:id/return - 返回
router.put('/:id/return', auth, async (req, res) => {
  const bookingId = req.params.id;
  try {
    const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [bookingId, req.user.id]);
    if (bookings.length === 0) return res.status(404).json({ error: '预约不存在' });
    const booking = bookings[0];
    if (booking.status !== 'away') return res.status(400).json({ error: '当前状态不允许返回' });
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', ['confirmed', bookingId]);
    res.json({ message: '返回成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '返回失败' });
  }
});

// PUT /api/bookings/:id/release - 释放座位
router.put('/:id/release', auth, async (req, res) => {
  const bookingId = req.params.id;
  try {
    const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [bookingId, req.user.id]);
    if (bookings.length === 0) return res.status(404).json({ error: '预约不存在' });
    const booking = bookings[0];
    if (booking.status === 'released') return res.status(400).json({ error: '已释放' });
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', ['released', bookingId]);
    await pool.query('UPDATE seats SET status = ? WHERE id = ?', ['free', booking.seat_id]);
    res.json({ message: '释放成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '释放失败' });
  }
});

// GET /api/bookings/my - 获取当前用户的预约列表
router.get('/my', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT b.*, s.seat_code, s.floor, s.area FROM bookings b JOIN seats s ON b.seat_id = s.id WHERE b.user_id = ? ORDER BY b.created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '查询失败' });
  }
});

module.exports = router;