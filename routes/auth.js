/**
 * 파일명: auth.js
 * 목적: 사용자 인증 관련 라우트 처리
 * 기능:
 * - 로그인/로그아웃 처리
 * - 회원가입 및 계정 생성
 * - 비밀번호 찾기 및 재설정
 * - 세션 관리
 * - 이메일 인증 및 토큰 관리
 * - 보안 미들웨어 적용
 */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Log = require('../models/Log');
const Employee = require('../models/Employee');

// 회원가입 폼
router.get('/register', (req, res) => {
  res.render('register');
});

// 비밀번호 검증 함수
function validatePassword(password) {
  if (typeof password !== 'string') return { isValid: false, requirements: {} };
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  
  return {
    isValid: Object.values(requirements).every(req => req),
    requirements
  };
}

// 회원가입 처리
router.post('/register', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { password, confirmPassword } = req.body;
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) {
    return res.status(400).json({ success: false, message: '아이디는 영문·숫자·점·밑줄·하이픈을 사용해 3~30자로 입력해 주세요.' });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: '올바른 이메일을 입력해 주세요.' });
  }
  if (typeof password !== 'string' || !validatePassword(password).isValid) {
    return res.status(400).json({ success: false, message: '비밀번호는 8자 이상이며 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: '비밀번호 확인이 일치하지 않습니다.' });
  }

  try {
    const existing = await User.findOne({ $or: [
      { username },
      { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    ] });
    if (existing) {
      return res.status(409).json({ success: false, message: '이미 사용 중인 아이디 또는 이메일입니다.' });
    }
    const hash = await bcrypt.hash(password, 10);
    await User.create({ username, password: hash, email, role: 'user' });
    res.status(201).json({ success: true, message: '계정이 생성되었습니다. 관리자가 직원 정보에 연결하면 로그인할 수 있습니다.' });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({ success: false, message: '이미 사용 중인 아이디 또는 이메일입니다.' });
    } else {
      console.error('회원가입 처리 오류:', error);
      res.status(500).json({ success: false, message: '회원가입 중 오류가 발생했습니다.' });
    }
  }
});

// 로그인 폼
router.get('/login', (req, res) => {
  res.render('login', { message: req.query.registered === '1'
    ? '계정이 생성되었습니다. 관리자가 직원 정보에 연결하면 로그인할 수 있습니다.'
    : req.query.pending === '1' ? '직원 정보와 연결되지 않은 계정은 관리자의 등록 후 로그인할 수 있습니다.' : null });
});

