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

// 프로세스 에러 핸들링 (Render 프로덕션 환경용)
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const express = require('express');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const morgan = require('morgan');
const Employee = require('./models/Employee');
const User = require('./models/User');
const Log = require('./models/Log');

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
          res.locals.userRole = 'admin'; // userRole 설정 추가
          req.session.userRole = 'admin'; // 세션에도 userRole 저장
        } else {
          // 일반 사용자인 경우 Employee 정보 찾기
          const employee = await Employee.findOne({ userId: req.session.userId });
          if (employee) {
            res.locals.position = `${employee.department || '부서미정'} / ${employee.position || '직급미정'}`;
            res.locals.name = employee.name;
            res.locals.department = employee.department || '부서미정';
            res.locals.employeePosition = employee.position || '직급미정';
            res.locals.userRole = 'user'; // userRole 설정 추가
            req.session.userRole = 'user'; // 세션에도 userRole 저장
          } else {
            // 직원 정보가 없으면 User 정보 사용
            res.locals.position = '일반 사용자';
            res.locals.name = user.username;
            res.locals.department = '부서미정';
            res.locals.employeePosition = '직급미정';
            res.locals.userRole = 'user'; // userRole 설정 추가
            req.session.userRole = 'user'; // 세션에도 userRole 저장
          }
        }
      } else {
        // 세션에 있는 userId로 User를 찾을 수 없는 경우
        res.locals.position = '';
        res.locals.name = '';
        res.locals.department = '';
        res.locals.employeePosition = '';
        res.locals.userRole = ''; // userRole 초기화
        // 세션 정리
        req.session.destroy();
      }
    } else {
      res.locals.position = '';
      res.locals.name = '';
      res.locals.department = '';
      res.locals.employeePosition = '';
      res.locals.userRole = ''; // userRole 초기화
    }
  } catch (error) {
    console.error('세션 미들웨어 오류:', error);
    // 오류 발생 시 기본값 설정
    res.locals.position = '';
    res.locals.name = '';
    res.locals.department = '';
    res.locals.employeePosition = '';
    res.locals.userRole = ''; // userRole 초기화
  }
  next();
});
// 정적 파일 미들웨어 설정 (에러 핸들링 포함)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), (err, req, res, next) => {
  if (err) {
    console.error('Uploads 정적 파일 에러:', err);
    next();
  }
}));

app.use('/uploads/security', express.static(path.join(__dirname, 'uploads/security'), (err, req, res, next) => {
  if (err) {
    console.error('Security uploads 정적 파일 에러:', err);
    next();
  }
}));

app.use(express.static(path.join(__dirname, 'public'), (err, req, res, next) => {
  if (err) {
    console.error('Public 정적 파일 에러:', err);
    next();
  }
}));

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


