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

// 회원가입 폼
router.get('/register', (req, res) => {
  res.render('register');
});

// 비밀번호 검증 함수
function validatePassword(password) {
  const requirements = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };
  
  return {
    isValid: Object.values(requirements).every(req => req),
    requirements
  };
}

// 회원가입 처리
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  
  // 비밀번호 검증
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).send(`
      <script>
        alert('비밀번호가 모든 요구사항을 충족하지 않습니다.\\n\\n' +
              '• 6자리 이상\\n' +
              '• 대문자 포함\\n' +
              '• 소문자 포함\\n' +
              '• 숫자 포함\\n' +
              '• 특수문자 포함');
        history.back();
      </script>
    `);
  }
  
  try {
    const hash = await bcrypt.hash(password, 10);
    await User.create({ username, password: hash, email });
    res.redirect('/auth/login');
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).send(`
        <script>
          alert('이미 존재하는 사용자명 또는 이메일입니다.');
          history.back();
        </script>
      `);
    } else {
      res.status(500).send(`
        <script>
          alert('회원가입 중 오류가 발생했습니다.');
          history.back();
        </script>
      `);
    }
  }
});

// 로그인 폼
router.get('/login', (req, res) => {
  res.render('login');
});

// 로그인 처리
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
    return res.send('존재하지 않는 사용자입니다.');
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.send('비밀번호가 일치하지 않습니다.');
  }
  
  // 사용자 정보를 세션에 저장
  req.session.userId = user._id;
  req.session.username = user.username;
  req.session.userEmail = user.email;
  req.session.userRole = user.role;
  
  // 직원 정보에서 부서 정보 가져오기
  const Employee = require('../models/Employee');
  const employee = await Employee.findOne({ userId: user._id });
  if (employee) {
    req.session.userDepartment = employee.department;
    req.session.userName = employee.name;
    req.session.userPosition = employee.position; // 직급 정보 추가
  }
  
  // 로그인 로그 기록
  await Log.create({
    userId: user._id,
    action: 'login',
    detail: '로그인',
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  res.redirect('/employees');
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
  const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
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
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: '등록되지 않은 이메일입니다.' 
      });
    }

    // 기존 토큰 삭제
    await PasswordReset.deleteMany({ email });

    // 새로운 토큰 생성
    const resetToken = await PasswordReset.createToken(email);
    
    // 재설정 URL 생성
    const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset/${resetToken.token}`;
    
    // 이메일 전송
    await sendPasswordResetEmail(email, resetUrl);

    res.status(200).json({ 
      success: true, 
      message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.' 
    });

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
  res.render('logs', { logs });
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