// 로그인 처리
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 입력값 검증
    if (!username || !password) {
      return res.status(400).send(`
        <script>
          alert('사용자명과 비밀번호를 모두 입력해주세요.');
          history.back();
        </script>
      `);
    }
    
    // 사용자 찾기
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send(`
        <script>
          alert('존재하지 않는 사용자입니다.');
          history.back();
        </script>
      `);
    }
    
    // 비밀번호 확인
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send(`
        <script>
          alert('비밀번호가 일치하지 않습니다.');
          history.back();
        </script>
      `);
    }
    
    // 직원 정보에 연결되기 전에는 업무 데이터 접근을 허용하지 않습니다.
    let employee = null;
    if (user.role !== 'admin') {
      employee = await Employee.findOne({ userId: user._id });
      if (!employee) {
        return res.status(403).render('login', { message: '관리자가 직원 정보에 계정을 연결한 뒤 로그인할 수 있습니다.' });
      }
    }

    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    // 사용자 정보를 세션에 저장
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;
    
    // 직원 정보에서 부서 정보 가져오기 (관리자가 아닌 경우에만)
    if (employee) {
      req.session.userDepartment = employee.department;
      req.session.userName = employee.name;
      req.session.userPosition = employee.position;
    }
    
    // 로그인 로그 기록
    try {
      await Log.create({
        userId: user._id,
        action: 'login',
        detail: '로그인',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (logError) {
      console.error('로그인 로그 기록 실패:', logError);
      // 로그 기록 실패는 로그인을 막지 않음
    }
    
    // 관리자는 운영 대시보드로, 일반 직원은 본인 화면으로 이동
    if (user.role === 'admin') {
      res.redirect('/dashboard');
    } else {
      res.redirect('/my');
    }
    
  } catch (error) {
    console.error('로그인 처리 오류:', error);
    res.status(500).render('login', { message: '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

// 로그아웃
router.get('/logout', (req, res) => {
  if (req.session.userId) {
    Log.create({
      userId: req.session.userId,
      action: 'logout',
      detail: '로그아웃',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

// 비밀번호 찾기 폼
router.get('/forgot', (req, res) => {
  res.render('forgotPassword');
});

// 이메일 전송 함수
async function sendPasswordResetEmail(email, resetUrl) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: '비밀번호 재설정 안내',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">비밀번호 재설정</h2>
        <p>안녕하세요,</p>
        <p>비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새로운 비밀번호를 설정해주세요.</p>
        <p style="margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            비밀번호 재설정
          </a>
        </p>
        <p>이 링크는 1시간 후에 만료됩니다.</p>
        <p>본인이 요청하지 않았다면 이 이메일을 무시하셔도 됩니다.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.
        </p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

// 비밀번호 찾기 처리
router.post('/forgot', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ success: false, message: '올바른 이메일 주소를 입력해 주세요.' });
    }
    const response = { success: true, message: '등록된 이메일이라면 비밀번호 재설정 링크를 보내드립니다.' };
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json(response);

    const baseUrl = process.env.APP_BASE_URL || (process.env.NODE_ENV === 'production' ? '' : `http://localhost:${process.env.PORT || 10000}`);
    if (!/^https?:\/\/[^/]+$/i.test(baseUrl) || (process.env.NODE_ENV === 'production' && !baseUrl.startsWith('https://'))) {
      throw new Error('APP_BASE_URL 설정이 필요합니다.');
    }

    // 기존 토큰 삭제
    await PasswordReset.deleteMany({ email });

    // 새로운 토큰 생성
    const resetToken = await PasswordReset.createToken(email);
    
    // 재설정 URL 생성
    const resetUrl = `${baseUrl}/auth/reset/${resetToken.token}`;
    
    // 이메일 전송
    await sendPasswordResetEmail(email, resetUrl);

    res.status(200).json(response);

  } catch (error) {
    console.error('비밀번호 찾기 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '이메일 전송 중 오류가 발생했습니다.' 
    });
  }
});

// 비밀번호 재설정 페이지
router.get('/reset/:token', async (req, res) => {
  res.set('Referrer-Policy', 'no-referrer');
  try {
    const { token } = req.params;
    const resetToken = await PasswordReset.verifyToken(token);
    
    if (!resetToken) {
      return res.render('resetPassword', { 
        error: '유효하지 않거나 만료된 링크입니다.',
        token: null 
      });
    }
    
    res.render('resetPassword', { 
      error: null, 
      token: token 
    });
    
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.render('resetPassword', { 
      error: '오류가 발생했습니다.',
      token: null 
    });
  }
});

// 비밀번호 재설정 처리
router.post('/reset/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    
    // 비밀번호 확인
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '비밀번호가 일치하지 않습니다.' 
      });
    }
    
    // 비밀번호 유효성 검사
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        success: false, 
        message: '비밀번호가 모든 요구사항을 충족하지 않습니다.' 
      });
    }
    
    // 토큰 검증
    const resetToken = await PasswordReset.verifyToken(token);
    if (!resetToken) {
      return res.status(400).json({ 
        success: false, 
        message: '유효하지 않거나 만료된 링크입니다.' 
      });
    }
    
    // 사용자 찾기
    const user = await User.findOne({ email: resetToken.email });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자를 찾을 수 없습니다.' 
      });
    }
    
    // 비밀번호 업데이트
    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
    await user.save();
    
    // 토큰 사용 처리
    resetToken.used = true;
    await resetToken.save();
    
    res.status(200).json({ 
      success: true, 
      message: '비밀번호가 성공적으로 변경되었습니다.' 
    });
    
  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '비밀번호 재설정 중 오류가 발생했습니다.' 
    });
  }
});