app.use('/employees', employeeRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/notice', noticeRoutes);
app.use('/boards', boardRoutes);
app.use('/security', securityRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/monthlyAttendance', monthlyAttendanceRoutes);
// WorkSchedule 라우트 (EJS 템플릿 사용)
app.get('/workSchedule', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }
    
    // EJS 템플릿 렌더링
    res.render('WorkSchedule', { 
      session: req.session,
      name: req.session.name || '사용자',
      position: req.session.position || '직급미정',
      department: req.session.department || '부서미정'
    });
    
  } catch (error) {
    console.error('WorkSchedule 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('WorkSchedule 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// WorkSchedule API 엔드포인트들
const WorkSchedule = require('./models/WorkSchedule');

// 현재 주차 정보 조회
app.get('/workSchedule/current-week', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const today = new Date();
    
    // 현재 날짜가 속한 주의 월요일을 주차 시작일로 설정
    const currentDayOfWeek = today.getDay();
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    
    const weekStartDate = new Date(today);
    weekStartDate.setDate(today.getDate() - daysToMonday);
    weekStartDate.setHours(0, 0, 0, 0);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);
    
    console.log('주차 계산 정보:', {
      today: today.toLocaleDateString(),
      currentDayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][currentDayOfWeek],
      daysToMonday,
      weekStartDate: weekStartDate.toLocaleDateString(),
      weekEndDate: weekEndDate.toLocaleDateString()
    });
    
    // 현재 주차의 스케줄 조회
    let schedule = await WorkSchedule.findOne({
      weekStartDate: { $lte: weekEndDate },
      weekEndDate: { $gte: weekStartDate }
    });
    
    if (!schedule) {
      // 스케줄이 없으면 기본 정보만 반환
      const weekNumber = Math.ceil((today.getDate() + new Date(today.getFullYear(), 0, 1).getDay()) / 7);
      schedule = {
        weekNumber,
        weekStartDate,
        weekEndDate,
        weekendSchedule: {}
      };
    }
    
    res.json({ success: true, data: schedule });
    
  } catch (error) {
    console.error('현재 주차 정보 조회 오류:', error);
    res.status(500).json({ error: '현재 주차 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

// 이번주 스케줄 생성
app.post('/workSchedule/create-current-week', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const today = new Date();
    
    // 한국 시간대 기준으로 월요일을 주차 시작일로 설정
    const currentDayOfWeek = today.getDay();
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    
    const weekStartDate = new Date(today);
    weekStartDate.setDate(today.getDate() - daysToMonday);
    weekStartDate.setHours(0, 0, 0, 0);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);
    
    // 이미 존재하는지 확인
    const existingSchedule = await WorkSchedule.findOne({
      weekStartDate: { $lte: weekEndDate },
      weekEndDate: { $gte: weekStartDate }
    });
    
    if (existingSchedule) {
      return res.json({ success: false, message: '이미 이번주 스케줄이 존재합니다.' });
    }
    
    // 새 스케줄 생성
    const newSchedule = new WorkSchedule({
      weekStartDate,
      weekEndDate,
      weekNumber: Math.ceil((today.getDate() + new Date(today.getFullYear(), 0, 1).getDay()) / 7),
      currentWeekSchedule: {
        team1: '출근(초)',
        team2: '출근(심)',
        team3: '출근(주)'
      },
      createdBy: req.session.userId,
      weekendSchedule: {}
    });
    
    await newSchedule.save();
    
    res.json({ success: true, message: '이번주 스케줄이 생성되었습니다.' });
    
  } catch (error) {
    console.error('스케줄 생성 오류:', error);
    res.status(500).json({ error: '스케줄 생성 중 오류가 발생했습니다.' });
  }
});

// 주말 스케줄 저장
app.post('/workSchedule/save-weekend', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const { team1, team2, team3 } = req.body;
    
    const today = new Date();
    
    // 한국 시간대 기준으로 월요일을 주차 시작일로 설정
    const currentDayOfWeek = today.getDay();
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    
    const weekStartDate = new Date(today);
    weekStartDate.setDate(today.getDate() - daysToMonday);
    weekStartDate.setHours(0, 0, 0, 0);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);
    
    // 기존 스케줄 업데이트 또는 새로 생성
    let schedule = await WorkSchedule.findOne({
      weekStartDate: { $lte: weekEndDate },
      weekEndDate: { $gte: weekStartDate }
    });
    
    if (!schedule) {
      schedule = new WorkSchedule({
        weekStartDate,
        weekEndDate,
        weekNumber: Math.ceil((today.getDate() + new Date(today.getFullYear(), 0, 1).getDay()) / 7),
        currentWeekSchedule: {
          team1: '출근(초)',
          team2: '출근(심)',
          team3: '출근(주)'
        },
        createdBy: req.session.userId
      });
    } else {
      // 기존 스케줄이 있지만 필수 필드가 없는 경우 기존 스케줄 삭제 후 새로 생성
      if (!schedule.currentWeekSchedule || !schedule.currentWeekSchedule.team1 || 
          !schedule.currentWeekSchedule.team2 || !schedule.currentWeekSchedule.team3 || 
          !schedule.createdBy) {
        
        // 기존 스케줄 삭제
        await WorkSchedule.findByIdAndDelete(schedule._id);
        
        // 새로 생성
        schedule = new WorkSchedule({
          weekStartDate,
          weekEndDate,
          weekNumber: Math.ceil((today.getDate() + new Date(today.getFullYear(), 0, 1).getDay()) / 7),
          currentWeekSchedule: {
            team1: '출근(초)',
            team2: '출근(심)',
            team3: '출근(주)'
          },
          createdBy: req.session.userId
        });
      }
    }
    
    schedule.weekendSchedule = { team1, team2, team3 };
    await schedule.save();
    
    res.json({ success: true, message: '주말 스케줄이 저장되었습니다.' });
    
  } catch (error) {
    console.error('주말 스케줄 저장 오류:', error);
    res.status(500).json({ error: '주말 스케줄 저장 중 오류가 발생했습니다.' });
  }
});

// 팀별 인원 자동 생성
app.post('/workSchedule/generate-personnel/:team', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const { team } = req.params;
    
    // 해당 팀의 직원들 조회
    const employees = await Employee.find({ 
      department: `보안${team.replace('team', '')}팀` 
    }).limit(40);
    
    if (employees.length === 0) {
      return res.json({ success: false, message: '해당 팀의 직원이 없습니다.' });
    }
    
    // 조별로 분배
    const aGroup = employees.slice(0, 20).map(emp => emp.name).join('\n');
    const bGroup = employees.slice(20, 40).map(emp => emp.name).join('\n');
    const group1 = employees.slice(0, 10).map(emp => emp.name).join('\n');
    const group2 = employees.slice(10, 20).map(emp => emp.name).join('\n');
    const group3 = employees.slice(20, 30).map(emp => emp.name).join('\n');
    const group4 = employees.slice(30, 40).map(emp => emp.name).join('\n');
    
    res.json({
      success: true,
      data: { aGroup, bGroup, group1, group2, group3, group4 }
    });
    
  } catch (error) {
    console.error('팀별 인원 생성 오류:', error);
    res.status(500).json({ error: '팀별 인원 생성 중 오류가 발생했습니다.' });
  }
});

// 전체 팀 인원 자동 생성
app.post('/workSchedule/generate-all-teams', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const result = {};
    
    // 각 팀별로 인원 생성
    for (let i = 1; i <= 3; i++) {
      const employees = await Employee.find({ 
        department: `보안${i}팀` 
      }).limit(40);
      
      if (employees.length > 0) {
        result[`team${i}`] = {
          aGroup: employees.slice(0, 20).map(emp => emp.name).join('\n'),
          bGroup: employees.slice(20, 40).map(emp => emp.name).join('\n'),
          group1: employees.slice(0, 10).map(emp => emp.name).join('\n'),
          group2: employees.slice(10, 20).map(emp => emp.name).join('\n'),
          group3: employees.slice(20, 30).map(emp => emp.name).join('\n'),
          group4: employees.slice(30, 40).map(emp => emp.name).join('\n')
        };
      }
    }
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('전체 팀 인원 생성 오류:', error);
    res.status(500).json({ error: '전체 팀 인원 생성 중 오류가 발생했습니다.' });
  }
});

