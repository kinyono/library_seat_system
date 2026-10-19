const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ✅ 登录接口 —— 不需要 auth 中间件
router.post('/login', async (req, res) => {
  const { username, password, role } = req.body;
  
  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND role = ?',
      [username, role]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '账号不存在或角色选择错误' });
    }

    const user = users[0];

    // 临时明文密码对比（后续可改为 bcrypt.compare）
    if (password !== user.password) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 生成 JWT Token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ✅ 获取当前用户信息 —— 需要 auth 中间件保护
router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, role FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(users[0]);
  } catch (err) {
    console.error('获取用户信息错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;