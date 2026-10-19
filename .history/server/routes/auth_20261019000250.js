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

// ✅ 注册接口 —— 不需要 auth 中间件
router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  // 基本校验
  if (!username || !password || !role) {
    return res.status(400).json({ error: '请填写完整信息（学号/账号、密码、角色）' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  // 🛑 新增：禁止普通注册为管理员
  if (role === 'admin') {
    return res.status(403).json({ error: '管理员账号仅由系统预设，无法自行注册' });
  }

  try {
    // 检查用户名是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: '该学号/账号已被注册' });
    }

    // 插入新用户（密码暂用明文，后续可改为 bcrypt 加密）
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, password, role]
    );

    // 注册成功后自动生成 Token 并返回（让用户直接登录）
    const token = jwt.sign(
      { id: result.insertId, username, role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: result.insertId,
        username,
        role
      }
    });

  } catch (err) {
    console.error('注册错误:', err);
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