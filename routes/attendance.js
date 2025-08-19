const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const WorkScheduleService = require('../services/workScheduleService');

// 근태 입력 페이지 렌더링
router.get('/', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.redirect('/auth/login');
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).send(`
        <script>
          alert('관리자 권한이 필요합니다.');
          history.back();
        </script>
      `);
    }

    // 오늘 날짜
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];

    // URL 파라미터에서 부서 가져오기
    const selectedDepartment = req.query.department || '';

    // 직원 조회 (부서별 필터링 적용)
    let employeeQuery = { status: '재직' };
    if (selectedDepartment) {
      employeeQuery.department = selectedDepartment;
    }
    const employees = await Employee.find(employeeQuery).sort({ name: 1 });

    // 전체 부서 목록 가져오기 (필터링과 관계없이 모든 부서)
    const allEmployees = await Employee.find({ status: '재직' });
    const allDepartments = [...new Set(allEmployees.map(emp => emp.department || '부서미정'))].sort();

    res.render('attendance', {
      employees,
      today: dateString,
      selectedDepartment,
      allDepartments,
      session: req.session
    });

  } catch (error) {
    console.error('근태 입력 페이지 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('근태 입력 페이지 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// 근태 데이터 저장
router.post('/save', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    const { date, attendanceData } = req.body;

    if (!date || !attendanceData) {
      return res.status(400).json({ success: false, message: '필수 데이터가 누락되었습니다.' });
    }

    // 각 직원의 근태 정보 업데이트
    for (const employeeId in attendanceData) {
      const data = attendanceData[employeeId];
      
      if (data.status && data.status !== '') {
        // Employee 모델에 근태 정보 업데이트
        await Employee.findByIdAndUpdate(employeeId, {
          $set: {
            [`attendance.${date}`]: {
              status: data.status,
              checkIn: data.checkIn || '',
              checkOut: data.checkOut || '',
              basic: data.basic || '',
              overtime: data.overtime || '',
              special: data.special || '',
              specialOvertime: data.specialOvertime || '',
              night: data.night || '',
              totalTime: data.totalTime || '',
              note: data.note || '',
              updatedAt: new Date()
            }
          }
        });
      }
    }

    res.json({ success: true, message: '근태 정보가 저장되었습니다.' });

  } catch (error) {
    console.error('근태 저장 오류:', error);
    res.status(500).json({ success: false, message: '근태 저장 중 오류가 발생했습니다.' });
  }
});

// 특정 날짜의 근태 데이터 조회
router.get('/data/:date', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const { date } = req.params;
    const { department } = req.query;

    // 직원 조회 (부서별 필터링 적용)
    let employeeQuery = { status: '재직' };
    if (department) {
      employeeQuery.department = department;
    }

    // 해당 날짜의 직원 근태 정보 조회 (필터링 적용)
    const employees = await Employee.find(employeeQuery, {
      name: 1,
      department: 1,
      position: 1,
      attendance: 1
    });

    const attendanceData = {};
    employees.forEach(emp => {
      if (emp.attendance && emp.attendance.has(date)) {
        // MongoDB Map 타입을 일반 객체로 변환
        const dateData = emp.attendance.get(date);
        attendanceData[emp._id] = dateData;
      } else {
        attendanceData[emp._id] = {};
      }
    });

    res.json({ success: true, data: attendanceData });

  } catch (error) {
    console.error('근태 데이터 조회 오류:', error);
    res.status(500).json({ success: false, message: '근태 데이터 조회 중 오류가 발생했습니다.' });
  }
});

// 자동 근무 스케줄 설정
router.post('/auto-schedule', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: '날짜가 필요합니다.' });
    }

    // 자동 스케줄 설정
    const scheduleData = await WorkScheduleService.autoSetWorkSchedule(date, req.session.userId);

    res.json({ 
      success: true, 
      message: '근무 스케줄이 자동으로 설정되었습니다.',
      data: scheduleData
    });

  } catch (error) {
    console.error('자동 스케줄 설정 오류:', error);
    res.status(500).json({ success: false, message: '자동 스케줄 설정 중 오류가 발생했습니다.' });
  }
});