// 공휴일 추가
app.post('/workSchedule/add-holiday', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const { date, name, specialWorkType } = req.body;
    console.log('공휴일 추가 요청:', { date, name, specialWorkType, userId: req.session.userId });
    
    const today = new Date();
    
    // 한국 시간대 기준으로 월요일을 주차 시작일로 설정
    const currentDayOfWeek = today.getDay();
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    
    const weekStartDate = new Date(today);
    weekStartDate.setDate(today.getDate() - daysToMonday);
    weekStartDate.setHours(0, 0, 0, 0);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);
    
    console.log('주차 정보:', { weekStartDate, weekEndDate, date });
    
    // 해당 주차의 스케줄 찾기
    let schedule = await WorkSchedule.findOne({
      weekStartDate: { $lte: new Date(date) },
      weekEndDate: { $gte: new Date(date) }
    });
    
    console.log('기존 스케줄 조회 결과:', schedule ? '있음' : '없음');
    
    if (!schedule) {
      console.log('새로운 스케줄 생성 시작');
      // 해당 주차가 없으면 새로 생성
      schedule = new WorkSchedule({
        weekStartDate,
        weekEndDate,
        weekNumber: Math.ceil((new Date(date).getDate() + new Date(new Date(date).getFullYear(), 0, 1).getDay()) / 7),
        currentWeekSchedule: {
          team1: '출근(초)',
          team2: '출근(심)',
          team3: '출근(주)'
        },
        createdBy: req.session.userId
      });
      console.log('새로운 스케줄 객체 생성됨:', schedule);
    } else {
      console.log('기존 스케줄 필수 필드 확인:', {
        hasCurrentWeekSchedule: !!schedule.currentWeekSchedule,
        hasTeam1: !!schedule.currentWeekSchedule?.team1,
        hasTeam2: !!schedule.currentWeekSchedule?.team2,
        hasTeam3: !!schedule.currentWeekSchedule?.team3,
        hasCreatedBy: !!schedule.createdBy
      });
      
      // 기존 스케줄이 있지만 필수 필드가 없는 경우 기존 스케줄 삭제 후 새로 생성
      if (!schedule.currentWeekSchedule || !schedule.currentWeekSchedule.team1 || 
          !schedule.currentWeekSchedule.team2 || !schedule.currentWeekSchedule.team3 || 
          !schedule.createdBy) {
        
        console.log('기존 스케줄 필수 필드 누락, 삭제 후 재생성 시작');
        // 기존 스케줄 삭제
        await WorkSchedule.findByIdAndDelete(schedule._id);
        console.log('기존 스케줄 삭제 완료');
        
        // 새로 생성
        schedule = new WorkSchedule({
          weekStartDate,
          weekEndDate,
          weekNumber: Math.ceil((new Date(date).getDate() + new Date(new Date(date).getFullYear(), 0, 1).getDay()) / 7),
          currentWeekSchedule: {
            team1: '출근(초)',
            team2: '출근(심)',
            team3: '출근(주)'
          },
          createdBy: req.session.userId
        });
        console.log('재생성된 스케줄 객체:', schedule);
      }
    }
    
    // 공휴일 정보 추가
    if (!schedule.holidays) schedule.holidays = [];
    
    // 주말 여부 확인 (토요일=6, 일요일=0)
    const holidayDate = new Date(date);
    const dayOfWeek = holidayDate.getDay();
    const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6;
    
    const newHoliday = { 
      date: new Date(date), 
      name, 
      isWeekday,
      specialWorkType 
    };
    
    schedule.holidays.push(newHoliday);
    console.log('공휴일 정보 추가됨:', newHoliday);
    console.log('저장 전 스케줄 상태:', {
      holidaysCount: schedule.holidays.length,
      hasRequiredFields: !!schedule.currentWeekSchedule?.team1 && !!schedule.currentWeekSchedule?.team2 && !!schedule.currentWeekSchedule?.team3 && !!schedule.createdBy
    });
    
    await schedule.save();
    console.log('공휴일 저장 완료!');
    
    res.json({ success: true, message: '공휴일이 추가되었습니다.' });
    
  } catch (error) {
    console.error('공휴일 추가 오류:', error);
    res.status(500).json({ error: '공휴일 추가 중 오류가 발생했습니다.' });
  }
});

