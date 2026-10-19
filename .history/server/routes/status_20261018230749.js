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

// GET /api/stats/overview - 总览统计
router.get('/overview', auth, async (req, res) => {
  try {
    const [[{ totalSeats }]] = await pool.query('SELECT COUNT(*) as totalSeats FROM seats');
    const [[{ freeSeats }]] = await pool.query("SELECT COUNT(*) as freeSeats FROM seats WHERE status='free'");
    const [[{ todayBookings }]] = await pool.query('SELECT COUNT(*) as todayBookings FROM bookings WHERE DATE(created_at)=CURDATE()');
    const [[{ activeUsers }]] = await pool.query('SELECT COUNT(DISTINCT user_id) as activeUsers FROM bookings WHERE DATE(created_at)=CURDATE()');
    res.json({ totalSeats, freeSeats, todayBookings, activeUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '查询失败' });
  }
});

// GET /api/stats/mine - 个人统计
router.get('/mine', auth, async (req, res) => {
  try {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM bookings WHERE user_id=?', [req.user.id]);
    const [[{ completed }]] = await pool.query("SELECT COUNT(*) as completed FROM bookings WHERE user_id=? AND status='confirmed'", [req.user.id]);
    const [[{ cancelled }]] = await pool.query("SELECT COUNT(*) as cancelled FROM bookings WHERE user_id=? AND status='cancelled'", [req.user.id]);
    const [[{ credit }]] = await pool.query('SELECT credit FROM users WHERE id=?', [req.user.id]);
    res.json({ total, completed, cancelled, credit: credit || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '查询失败' });
  }
});

// GET /api/stats/trend - 趋势数据（最近7天）
router.get('/trend', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DATE(created_at) as date, COUNT(*) as count FROM bookings WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY DATE(created_at) ORDER BY date"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '查询失败' });
  }
});

// GET /api/stats/popular-seats - 热门座位排行
router.get('/popular-seats', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT s.seat_code, s.floor, COUNT(b.id) as bookingCount FROM seats s LEFT JOIN bookings b ON s.id=b.seat_id GROUP BY s.id ORDER BY bookingCount DESC LIMIT 10"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '查询失败' });
  }
});

module.exports = router;