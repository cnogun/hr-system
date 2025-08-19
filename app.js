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
app.use(express.json());
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
  try {
    if (req.session && req.session.userId) {
      const User = require('./models/User');
      const Employee = require('./models/Employee');
      
      // 먼저 User에서 정보 확인
      const user = await User.findById(req.session.userId);
      if (user) {
        // 관리자인 경우
        if (user.role === 'admin') {
          res.locals.position = '관리자';
          res.locals.name = user.username; // User 모델에는 name 필드가 없으므로 username 사용
          res.locals.department = '시스템 관리';
          res.locals.employeePosition = '관리자';
        } else {
          // 일반 사용자인 경우 Employee 정보 찾기
          const employee = await Employee.findOne({ userId: req.session.userId });
          if (employee) {
            res.locals.position = `${employee.department || '부서미정'} / ${employee.position || '직급미정'}`;
            res.locals.name = employee.name;
            res.locals.department = employee.department || '부서미정';
            res.locals.employeePosition = employee.position || '직급미정';
          } else {
            // 직원 정보가 없으면 User 정보 사용
            res.locals.position = '일반 사용자';
            res.locals.name = user.username;
            res.locals.department = '부서미정';
            res.locals.employeePosition = '직급미정';
          }
        }
      } else {
        // 세션에 있는 userId로 User를 찾을 수 없는 경우
        res.locals.position = '';
        res.locals.name = '';
        res.locals.department = '';
        res.locals.employeePosition = '';
        // 세션 정리
        req.session.destroy();
      }
    } else {
      res.locals.position = '';
      res.locals.name = '';
      res.locals.department = '';
      res.locals.employeePosition = '';
    }
  } catch (error) {
    console.error('세션 미들웨어 오류:', error);
    // 오류 발생 시 기본값 설정
    res.locals.position = '';
    res.locals.name = '';
    res.locals.department = '';
    res.locals.employeePosition = '';
  }
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/security', express.static(path.join(__dirname, 'uploads/security')));
app.use(express.static(path.join(__dirname, 'public')));

// 라우트 연결
const employeeRoutes = require('./routes/employees');
const authRoutes = require('./routes/auth');
const uniformRoutes = require('./routes/uniform');
const adminRoutes = require('./routes/admin');
const noticeRoutes = require('./routes/notice');
const boardRoutes = require('./routes/boards');
const securityRoutes = require('./routes/security');
const attendanceRoutes = require('./routes/attendance');
const monthlyAttendanceRoutes = require('./routes/monthlyAttendance');
const workScheduleRoutes = require('./routes/workSchedule');
app.use('/employees', employeeRoutes);
app.use('/auth', authRoutes);
app.use('/uniform', uniformRoutes);
app.use('/admin', adminRoutes);
app.use('/notice', noticeRoutes);
app.use('/boards', boardRoutes);
app.use('/security', securityRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/monthlyAttendance', monthlyAttendanceRoutes);
app.use('/workSchedule', workScheduleRoutes);

// 메인 페이지
app.get('/', (req, res) => {
  res.redirect('/notice');
});

app.get('/dashboard', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }
    
    // 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).send(`
        <script>
          alert('관리자 권한이 필요합니다.');
          history.back();
        </script>
      `);
    }
    
    const Employee = require('./models/Employee');
    const employees = await Employee.find();
    const totalEmployees = employees.length;
    
    // 부서별 인원 수 계산
    const departmentCounts = {};
    employees.forEach(emp => {
      if (emp.department) {
        departmentCounts[emp.department] = (departmentCounts[emp.department] || 0) + 1;
      }
    });
    
    // 원하는 부서 순서 정의
    const departmentOrder = [
      '보안1팀', '보안2팀', '보안3팀', 
      '관리팀', '지원팀'
    ];
    
    // 정의된 순서대로 정렬된 부서별 인원 수 객체 생성
    const orderedDepartmentCounts = {};
    departmentOrder.forEach(dept => {
      if (departmentCounts[dept]) {
        orderedDepartmentCounts[dept] = departmentCounts[dept];
      }
    });
    
    // 추가 통계 데이터
    const activeEmployees = employees.filter(emp => emp.status === '재직').length;
    const newEmployees = employees.filter(emp => {
      if (!emp.hireDate) return false;
      const hireDate = new Date(emp.hireDate);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return hireDate >= threeMonthsAgo;
    }).length;
    
    // 최근 활동 데이터 (실제 구현에서는 Log 모델에서 가져와야 함)
    const recentActivities = [
      { action: '직원 등록', description: '새 직원이 등록되었습니다.', time: '방금 전' },
      { action: '근태 업데이트', description: '근무 명령서가 업데이트되었습니다.', time: '5분 전' },
      { action: '공지사항', description: '새로운 공지사항이 등록되었습니다.', time: '10분 전' }
    ];
    
    // 헤더에 필요한 변수들 설정
    if (req.session && req.session.userId) {
      const User = require('./models/User');
      const Employee = require('./models/Employee');
      
      const user = await User.findById(req.session.userId);
      if (user) {
        if (user.role === 'admin') {
          res.locals.position = '관리자';
          res.locals.name = user.username;
          res.locals.department = '시스템 관리';
          res.locals.employeePosition = '관리자';
          res.locals.userRole = 'admin';
        } else {
          const employee = await Employee.findOne({ userId: req.session.userId });
          if (employee) {
            res.locals.position = `${employee.department || '부서미정'} / ${employee.position || '직급미정'}`;
            res.locals.name = employee.name;
            res.locals.department = employee.department || '부서미정';
            res.locals.employeePosition = employee.position || '직급미정';
            res.locals.userRole = 'user';
          } else {
            res.locals.position = '일반 사용자';
            res.locals.name = user.username;
            res.locals.department = '부서미정';
            res.locals.employeePosition = '직급미정';
            res.locals.userRole = 'user';
          }
        }
      }
    }
    
    res.render('dashboard', { 
      totalEmployees, 
      activeEmployees,
      newEmployees,
      departmentCounts: orderedDepartmentCounts,
      departments: Object.keys(orderedDepartmentCounts),
      recentActivities,
      session: req.session 
    });
    
  } catch (error) {
    console.error('대시보드 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('대시보드 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// 헬스 체크 엔드포인트 (Render/모니터링용)
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