// 공휴일 목록 조회
app.get('/workSchedule/holidays', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    // 캐시 방지 헤더 설정
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // 모든 주차의 공휴일을 조회
    const allSchedules = await WorkSchedule.find({
      holidays: { $exists: true, $ne: [] }
    });

    let allHolidays = [];
    
    // 각 주차의 공휴일을 하나의 배열로 합치기
    allSchedules.forEach(schedule => {
      if (schedule.holidays && schedule.holidays.length > 0) {
        allHolidays = allHolidays.concat(schedule.holidays);
      }
    });

    // 날짜순으로 정렬
    allHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`공휴일 목록 조회 완료: ${allHolidays.length}개`);

    res.json({ success: true, data: allHolidays });
    
  } catch (error) {
    console.error('공휴일 목록 조회 오류:', error);
    res.status(500).json({ error: '공휴일 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// 공휴일 삭제
app.delete('/workSchedule/holidays/:holidayId', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const { holidayId } = req.params;
    
    // 모든 주차에서 해당 공휴일 검색
    const allSchedules = await WorkSchedule.find({
      holidays: { $exists: true, $ne: [] }
    });

    let foundSchedule = null;
    let foundHolidayIndex = -1;

    // 각 주차에서 공휴일 검색
    for (const schedule of allSchedules) {
      if (schedule.holidays && schedule.holidays.length > 0) {
        const holidayIndex = schedule.holidays.findIndex(h => h._id && h._id.toString() === holidayId);
        if (holidayIndex !== -1) {
          foundSchedule = schedule;
          foundHolidayIndex = holidayIndex;
          break;
        }
      }
    }

    if (!foundSchedule) {
      return res.status(404).json({ error: '해당 공휴일을 찾을 수 없습니다.' });
    }

    // 공휴일 삭제
    foundSchedule.holidays.splice(foundHolidayIndex, 1);
    await foundSchedule.save();

    console.log(`공휴일 삭제 완료: ${holidayId}`);

    res.json({ success: true, message: '공휴일이 삭제되었습니다.' });
    
  } catch (error) {
    console.error('공휴일 삭제 오류:', error);
    res.status(500).json({ error: '공휴일 삭제 중 오류가 발생했습니다.' });
  }
});



// 주차별 스케줄 목록
app.get('/workSchedule/weekly-schedules', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    console.log('주차별 스케줄 조회 시작');
    // 현재 날짜 기준으로 미래 주차만 조회
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // 시간을 00:00:00으로 설정
    
    const schedules = await WorkSchedule.find({
      weekStartDate: { $gte: currentDate } // 현재 날짜 이후의 주차만 조회
    })
      .sort({ weekStartDate: 1 }) // 날짜순으로 정렬 (과거→미래)
      .limit(15); // 최대 15주까지 조회
    
    console.log('데이터베이스에서 조회된 스케줄 수:', schedules.length);
    schedules.forEach((schedule, index) => {
      console.log(`스케줄 ${index + 1}:`, {
        id: schedule._id,
        weekStart: schedule.weekStartDate,
        weekEnd: schedule.weekEndDate
      });
    });
    
    const formattedSchedules = schedules.map(schedule => {
      const weekStart = schedule.weekStartDate;
      const weekEnd = schedule.weekEndDate;
      
      // 현재 주차인지 확인 (월~일 기준)
      const now = new Date();
      const nowDayOfWeek = now.getDay();
      const nowDaysToMonday = nowDayOfWeek === 0 ? 6 : nowDayOfWeek - 1; // 월요일로 맞춤
      const nowWeekStart = new Date(now);
      nowWeekStart.setDate(now.getDate() - nowDaysToMonday);
      nowWeekStart.setHours(0, 0, 0, 0);
      
      // 주차 시작일이 현재 주차 시작일과 일치하는지 확인
      const isCurrentWeek = weekStart.getTime() === nowWeekStart.getTime();
      
      // 주차 번호 계산 (현재 주차를 기준으로, 월~일 기준)
      // weekStart가 nowWeekStart와 얼마나 차이나는지 계산
      const weekDiff = Math.floor((weekStart - nowWeekStart) / (7 * 24 * 60 * 60 * 1000));
      
      // 디버깅 로그 추가
      console.log('주차 라벨링 계산:', {
        scheduleWeekStart: weekStart.toLocaleDateString(),
        nowWeekStart: nowWeekStart.toLocaleDateString(),
        weekDiff,
        isCurrentWeek,
        now: now.toLocaleDateString(),
        nowDayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][nowDayOfWeek]
      });
      
      let weekLabel;
      if (weekDiff === 0) {
        weekLabel = `이번주 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 1) {
        weekLabel = `다음주 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 2) {
        weekLabel = `2주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 3) {
        weekLabel = `3주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 4) {
        weekLabel = `4주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 5) {
        weekLabel = `5주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 6) {
        weekLabel = `6주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 7) {
        weekLabel = `7주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 8) {
        weekLabel = `8주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 9) {
        weekLabel = `9주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 10) {
        weekLabel = `10주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 11) {
        weekLabel = `11주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else if (weekDiff === 12) {
        weekLabel = `12주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      } else {
        weekLabel = `${weekDiff}주 후 (${weekStart.toLocaleDateString()} ~ ${weekEnd.toLocaleDateString()})`;
      }
      
      return {
        id: schedule._id,
        weekStart: schedule.weekStartDate,
        weekEnd: schedule.weekEndDate,
        weekLabel: weekLabel,
        weekDiff: weekDiff,
        isCurrentWeek: isCurrentWeek
      };
    });
    
    console.log('포맷된 스케줄:', formattedSchedules);
    res.json({ success: true, data: formattedSchedules });
    
  } catch (error) {
    console.error('주차별 스케줄 조회 오류:', error);
    res.status(500).json({ error: '주차별 스케줄을 불러오는 중 오류가 발생했습니다.' });
  }
});

// Excel Manager 페이지 라우트
app.get('/excelManager', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).send(`
        <script>
          alert('관리자 권한이 필요합니다.');
          history.back();
        </script>
      `);
    }
    
    res.render('excelManager', { session: req.session });
  } catch (error) {
    console.error('Excel Manager 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('Excel Manager 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// Uniform Stats 페이지 라우트
app.get('/uniform/stats', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).send(`
        <script>
          alert('관리자 권한이 필요합니다.');
          history.back();
        </script>
      `);
    }
    
    res.render('uniformStats', { 
      session: req.session,
      name: req.session.name || '사용자',
      position: req.session.position || '직급미정',
      department: req.session.department || '부서미정'
    });
  } catch (error) {
    console.error('Uniform Stats 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('Uniform Stats 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// Uniform 라우트 (stats 라우트 뒤에 배치)
app.use('/uniform', uniformRoutes);

// 유니폼 통계 엑셀 다운로드 API (주문용)
app.get('/uniform/stats/excel', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: '관리자 권한이 필요합니다.' });
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('유니폼 주문 통계');

    // 직원 데이터 조회
    const employees = await Employee.find({ status: '재직' }).select('name department uniformSummerTop uniformSummerTopQty uniformSummerBottom uniformSummerBottomQty uniformWinterTop uniformWinterTopQty uniformWinterBottom uniformWinterBottomQty uniformWinterPants uniformWinterPantsQty uniformWinterCoat uniformWinterCoatQty raincoat raincoatQty cap capQty safetyShoes safetyShoesQty rainBoots rainBootsQty winterJacket winterJacketQty doubleJacket doubleJacketQty');
    
    // 유니폼 통계 계산
    const uniformStats = {
      summerTop: {}, summerBottom: {}, winterTop: {}, winterBottom: {},
      winterPants: {}, winterCoat: {}, raincoat: {}, cap: {}, safetyShoes: {}, rainBoots: {},
      winterJacket: {}, doubleJacket: {}
    };
    
    employees.forEach(emp => {
      // 유니폼 사이즈별 카운트
      if (emp.uniformSummerTop && emp.uniformSummerTopQty) {
        uniformStats.summerTop[emp.uniformSummerTop] = (uniformStats.summerTop[emp.uniformSummerTop] || 0) + emp.uniformSummerTopQty;
      }
      if (emp.uniformSummerBottom && emp.uniformSummerBottomQty) {
        uniformStats.summerBottom[emp.uniformSummerBottom] = (uniformStats.summerBottom[emp.uniformSummerBottom] || 0) + emp.uniformSummerBottomQty;
      }
      if (emp.uniformWinterTop && emp.uniformWinterTopQty) {
        uniformStats.winterTop[emp.uniformWinterTop] = (uniformStats.winterTop[emp.uniformWinterTop] || 0) + emp.uniformWinterTopQty;
      }
      if (emp.uniformWinterBottom && emp.uniformWinterBottomQty) {
        uniformStats.winterBottom[emp.uniformWinterBottom] = (uniformStats.winterBottom[emp.uniformWinterBottom] || 0) + emp.uniformWinterBottomQty;
      }
      if (emp.uniformWinterPants && emp.uniformWinterPantsQty) {
        uniformStats.winterPants[emp.uniformWinterPants] = (uniformStats.winterPants[emp.uniformWinterPants] || 0) + emp.uniformWinterPantsQty;
      }
      if (emp.uniformWinterCoat && emp.uniformWinterCoatQty) {
        uniformStats.winterCoat[emp.uniformWinterCoat] = (uniformStats.winterCoat[emp.uniformWinterCoat] || 0) + emp.uniformWinterCoatQty;
      }
      if (emp.raincoat && emp.raincoatQty) {
        uniformStats.raincoat[emp.raincoat] = (uniformStats.raincoat[emp.raincoat] || 0) + emp.raincoatQty;
      }
      if (emp.cap && emp.capQty) {
        uniformStats.cap[emp.cap] = (uniformStats.cap[emp.cap] || 0) + emp.capQty;
      }
      if (emp.safetyShoes && emp.safetyShoesQty) {
        uniformStats.safetyShoes[emp.safetyShoes] = (uniformStats.safetyShoes[emp.safetyShoes] || 0) + emp.safetyShoesQty;
      }
             if (emp.rainBoots && emp.rainBootsQty) {
         uniformStats.rainBoots[emp.rainBoots] = (uniformStats.rainBoots[emp.rainBoots] || 0) + emp.rainBootsQty;
       }
       if (emp.winterJacket && emp.winterJacketQty) {
         uniformStats.winterJacket[emp.winterJacket] = (uniformStats.winterJacket[emp.winterJacket] || 0) + emp.winterJacketQty;
       }
       if (emp.doubleJacket && emp.doubleJacketQty) {
         uniformStats.doubleJacket[emp.doubleJacket] = (uniformStats.doubleJacket[emp.doubleJacket] || 0) + emp.doubleJacketQty;
       }
    });

    // 헤더 설정 (주문용)
    worksheet.columns = [
      { header: '품목', key: 'item', width: 25 },
      { header: '사이즈', key: 'size', width: 15 },
      { header: '합계수량', key: 'quantity', width: 15 },
      { header: '단위', key: 'unit', width: 15 },
      { header: '비고', key: 'note', width: 30 }
    ];

    // 스타일 설정
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };

    let rowNumber = 2;

         // 유니폼 종류별 통계 (주문용으로 정리)
     const uniformTypes = {
       '여름 상의': uniformStats.summerTop,
       '여름 하의': uniformStats.summerBottom,
       '겨울 상의': uniformStats.winterTop,
       '겨울 하의': uniformStats.winterBottom,
       '방한 하의': uniformStats.winterPants,
       '방한 외투': uniformStats.winterCoat,
       '동점퍼': uniformStats.winterJacket,
       '겹점퍼': uniformStats.doubleJacket,
       '우비': uniformStats.raincoat,
       '모자': uniformStats.cap,
       '안전화': uniformStats.safetyShoes,
       '장화': uniformStats.rainBoots
     };

    // 주문용으로 데이터 정리 (0이 아닌 수량만 표시)
    Object.entries(uniformTypes).forEach(([type, sizes]) => {
      const validSizes = Object.entries(sizes).filter(([size, count]) => count > 0);
      
      if (validSizes.length > 0) {
        // 품목별 헤더 행 추가
        worksheet.addRow({
          item: type,
          size: '',
          quantity: '',
          unit: '',
          note: ''
        });
        rowNumber++;
        
        // 사이즈별 수량 데이터
        validSizes.forEach(([size, count]) => {
          worksheet.addRow({
            item: '',
            size: size,
            quantity: count,
            unit: '개',
            note: ''
          });
          rowNumber++;
        });
        
        // 품목별 합계 행 추가
        const totalQuantity = validSizes.reduce((sum, [size, count]) => sum + count, 0);
        worksheet.addRow({
          item: '',
          size: '합계',
          quantity: totalQuantity,
          unit: '개',
          note: ''
        });
        rowNumber++;
        
        // 빈 행 추가
        worksheet.addRow({
          item: '',
          size: '',
          quantity: '',
          unit: '',
          note: ''
        });
        rowNumber++;
      }
    });

    // 전체 합계 행 추가
    const allQuantities = Object.values(uniformStats).flatMap(category => 
      Object.values(category).filter(count => count > 0)
    );
    const grandTotal = allQuantities.reduce((sum, count) => sum + count, 0);
    
    worksheet.addRow({
      item: '전체 합계',
      size: '',
      quantity: grandTotal,
      unit: '개',
      note: ''
    });

    // 파일명 설정 (영문으로 변경하여 헤더 오류 방지)
    const fileName = `uniform_order_stats_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('유니폼 통계 엑셀 다운로드 오류:', error);
    res.status(500).json({ success: false, error: '엑셀 파일 생성 중 오류가 발생했습니다.' });
  }
});

// 유니폼 템플릿 다운로드 API
app.get('/uniform/excel/template', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: '관리자 권한이 필요합니다.' });
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('유니폼 템플릿');

    // 헤더 설정
    worksheet.columns = [
      { header: '사번', key: 'empNo', width: 15 },
      { header: '이름', key: 'name', width: 20 },
      { header: '부서', key: 'department', width: 20 },
      { header: '여름 상의', key: 'summerTop', width: 15 },
      { header: '여름 하의', key: 'summerBottom', width: 15 },
      { header: '겨울 상의', key: 'winterTop', width: 15 },
      { header: '겨울 하의', key: 'winterBottom', width: 15 },
      { header: '방한 하의', key: 'winterPants', width: 15 },
      { header: '방한 외투', key: 'winterCoat', width: 15 },
      { header: '우비', key: 'raincoat', width: 15 },
      { header: '모자', key: 'cap', width: 15 },
      { header: '안전화', key: 'safetyShoes', width: 15 },
      { header: '장화', key: 'rainBoots', width: 15 }
    ];

    // 스타일 설정
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };

    // 샘플 데이터 추가
    worksheet.addRow({
      empNo: 'EMP001',
      name: '홍길동',
      department: '생산팀',
      summerTop: 'L',
      summerBottom: 'L',
      winterTop: 'L',
      winterBottom: 'L',
      winterPants: 'L',
      winterCoat: 'L',
      raincoat: 'L',
      cap: 'L',
      safetyShoes: '270',
      rainBoots: '270'
    });

    // 사이즈 옵션 시트 추가
    const sizeSheet = workbook.addWorksheet('사이즈 옵션');
    sizeSheet.columns = [
      { header: '구분', key: 'category', width: 20 },
      { header: '사이즈 옵션', key: 'sizes', width: 50 }
    ];

    const sizeHeaderRow = sizeSheet.getRow(1);
    sizeHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    sizeHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };

    const sizeOptions = [
      { category: '상의/하의', sizes: 'XS, S, M, L, XL, XXL, 3XL' },
      { category: '신발', sizes: '250, 255, 260, 265, 270, 275, 280, 285, 290' },
      { category: '모자', sizes: 'S, M, L, XL' }
    ];

    sizeOptions.forEach(option => {
      sizeSheet.addRow(option);
    });

    // 파일명 설정 (영문으로 변경하여 헤더 오류 방지)
    const fileName = 'uniform_input_template.xlsx';
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('유니폼 템플릿 다운로드 오류:', error);
    res.status(500).json({ success: false, error: '템플릿 파일 생성 중 오류가 발생했습니다.' });
  }
});

