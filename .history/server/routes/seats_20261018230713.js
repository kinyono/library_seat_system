const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const auth = require('../../middleware/auth');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// GET /api/seats - 查询所有座位
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM seats ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '查询座位失败' });
  }
});

// PUT /api/seats/:id/status - 管理员修改座位状态
router.put('/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  const { status } = req.body;
  const allowedStatus = ['free', 'occupied', 'maintenance'];
  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }
  try {
    const [result] = await pool.query('UPDATE seats SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: '座位不存在' });
    res.json({ message: '状态更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新失败' });
  }
});

module.exports = router;