// 로그인 정보 확인
router.get('/info', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const User = require('../models/User');
  const user = await User.findById(req.session.userId);
  res.render('loginInfo', { user });
});

// 로그인 정보 엑셀 다운로드
router.get('/info/excel', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const User = require('../models/User');
  const user = await User.findById(req.session.userId);
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('로그인정보');
  sheet.columns = [
    { header: '이름', key: 'name', width: 20 },
    { header: '이메일', key: 'email', width: 30 },
    { header: '권한', key: 'role', width: 10 },
    { header: '아이디', key: '_id', width: 30 }
  ];
  sheet.addRow({ name: user.name, email: user.email, role: user.role, _id: user._id });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=login_info.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

// 활동 로그 확인 (관리자만)
router.get('/logs', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const User = require('../models/User');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  const Log = require('../models/Log');
  const logs = await Log.find().sort({ createdAt: -1 }).limit(100).populate('userId', 'username email role');
  res.render('activityLogs', { 
    logs,
    session: req.session,
    position: user.position || '관리자'
  });
});
// 활동 로그 API (AJAX용)
router.get('/logs/api', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    const User = require('../models/User');
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, error: '관리자만 접근 가능합니다.' });
    
    const Log = require('../models/Log');
    const { page = 1, limit = 20, startDate, endDate, userId, activityType } = req.query;
    
    // 필터 조건 구성
    let filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
    if (userId) filter.userId = userId;
    if (activityType) filter.action = activityType;
    
    const skip = (page - 1) * limit;
    const logs = await Log.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username email role');
    
    const totalLogs = await Log.countDocuments(filter);
    const totalPages = Math.ceil(totalLogs / limit);
    
    // 통계 계산
    const stats = {
      totalLogs,
      totalUsers: await Log.distinct('userId').length,
      todayLogs: await Log.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      })
    };
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLogs,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        stats
      }
    });
  } catch (error) {
    console.error('활동 로그 API 오류:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 목록 API (활동로그 필터용)
router.get('/users', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    const User = require('../models/User');
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, error: '관리자만 접근 가능합니다.' });
    
    const users = await User.find({}, 'username email role position').sort({ username: 1 });
    res.json({
      success: true,
      data: users.map(u => ({
        userId: u._id,
        name: u.username,
        email: u.email,
        role: u.role,
        position: u.position
      }))
    });
  } catch (error) {
    console.error('사용자 목록 API 오류:', error);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
});

// 활동 로그 엑셀 다운로드
router.get('/logs/excel', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const User = require('../models/User');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  const Log = require('../models/Log');
  const logs = await Log.find().sort({ createdAt: -1 }).limit(100).populate('userId', 'username email role');
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('활동로그');
  sheet.columns = [
    { header: '일시', key: 'createdAt', width: 20 },
    { header: '사용자', key: 'username', width: 20 },
    { header: '이메일', key: 'email', width: 25 },
    { header: '권한', key: 'role', width: 10 },
    { header: '액션', key: 'action', width: 12 },
    { header: '상세', key: 'detail', width: 30 },
    { header: 'IP', key: 'ip', width: 16 },
    { header: 'UserAgent', key: 'userAgent', width: 30 }
  ];
  logs.forEach(log => {
    sheet.addRow({
      createdAt: log.createdAt.toISOString().replace('T',' ').slice(0,19),
      username: log.userId?.username || '-',
      email: log.userId?.email || '-',
      role: log.userId?.role || '-',
      action: log.action,
      detail: log.detail,
      ip: log.ip,
      userAgent: log.userAgent
    });
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=activity_logs.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