// 활동 로그 엑셀 다운로드 API
app.get('/auth/logs/excel', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: '관리자 권한이 필요합니다.' });
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('활동 로그');

    // 로그 데이터 조회
    const logs = await Log.find({})
      .populate('userId', 'username name')
      .sort({ createdAt: -1 })
      .limit(1000); // 최대 1000개 로그

    // 헤더 설정
    worksheet.columns = [
      { header: '번호', key: 'no', width: 10 },
      { header: '사용자', key: 'username', width: 20 },
      { header: '이름', key: 'name', width: 20 },
      { header: '액션', key: 'action', width: 30 },
      { header: '상세내용', key: 'details', width: 50 },
      { header: 'IP 주소', key: 'ipAddress', width: 20 },
      { header: '사용자 에이전트', key: 'userAgent', width: 40 },
      { header: '생성일시', key: 'createdAt', width: 25 }
    ];

    // 스타일 설정
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };

    // 데이터 추가
    logs.forEach((log, index) => {
      worksheet.addRow({
        no: index + 1,
        username: log.userId?.username || '알 수 없음',
        name: log.userId?.name || '알 수 없음',
        action: log.action || '',
        details: log.details || '',
        ipAddress: log.ipAddress || '',
        userAgent: log.userAgent || '',
        createdAt: log.createdAt ? new Date(log.createdAt).toLocaleString('ko-KR') : ''
      });
    });

    // 파일명 설정 (영문으로 변경하여 헤더 오류 방지)
    const fileName = `activity_logs_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('활동 로그 엑셀 다운로드 오류:', error);
    res.status(500).json({ success: false, error: '엑셀 파일 생성 중 오류가 발생했습니다.' });
  }
});

// 로그 통계 보고서 엑셀 다운로드 API
app.get('/auth/logs/report/excel', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: '관리자 권한이 필요합니다.' });
    }

    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const startDate = new Date(month + '-01');
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('로그 통계 보고서');

    // 로그 통계 데이터 조회
    const logs = await Log.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('userId', 'username name');

    // 사용자별 액션 통계
    const userStats = {};
    const actionStats = {};
    const dailyStats = {};

    logs.forEach(log => {
      const username = log.userId?.username || '알 수 없음';
      const action = log.action || '알 수 없음';
      const date = log.createdAt ? log.createdAt.toISOString().slice(0, 10) : '';

      // 사용자별 통계
      if (!userStats[username]) userStats[username] = 0;
      userStats[username]++;

      // 액션별 통계
      if (!actionStats[action]) actionStats[action] = 0;
      actionStats[action]++;

      // 일별 통계
      if (!dailyStats[date]) dailyStats[date] = 0;
      dailyStats[date]++;
    });

    // 헤더 설정
    worksheet.columns = [
      { header: '구분', key: 'category', width: 25 },
      { header: '항목', key: 'item', width: 30 },
      { header: '수량', key: 'count', width: 15 },
      { header: '비율', key: 'percentage', width: 15 },
      { header: '비고', key: 'note', width: 30 }
    ];

    // 스타일 설정
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };

    let rowNumber = 2;
    const totalLogs = logs.length;

    // 기본 정보
    worksheet.addRow({
      category: '보고서 기간',
      item: month,
      count: '',
      percentage: '',
      note: ''
    });
    rowNumber++;

    worksheet.addRow({
      category: '총 로그 수',
      item: '',
      count: totalLogs,
      percentage: '100%',
      note: '건'
    });
    rowNumber++;

    // 사용자별 통계
    worksheet.addRow({ category: '', item: '', size: '', quantity: '', note: '' });
    rowNumber++;
    
    worksheet.addRow({
      category: '사용자별 활동 통계',
      item: '',
      count: '',
      percentage: '',
      note: ''
    });
    rowNumber++;

    Object.entries(userStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([username, count]) => {
        const percentage = totalLogs > 0 ? ((count / totalLogs) * 100).toFixed(1) : 0;
        worksheet.addRow({
          category: username,
          item: '활동 수',
          count: count,
          percentage: `${percentage}%`,
          note: ''
        });
        rowNumber++;
      });

    // 액션별 통계
    worksheet.addRow({ category: '', item: '', size: '', quantity: '', note: '' });
    rowNumber++;
    
    worksheet.addRow({
      category: '액션별 통계',
      item: '',
      count: '',
      percentage: '',
      note: ''
    });
    rowNumber++;

    Object.entries(actionStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([action, count]) => {
        const percentage = totalLogs > 0 ? ((count / totalLogs) * 100).toFixed(1) : 0;
        worksheet.addRow({
          category: action,
          item: '실행 수',
          count: count,
          percentage: `${percentage}%`,
          note: ''
        });
        rowNumber++;
      });

    // 파일명 설정 (영문으로 변경하여 헤더 오류 방지)
    const fileName = `log_report_${month}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('로그 통계 보고서 엑셀 다운로드 오류:', error);
    res.status(500).json({ success: false, error: '보고서 파일 생성 중 오류가 발생했습니다.' });
  }
});