// 근태 자동 입력
router.post('/auto-attendance', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: '날짜가 필요합니다.' });
    }

    // 해당 날짜의 요일 확인
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 토요일(6) 또는 일요일(0)
    
    // 현재 주차 계산
    const weekStart = new Date(targetDate);
    const diff = targetDate.getDay() - 1;
    weekStart.setDate(targetDate.getDate() - diff);
    const weekNumber = Math.ceil((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    const cycleWeek = (weekNumber - 1) % 3; // 3주 주기

    // 직원 조회
    const employees = await Employee.find({ status: '재직' }).sort({ name: 1 });
    
    const autoAttendanceData = {};

    employees.forEach(emp => {
      let status = '';
      let checkIn = '';
      let checkOut = '';
      let basic = '';
      let overtime = '';
      let special = '';
      let specialOvertime = '';
      let night = '';
      let note = '';

      if (emp.department && emp.department.includes('보안')) {
        const teamNumber = emp.department.match(/\d+/)?.[0] || '1';
        
        if (isWeekend) {
          // 주말 근무 로직
          if (dayOfWeek === 6) { // 토요일
            if (cycleWeek === 0) { // 1주차: 1팀 주간, 2팀 초야, 3팀 심야
              if (teamNumber === '2') { // 2팀 초야조
                status = '출근(야특)';
                checkIn = '06:00';
                checkOut = '18:00';
                basic = '12';
                note = '토요일 주간근무 (초야조)';
              } else if (teamNumber === '3') { // 3팀 심야조
                status = '출근(야특)';
                checkIn = '18:00';
                checkOut = '06:00';
                basic = '12';
                note = '토요일 야간근무 (심야조)';
              }
            } else if (cycleWeek === 1) { // 2주차: 1팀 심야, 2팀 주간, 3팀 초야
              if (teamNumber === '3') { // 3팀 초야조
                status = '출근(야특)';
                checkIn = '06:00';
                checkOut = '18:00';
                basic = '12';
                note = '토요일 주간근무 (초야조)';
              } else if (teamNumber === '1') { // 1팀 심야조
                status = '출근(야특)';
                checkIn = '18:00';
                checkOut = '06:00';
                basic = '12';
                note = '토요일 야간근무 (심야조)';
              }
            } else if (cycleWeek === 2) { // 3주차: 1팀 초야, 2팀 심야, 3팀 주간
              if (teamNumber === '1') { // 1팀 초야조
                status = '출근(야특)';
                checkIn = '06:00';
                checkOut = '18:00';
                basic = '12';
                note = '토요일 주간근무 (초야조)';
              } else if (teamNumber === '2') { // 2팀 심야조
                status = '출근(야특)';
                checkIn = '18:00';
                checkOut = '06:00';
                basic = '12';
                note = '토요일 야간근무 (심야조)';
              }
            }
          } else if (dayOfWeek === 0) { // 일요일
            // 일요일은 A조, B조 근무 (간단한 로직)
            if (emp.name.includes('A조') || emp.name.includes('1팀')) {
              status = '출근(야특)';
              checkIn = '06:00';
              checkOut = '18:00';
              basic = '12';
              note = '일요일 주간근무 (A조)';
            } else if (emp.name.includes('B조') || emp.name.includes('3팀')) {
              status = '출근(야특)';
              checkIn = '18:00';
              checkOut = '06:00';
              basic = '12';
              note = '일요일 야간근무 (B조)';
            }
          }
        } else {
          // 평일 근무 로직
          if (cycleWeek === 0) { // 1주차: 1팀 주간, 2팀 초야, 3팀 심야
            if (teamNumber === '1') {
              status = '출근(주)';
              checkIn = '06:00';
              checkOut = '14:00';
              basic = '8';
            } else if (teamNumber === '2') {
              status = '출근(초)';
              checkIn = '14:00';
              checkOut = '22:00';
              basic = '8';
            } else if (teamNumber === '3') {
              status = '출근(심)';
              checkIn = '22:00';
              checkOut = '06:00';
              basic = '8';
            }
          } else if (cycleWeek === 1) { // 2주차: 1팀 심야, 2팀 주간, 3팀 초야
            if (teamNumber === '1') {
              status = '출근(심)';
              checkIn = '22:00';
              checkOut = '06:00';
              basic = '8';
            } else if (teamNumber === '2') {
              status = '출근(주)';
              checkIn = '06:00';
              checkOut = '14:00';
              basic = '8';
            } else if (teamNumber === '3') {
              status = '출근(초)';
              checkIn = '14:00';
              checkOut = '22:00';
              basic = '8';
            }
          } else if (cycleWeek === 2) { // 3주차: 1팀 초야, 2팀 심야, 3팀 주간
            if (teamNumber === '1') {
              status = '출근(초)';
              checkIn = '14:00';
              checkOut = '22:00';
              basic = '8';
            } else if (teamNumber === '2') {
              status = '출근(심)';
              checkIn = '22:00';
              checkOut = '06:00';
              basic = '8';
            } else if (teamNumber === '3') {
              status = '출근(주)';
              checkIn = '06:00';
              checkOut = '14:00';
              basic = '8';
            }
          }
        }
      } else {
        // 보안팀이 아닌 경우 (관리팀, 지원팀 등)
        status = '출근(주)';
        checkIn = '09:00';
        checkOut = '18:00';
        basic = '8';
        note = '일반 근무';
      }

      // 자동 입력 데이터 저장
      if (status) {
        autoAttendanceData[emp._id] = {
          status,
          checkIn,
          checkOut,
          basic,
          overtime,
          special,
          specialOvertime,
          night,
          note
        };
      }
    });

    res.json({ 
      success: true, 
      message: '근태가 자동으로 입력되었습니다.',
      data: autoAttendanceData
    });

  } catch (error) {
    console.error('근태 자동 입력 오류:', error);
    res.status(500).json({ success: false, message: '근태 자동 입력 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
