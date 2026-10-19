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

  // 🛑 禁止普通注册为管理员
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

// ✅ 创建管理员 —— 仅限管理员操作（新增）
router.post('/create-admin', auth, async (req, res) => {
  // 校验当前操作人是否为管理员
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可创建管理员账号' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请填写完整信息（账号、密码）' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  try {
    // 检查用户名是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: '该账号已被注册' });
    }

    // 创建管理员（角色强制为 admin，密码暂用明文）
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, password, 'admin']
    );

    res.status(201).json({
      message: '管理员创建成功',
      user: {
        id: result.insertId,
        username,
        role: 'admin'
      }
    });
  } catch (err) {
    console.error('创建管理员错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});
// ✅ 获取所有用户（仅管理员）
router.get('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可查看用户列表' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, username, role, credit, banned, created_at FROM users ORDER BY id ASC'
    );
    // 将数据库字段映射为前端需要的格式
    const users = rows.map(row => ({
      id: row.id,
      name: row.username,
      studentId: row.username,  // 这里假设 username 就是学号/工号
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

// ✅ 封禁/解封用户（仅管理员）
router.patch('/users/:id/ban', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  const userId = req.params.id;
  const { banned } = req.body; // true 封禁，false 解封
  try {
    await pool.query('UPDATE users SET banned = ? WHERE id = ?', [banned ? 1 : 0, userId]);
    res.json({ message: banned ? '已封禁' : '已解封' });
  } catch (err) {
    console.error('封禁错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ✅ 重置信用分为100（仅管理员）
router.patch('/users/:id/reset-credit', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  const userId = req.params.id;
  try {
    await pool.query('UPDATE users SET credit = 100 WHERE id = ?', [userId]);
    res.json({ message: '信用分已重置为100' });
  } catch (err) {
    console.error('重置信用分错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ✅ 批量封禁（仅管理员）
router.post('/users/batch-ban', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  const { ids } = req.body; // 数组
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请提供用户ID列表' });
  }
  try {
    await pool.query('UPDATE users SET banned = 1 WHERE id IN (?)', [ids]);
    res.json({ message: `已封禁 ${ids.length} 位用户` });
  } catch (err) {
    console.error('批量封禁错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ✅ 批量重置信用分（仅管理员）
router.post('/users/batch-reset-credit', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请提供用户ID列表' });
  }
  try {
    await pool.query('UPDATE users SET credit = 100 WHERE id IN (?)', [ids]);
    res.json({ message: `已重置 ${ids.length} 位用户信用分` });
  } catch (err) {
    console.error('批量重置信用分错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});
module.exports = router;