// Activity Logs 페이지 라우트
app.get('/auth/logs', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).send(`
        <script>
          alert('관리자 권한이 필요합니다.');
          history.back();
        </script>
      `);
    }
    
    res.render('activityLogs', { 
      session: req.session,
      name: req.session.name || '사용자',
      position: req.session.position || '직급미정',
      department: req.session.department || '부서미정'
    });
  } catch (error) {
    console.error('Activity Logs 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('Activity Logs 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// Notice New 페이지 라우트
app.get('/notice/new', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).send(`
        <script>
          alert('관리자 권한이 필요합니다.');
          history.back();
        </script>
      `);
    }
    
    res.render('noticeNew', { session: req.session });
  } catch (error) {
    console.error('Notice New 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('Notice New 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

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

// 직원 찾기 페이지
app.get('/employees', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }

    const employees = await Employee.find().sort({ name: 1 });
    
    res.render('employees', {
      employees,
      session: req.session
    });

  } catch (error) {
    console.error('직원 목록 로드 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 게시판 페이지
app.get('/boards', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }

    // 게시판 목록 조회 (임시 데이터)
    const boards = [
      { id: 'notice', name: '공지사항', department: null },
      { id: 'free', name: '자유게시판', department: null },
      { id: 'department', name: '보안1팀 게시판', department: '보안1팀' },
      { id: 'department', name: '보안2팀 게시판', department: '보안2팀' },
      { id: 'department', name: '보안3팀 게시판', department: '보안3팀' }
    ];

    res.render('boards', {
      boards,
      session: req.session
    });

  } catch (error) {
    console.error('게시판 목록 로드 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 근태 입력 페이지
app.get('/attendance', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }

    res.render('attendance', {
      session: req.session
    });

  } catch (error) {
    console.error('근태 입력 페이지 로드 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 월간 근태현황 페이지
app.get('/monthlyAttendance', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }

    res.render('monthlyAttendance', {
      session: req.session
    });

  } catch (error) {
    console.error('월간 근태현황 페이지 로드 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 보안업무 관련 페이지들
app.get('/security/duty-orders', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }

    res.render('security/duty-orders', {
      session: req.session
    });

  } catch (error) {
    console.error('근무명령서 페이지 로드 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

app.get('/security/handover', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }

    res.render('security/handover', {
      session: req.session
    });

  } catch (error) {
    console.error('인계사항 페이지 로드 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

app.get('/security/schedule', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }

    res.render('security/schedule', {
      session: req.session
    });

  } catch (error) {
    console.error('일정 페이지 로드 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 유니폼 통계 데이터 API
app.get('/api/uniform/stats', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const Employee = require('./models/Employee');
    
    // 유니폼 통계 데이터 조회
    const employees = await Employee.find({ status: '재직' });
    
         // 유니폼 종류별 통계
     const uniformStats = {
       summerTop: { '2별대': 0, '별대': 0, '특대': 0, '대': 0, '중': 0 },
       summerBottom: { '38': 0, '36': 0, '35': 0, '34': 0, '33': 0, '32': 0, '31': 0, '30': 0 },
       winterTop: { '2별대': 0, '별대': 0, '특대': 0, '대': 0, '중': 0 },
       winterBottom: { '38': 0, '36': 0, '35': 0, '34': 0, '33': 0, '32': 0, '31': 0, '30': 0 },
       winterPants: { '38': 0, '36': 0, '35': 0, '34': 0, '33': 0, '32': 0, '31': 0, '30': 0 },
       winterCoat: { '2별대': 0, '별대': 0, '특대': 0, '대': 0, '중': 0 },
       winterJacket: { '2별대': 0, '별대': 0, '특대': 0, '대': 0, '중': 0 },
       doubleJacket: { '2별대': 0, '별대': 0, '특대': 0, '대': 0, '중': 0 },
       raincoat: { '2별대': 0, '별대': 0, '특대': 0, '대': 0, '중': 0 },
       cap: { '별대': 0, '특대': 0, '대': 0, '중': 0, '소': 0 },
       safetyShoes: { '290': 0, '285': 0, '280': 0, '275': 0, '270': 0, '265': 0, '260': 0, '255': 0, '250': 0 },
       rainBoots: { '290': 0, '285': 0, '280': 0, '275': 0, '270': 0, '265': 0, '260': 0, '255': 0, '250': 0 }
     };

    // 부서별 통계
    const departmentStats = {};
    
    employees.forEach(emp => {
      // 유니폼 사이즈별 카운트
      if (emp.uniformSummerTop && emp.uniformSummerTopQty) {
        uniformStats.summerTop[emp.uniformSummerTop] += emp.uniformSummerTopQty;
      }
      if (emp.uniformSummerBottom && emp.uniformSummerBottomQty) {
        uniformStats.summerBottom[emp.uniformSummerBottom] += emp.uniformSummerBottomQty;
      }
      if (emp.uniformWinterTop && emp.uniformWinterTopQty) {
        uniformStats.winterTop[emp.uniformWinterTop] += emp.uniformWinterTopQty;
      }
      if (emp.uniformWinterBottom && emp.uniformWinterBottomQty) {
        uniformStats.winterBottom[emp.uniformWinterBottom] += emp.uniformWinterBottomQty;
      }
      if (emp.uniformWinterPants && emp.uniformWinterPantsQty) {
        uniformStats.winterPants[emp.uniformWinterPants] += emp.uniformWinterPantsQty;
      }
      if (emp.uniformWinterCoat && emp.uniformWinterCoatQty) {
        uniformStats.winterCoat[emp.uniformWinterCoat] += emp.uniformWinterCoatQty;
      }
      if (emp.raincoat && emp.raincoatQty) {
        uniformStats.raincoat[emp.raincoat] += emp.raincoatQty;
      }
      if (emp.cap && emp.capQty) {
        uniformStats.cap[emp.cap] += emp.capQty;
      }
      if (emp.safetyShoes && emp.safetyShoesQty) {
        uniformStats.safetyShoes[emp.safetyShoes] += emp.safetyShoesQty;
      }
             if (emp.rainBoots && emp.rainBootsQty) {
         uniformStats.rainBoots[emp.rainBoots] += emp.rainBootsQty;
       }
       if (emp.winterJacket && emp.winterJacketQty) {
         uniformStats.winterJacket[emp.winterJacket] += emp.winterJacketQty;
       }
       if (emp.doubleJacket && emp.doubleJacketQty) {
         uniformStats.doubleJacket[emp.doubleJacket] += emp.doubleJacketQty;
       }

      // 부서별 통계
      if (emp.department) {
        if (!departmentStats[emp.department]) {
          departmentStats[emp.department] = 0;
        }
        departmentStats[emp.department]++;
      }
    });

    // 총 유니폼 수 계산
    const totalUniforms = Object.values(uniformStats).reduce((total, category) => {
      return total + Object.values(category).reduce((sum, count) => sum + count, 0);
    }, 0);

    res.json({
      success: true,
      data: {
        totalUniforms,
        uniformStats,
        departmentStats,
        totalEmployees: employees.length
      }
    });

  } catch (error) {
    console.error('유니폼 통계 API 오류:', error);
    res.status(500).json({ 
      error: '유니폼 통계를 불러오는 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 활동 로그 데이터 API
app.get('/api/logs', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const Log = require('./models/Log');
    const User = require('./models/User');
    const Employee = require('./models/Employee');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // 필터링 옵션
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.userId) filter.userId = req.query.userId;
    
    // 날짜 범위 필터
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    // 로그 데이터 조회
    const logs = await Log.find(filter)
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 총 로그 수
    const totalLogs = await Log.countDocuments(filter);
    
    // 통계 데이터
    const totalActions = await Log.countDocuments();
    const uniqueUsers = await Log.distinct('userId');
    const actionTypes = await Log.distinct('action');

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalLogs / limit),
          totalLogs,
          hasNext: page < Math.ceil(totalLogs / limit),
          hasPrev: page > 1
        },
        stats: {
          totalActions,
          uniqueUsers: uniqueUsers.length,
          actionTypes
        }
      }
    });

  } catch (error) {
    console.error('활동 로그 API 오류:', error);
    res.status(500).json({ 
      error: '활동 로그를 불러오는 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 헬스 체크 엔드포인트 (Render/모니터링용)
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// 전역 에러 핸들러 (serve-static 에러 포함)
app.use((err, req, res, next) => {
  console.error('전역 에러 핸들러:', err);
  
  // serve-static 에러인 경우
  if (err.code === 'ENOENT' || err.status === 404) {
    return res.status(404).json({ 
      error: '요청한 파일을 찾을 수 없습니다.',
      path: req.path 
    });
  }
  
  // 기타 서버 에러
  res.status(500).json({ 
    error: '서버 내부 오류가 발생했습니다.',
    message: process.env.NODE_ENV === 'production' ? '서버 오류' : err.message
  });
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ 
    error: '요청한 페이지를 찾을 수 없습니다.',
    path: req.path 
  });
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`포트: ${PORT}`);
});
