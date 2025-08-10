/**
 * 파일명: app.js
 * 목적: HR 관리 시스템의 메인 애플리케이션 서버
 * 기능: 
 * - Express.js 서버 설정 및 미들웨어 구성
 * - MongoDB 데이터베이스 연결
 * - 라우트 설정 및 정적 파일 서빙
 * - 세션 관리 및 보안 설정
 * - 파일 업로드 설정
 * - 포트 설정 및 서버 시작
 */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const morgan = require('morgan');
const Employee = require('./models/Employee');
const User = require('./models/User');

const app = express();

// 환경변수 설정
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
const SESSION_SECRET = process.env.SESSION_SECRET || 'hr_system_session_secret_key_2025';

// MongoDB 연결
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 에러:'));
db.once('open', () => {
  console.log('MongoDB 연결 성공!');
});

// 미들웨어 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 }, // 1시간
}));
app.use(morgan('dev'));
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    const User = require('./models/User');
    const Employee = require('./models/Employee');
    
    // 먼저 User에서 정보 확인
    const user = await User.findById(req.session.userId);
    if (user) {
      // 관리자인 경우
      if (user.role === 'admin') {
        res.locals.position = '관리자';
        res.locals.name = user.name || user.username;
        res.locals.department = '';
        res.locals.employeePosition = '';
      } else {
        // 일반 사용자인 경우 Employee 정보 찾기
        const employee = await Employee.findOne({ userId: req.session.userId });
        if (employee) {
          res.locals.position = `${employee.department} / ${employee.position}`;
          res.locals.name = employee.name;
          res.locals.department = employee.department;
          res.locals.employeePosition = employee.position;
        } else {
          // 직원 정보가 없으면 User 정보 사용
          res.locals.position = '일반 사용자';
          res.locals.name = user.name || user.username;
          res.locals.department = '';
          res.locals.employeePosition = '';
        }
      }
    } else {
      res.locals.position = '';
      res.locals.name = '';
      res.locals.department = '';
      res.locals.employeePosition = '';
    }
  } else {
    res.locals.position = '';
    res.locals.name = '';
    res.locals.department = '';
    res.locals.employeePosition = '';
  }
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 라우트 연결
const employeeRoutes = require('./routes/employees');
const authRoutes = require('./routes/auth');
const uniformRoutes = require('./routes/uniform');
const adminRoutes = require('./routes/admin');
const noticeRoutes = require('./routes/notice');
const boardRoutes = require('./routes/boards');
app.use('/employees', employeeRoutes);
app.use('/auth', authRoutes);
app.use('/uniform', uniformRoutes);
app.use('/admin', adminRoutes);
app.use('/notice', noticeRoutes);
app.use('/boards', boardRoutes);

// 메인 페이지
app.get('/', (req, res) => {
  res.redirect('/notice');
});

app.get('/dashboard', async (req, res) => {
  const Employee = require('./models/Employee');
  const employees = await Employee.find();
  const totalEmployees = employees.length;
  const departmentCounts = {};
  employees.forEach(emp => {
    departmentCounts[emp.department] = (departmentCounts[emp.department] || 0) + 1;
  });
  res.render('dashboard', { totalEmployees, departmentCounts, session: req.session });
});

// 헬스 체크 엔드포인트 (Render/모니터링용)
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
