const express = require('express');
const router = express.Router();
const pool = require('../db');

// 获取所有用户（仅管理员）
router.get('/', async (req, res) => {
  // 注意：此处应加入管理员身份验证，简化起见省略，生产环境务必加上
  try {
    const [rows] = await pool.query(
      'SELECT id, username, role, credit, banned, created_at FROM users ORDER BY id ASC'
    );
    const users = rows.map(row => ({
      id: row.id,
      name: row.username,
      studentId: row.username,
      credit: row.credit ?? 100,
      banned: row.banned === 1,
      role: row.role
    }));
    res.json(users);
  } catch (err) {
    console.error('获取用户列表错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 封禁/解封用户
router.patch('/:id/ban', async (req, res) => {
  const userId = req.params.id;
  const { banned } = req.body;
  try {
    await pool.query('UPDATE users SET banned = ? WHERE id = ?', [banned ? 1 : 0, userId]);
    res.json({ message: banned ? '已封禁' : '已解封' });
  } catch (err) {
    res.status(500).json({ error: '操作失败' });
  }
});

// 重置信用分
router.patch('/:id/reset-credit', async (req, res) => {
  const userId = req.params.id;
  try {
    await pool.query('UPDATE users SET credit = 100 WHERE id = ?', [userId]);
    res.json({ message: '信用分已重置为100' });
  } catch (err) {
    res.status(500).json({ error: '操作失败' });
  }
});

// 批量封禁
router.post('/batch-ban', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '参数错误' });
  try {
    await pool.query('UPDATE users SET banned = 1 WHERE id IN (?)', [ids]);
    res.json({ message: `已封禁 ${ids.length} 位用户` });
  } catch (err) {
    res.status(500).json({ error: '操作失败' });
  }
});

// 批量重置信用分
router.post('/batch-reset-credit', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '参数错误' });
  try {
    await pool.query('UPDATE users SET credit = 100 WHERE id IN (?)', [ids]);
    res.json({ message: `已重置 ${ids.length} 位用户信用分` });
  } catch (err) {
    res.status(500).json({ error: '操作失败' });
  }
});

module.exports = router;