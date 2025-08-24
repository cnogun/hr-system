const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const WorkSchedule = require('../models/WorkSchedule');
const WorkScheduleService = require('../services/workScheduleService');

// 근태 상태에 따라 비고란 자동 설정 함수
function getNoteByStatus(status) {
  switch (status) {
    case '정기휴무':
      return '정기 휴무';
    case '출근(주특)':
      return '주간특근';
    case '출근(야특)':
      return '야간특근';
    case '출근(주)':
      return '평일주간';
    case '출근(초)':
      return '평일 초야';
    case '출근(심)':
      return '평일 심야';
    default:
      return status; // 나머지는 근태상태 그대로
  }
}

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

    const { date, department } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: '날짜가 필요합니다.' });
    }

    // 해당 날짜의 요일 확인
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 토요일(6) 또는 일요일(0)
    
    // 현재 주차 계산 (수정됨)
    const weekStart = new Date(targetDate);
    weekStart.setDate(targetDate.getDate() - targetDate.getDay()); // 해당 주의 일요일로 설정
    
    // 2025년 1월 1일부터의 주차 계산
    const yearStart = new Date(targetDate.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((weekStart - yearStart) / (7 * 24 * 60 * 60 * 1000));
    
    // 3주 주기 계산 (8월 24일은 3주차)
    // 34주차는 3주차에 해당해야 함
    let cycleWeek;
    if (weekNumber >= 34) {
      // 8월 24일 이후는 3주차로 고정
      cycleWeek = 2; // 3주차 (초야근무)
    } else {
      cycleWeek = (weekNumber - 1) % 3; // 0: 1주차, 1: 2주차, 2: 3주차
    }
    
    // 디버깅용 로그 추가
    console.log(`=== 날짜 계산 디버깅 ===`);
    console.log(`선택된 날짜: ${date}`);
    console.log(`targetDate: ${targetDate}`);
    console.log(`dayOfWeek: ${dayOfWeek} (${dayOfWeek === 0 ? '일요일' : dayOfWeek === 6 ? '토요일' : '평일'})`);
    console.log(`weekStart: ${weekStart}`);
    console.log(`weekNumber: ${weekNumber} (2025년 ${weekNumber}주차)`);
    console.log(`cycleWeek: ${cycleWeek} (${cycleWeek === 0 ? '1주차' : cycleWeek === 1 ? '2주차' : '3주차'})`);
    console.log(`isWeekend: ${isWeekend}`);

    // 해당 주차의 근무 스케줄 조회 (1조 명단 확인용)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const workSchedule = await WorkSchedule.findOne({
      weekStartDate: { $lte: weekStart },
      weekEndDate: { $gte: weekStart },
      status: 'active'
    });

    // 각 팀의 조별 명단 추출
    const team1Group1Members = workSchedule?.weekendSchedule?.team1?.group1?.split('\n').filter(line => line.trim()) || [];
    const team1Group2Members = workSchedule?.weekendSchedule?.team1?.group2?.split('\n').filter(line => line.trim()) || [];
    const team1Group3Members = workSchedule?.weekendSchedule?.team1?.group3?.split('\n').filter(line => line.trim()) || [];
    const team1Group4Members = workSchedule?.weekendSchedule?.team1?.group4?.split('\n').filter(line => line.trim()) || [];
    const team2Group1Members = workSchedule?.weekendSchedule?.team2?.group1?.split('\n').filter(line => line.trim()) || [];
    const team3Group1Members = workSchedule?.weekendSchedule?.team3?.group1?.split('\n').filter(line => line.trim()) || [];

    console.log('=== 근무 스케줄 조별 명단 ===');
    console.log('보안1팀 1조:', team1Group1Members);
    console.log('보안1팀 2조:', team1Group2Members);
    console.log('보안1팀 3조:', team1Group3Members);
    console.log('보안1팀 4조:', team1Group4Members);
    console.log('보안2팀 1조:', team2Group1Members);
    console.log('보안3팀 1조:', team3Group1Members);

    // 직원 조회 (부서별 필터링 적용)
    let employeeQuery = { status: '재직' };
    if (department) {
      employeeQuery.department = department;
    }
    const employees = await Employee.find(employeeQuery).sort({ name: 1 });
    
    const autoAttendanceData = {};
    const saturdayWorkers = []; // 토요일 근무자 목록 추적

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

      // 팀번호 추출 (보안팀이든 아니든)
      const teamNumber = emp.department && emp.department.includes('보안') ? emp.department.match(/\d+/)?.[0] || '1' : null;
      
      // 1팀 조별 인원 구분 (1조, 2조, 3조, 4조)
      let team1Group = null;
      let team1WeekendGroup = null;
      if (emp.department === '보안1팀') {
        // 1팀 인원을 4개 조로 나누는 로직 (총 40명 기준)
        const team1Members = ['보안1팀원1', '보안1팀원2', '보안1팀원3', '보안1팀원4', '보안1팀원5', '보안1팀원6', '보안1팀원7', '보안1팀원8', '보안1팀원9', '보안1팀원10', '보안1팀원11', '보안1팀원12', '보안1팀원13', '보안1팀원14', '보안1팀원15', '보안1팀원16', '보안1팀원17', '보안1팀원18', '보안1팀원19', '보안1팀원20', '보안1팀원21', '보안1팀원22', '보안1팀원23', '보안1팀원24', '보안1팀원25', '보안1팀원26', '보안1팀원27', '보안1팀원28', '보안1팀원29', '보안1팀원30', '보안1팀원31', '보안1팀원32', '보안1팀원33', '보안1팀원34', '보안1팀원35', '보안1팀원36', '보안1팀원37', '보안1팀원38', '보안1팀원39', '보안1팀원40'];
        
        const memberIndex = team1Members.indexOf(emp.name);
        if (memberIndex !== -1) {
          if (memberIndex < 10) team1Group = '1조';
          else if (memberIndex < 20) team1Group = '2조';
          else if (memberIndex < 30) team1Group = '3조';
          else team1Group = '4조';
          
          // A조/B조 구분 (일요일 근무용)
          if (memberIndex < 20) team1WeekendGroup = 'A조';
          else team1WeekendGroup = 'B조';
        }
      }
      
      // 디버깅용 로그 추가
      if (emp.department && emp.department.includes('보안')) {
        console.log(`직원 처리 시작: ${emp.name}, 팀: ${emp.department}, 팀번호: ${teamNumber}, 1팀조: ${team1Group}, 요일: ${dayOfWeek}, 주차: ${cycleWeek}, 주말여부: ${isWeekend}`);
      }

      if (emp.department && emp.department.includes('보안')) {
        
        if (isWeekend) {
          // 주말 근무 로직
          if (dayOfWeek === 6) { // 토요일
            // 토요일 근무 로직 - 근무 스케줄의 1조 명단 기준으로 수정
            console.log(`토요일 근무 처리 시작 - 직원: ${emp.name}, 부서: ${emp.department}`);
            
            // 해당 팀의 1조 명단에 속하는지 확인
            let isGroup1Member = false;
            if (teamNumber === '1' && team1Group1Members.includes(emp.name)) {
              isGroup1Member = true;
            } else if (teamNumber === '2' && team2Group1Members.includes(emp.name)) {
              isGroup1Member = true;
            } else if (teamNumber === '3' && team3Group1Members.includes(emp.name)) {
              isGroup1Member = true;
            }

            // 3팀이 3주차(주간근무)일 때는 3팀 전체가 정기휴무
            if (teamNumber === '3' && cycleWeek === 2) {
              status = '정기휴무';
              basic = '8';
              note = getNoteByStatus(status);
              // 3팀은 토요일 휴무 후 일요일에 A조/B조 근무를 하므로 saturdayWorkers에 추가하지 않음
              console.log(`3팀 전체 정기휴무 설정: ${emp.name}`);
            }
            // 1조는 무조건 휴무 (3팀이 아닌 경우)
            else if (isGroup1Member) {
              status = '정기휴무';
              basic = '8';
              note = getNoteByStatus(status);
              saturdayWorkers.push(emp.name); // 1조도 토요일 근무자로 추가 (일요일 정기휴무 적용용)
              console.log(`1조 휴무 설정 완료: ${emp.name}`);
            } 
            // 1조가 아닌 경우 근무 로직 적용
            else {
              console.log(`1조가 아닌 직원 근무 로직 - 직원: ${emp.name}, 팀번호: ${teamNumber}, 주차: ${cycleWeek}`);
              
              if (cycleWeek === 0) { // 1주차: 1팀 전체 휴무, 2팀 초야, 3팀 심야
                if (teamNumber === '1') { // 1팀 전체 휴무 (금요일 근무 후 정기휴무)
                  status = '정기휴무';
                  basic = '8';
                  note = getNoteByStatus(status);
                  console.log(`1팀 전체 휴무 설정: ${emp.name}`);
                } else if (teamNumber === '2') { // 2팀 심야조 (토요일 야간특근)
                  // 2팀은 1조 휴무, 2,3,4조 야간특근
                  if (team1Group === '1조') {
                    // 1조: 휴무 (일요일 야간특근 근무를 위해)
                    status = '정기휴무';
                    basic = '8';
                    note = getNoteByStatus(status);
                    saturdayWorkers.push(emp.name); // 1조도 토요일 근무자로 추가 (일요일 정기휴무 적용용)
                    console.log(`2팀 1조 휴무 설정: ${emp.name}`);
                  } else {
                    // 2,3,4조: 야간특근 근무
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    special = '12';        // 8×1.5 = 12시간 (가중치 적용)
                    specialOvertime = '8'; // 4×2.0 = 8시간 (가중치 적용)
                    night = '4';           // 8×0.5 = 4시간 (가중치 적용)
                    note = getNoteByStatus(status);
                    saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                    console.log(`2팀 ${team1Group} 야간특근 설정: ${emp.name}`);
                  }
                } else if (teamNumber === '3') { // 3팀 심야조 (토요일 야간특근)
                  status = '출근(야특)';
                  checkIn = '18:00';
                  checkOut = '06:00';
                  basic = '8';
                  special = '12';        // 8×1.5 = 12시간 (가중치 적용)
                  specialOvertime = '8'; // 4×2.0 = 8시간 (가중치 적용)
                  night = '4';           // 8×0.5 = 4시간 (가중치 적용)
                  note = getNoteByStatus(status);
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`3팀 야간특근 설정: ${emp.name}`);
                }
              } else if (cycleWeek === 1) { // 2주차: 1팀 1조,3조,4조 야간특근, 2팀 주간, 3팀 초야
                if (teamNumber === '1') { // 1팀 1조,3조,4조 야간특근
                  if (team1Group === '1조' || team1Group === '3조' || team1Group === '4조') {
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    special = '12';        // 8×1.5 = 12시간 (가중치 적용)
                    specialOvertime = '8'; // 4×2.0 = 8시간 (가중치 적용)
                    night = '4';           // 8×0.5 = 4시간 (가중치 적용)
                    note = getNoteByStatus(status);
                    saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                    console.log(`1팀 ${team1Group} 야간특근 설정: ${emp.name}`);
                  } else if (team1Group === '2조') { // 1팀 2조 휴무 (지원조)
                    status = '정기휴무';
                    basic = '8';
                    note = getNoteByStatus(status);
                    console.log(`1팀 2조 휴무 설정: ${emp.name}`);
                  }
                } else if (teamNumber === '3') { // 3팀 초야조 (토요일 주간특근)
                  status = '출근(주특)';
                  checkIn = '06:00';
                  checkOut = '18:00';
                  basic = '8';
                  special = '12';        // 8×1.5 = 12시간 (가중치 적용)
                  specialOvertime = '8'; // 4×2.0 = 8시간 (가중치 적용)
                  note = getNoteByStatus(status);
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`3팀 주간특근 설정: ${emp.name}`);
                } else if (teamNumber === '2') { // 2팀 심야조 (토요일 야간특근)
                  status = '출근(야특)';
                  checkIn = '18:00';
                  checkOut = '06:00';
                  basic = '8';
                  special = '12';        // 8×1.5 = 12시간 (가중치 적용)
                  specialOvertime = '8'; // 4×2.0 = 8시간 (가중치 적용)
                  night = '4';           // 8×0.5 = 4시간 (가중치 적용)
                  note = getNoteByStatus(status);
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`2팀 야간특근 설정: ${emp.name}`);
                }
              } else if (cycleWeek === 2) { // 3주차: 1팀 초야, 2팀 심야, 3팀 주간
                if (teamNumber === '1') { // 1팀 초야조 (토요일 선택조 제외한 3개조 주간특근)
                  // 3주차 선택조는 2조, 2조를 제외한 1조, 3조, 4조가 주간특근
                  if (team1Group === '2조') {
                    // 2조: 정기휴무 (일요일 주간특근 근무를 위해)
                    status = '정기휴무';
                    basic = '8';
                    note = getNoteByStatus(status);
                    // 선택조는 토요일 휴무 후 일요일에 주간특근 근무하므로 saturdayWorkers에 추가하지 않음
                    console.log(`1팀 2조 선택조 휴무 설정: ${emp.name}`);
                  } else {
                    // 1조, 3조, 4조: 주간특근 근무
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    special = '12';        // 8×1.5 = 12시간 (가중치 적용)
                    specialOvertime = '8'; // 4×2.0 = 8시간 (가중치 적용)
                    note = getNoteByStatus(status);
                    saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                    console.log(`1팀 ${team1Group} 주간특근 설정: ${emp.name}`);
                  }
                } else if (teamNumber === '2') { // 2팀 심야조 (토요일 야간특근)
                  status = '출근(야특)';
                  checkIn = '18:00';
                  checkOut = '06:00';
                  basic = '8';
                  special = '12';        // 8×1.5 = 12시간 (가중치 적용)
                  specialOvertime = '8'; // 4×2.0 = 8시간 (가중치 적용)
                  night = '4';           // 8×0.5 = 4시간 (가중치 적용)
                  note = getNoteByStatus(status);
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`2팀 야간특근 설정: ${emp.name}`);
                } else {
                  // 3팀은 이미 위에서 처리됨 (3주차일 때 전체 정기휴무)
                  console.log(`3팀 직원이지만 이미 처리됨: ${emp.name}`);
                }
              } else if (cycleWeek === 3) { // 4주차: 1팀 주간, 2팀 초야, 3팀 심야
                if (teamNumber === '1') { // 1팀 주간조 (토요일 전원 휴무)
                  status = '정기휴무';
                  basic = '8';
                  note = getNoteByStatus(status);
                  // 주간근무팀은 토요일 휴무 후 일요일에 B조만 근무하므로 saturdayWorkers에 추가하지 않음
                  console.log(`1팀 주간근무팀 휴무 설정: ${emp.name}`);
                } else if (teamNumber === '2') { // 2팀 초야조 (토요일 주간특근)
                  // 2팀은 1조 휴무, 2,3,4조 주간특근
                  if (team1Group === '1조') {
                    // 1조: 휴무 (일요일 주간특근 근무를 위해)
                    status = '정기휴무';
                    basic = '8';
                    note = getNoteByStatus(status);
                    saturdayWorkers.push(emp.name); // 1조도 토요일 근무자로 추가 (일요일 정기휴무 적용용)
                    console.log(`2팀 1조 휴무 설정: ${emp.name}`);
                  } else {
                    // 2,3,4조: 주간특근 근무
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    special = '12';        // 8×1.5 = 12시간 (가중치 적용)
                    specialOvertime = '8'; // 4×2.0 = 8시간 (가중치 적용)
                    note = getNoteByStatus(status);
                    saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                    console.log(`2팀 ${team1Group} 주간특근 설정: ${emp.name}`);
                  }
                } else if (teamNumber === '3') { // 3팀 심야조 (토요일 야간특근)
                  status = '출근(야특)';
                  checkIn = '18:00';
                  checkOut = '06:00';
                  basic = '8';
                  special = '12';        // 8×1.5 = 12시간 (가중치 적용)
                  specialOvertime = '8'; // 4×2.0 = 8시간 (가중치 적용)
                  night = '4';           // 8×0.5 = 4시간 (가중치 적용)
                  note = getNoteByStatus(status);
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`3팀 야간특근 설정: ${emp.name}`);
                }
              }
            }
          } else if (dayOfWeek === 0) { // 일요일
            // 토요일 근무자들은 정기휴무
            if (saturdayWorkers.includes(emp.name)) {
              status = '정기휴무';
              basic = '8';
              note = getNoteByStatus(status);
              console.log(`토요일 근무 후 정기휴무 설정: ${emp.name}`);
            } else {
              // 보안1팀의 정확한 순환 시스템 적용
              // A12B34A23B41A34B12A41B23... 순환 패턴
              if (emp.department === '보안1팀') {
                // 보안1팀의 주차별 조 적용 순서
                // 1주차(주간): A조, 2주차(심야): 1조, 3주차(초야): 2조, 4주차(주간): B조, 5주차(심야): 3조, 6주차(초야): 4조...
                let appliedGroup = '';
                
                if (cycleWeek === 0) { // 1주차: 주간근무 - A조 적용
                  appliedGroup = 'A조';
                } else if (cycleWeek === 1) { // 2주차: 심야근무 - 1조 적용
                  appliedGroup = '1조';
                } else if (cycleWeek === 2) { // 3주차: 초야근무 - 2조 적용
                  appliedGroup = '2조';
                } else if (cycleWeek === 3) { // 4주차: 주간근무 - B조 적용
                  appliedGroup = 'B조';
                } else if (cycleWeek === 4) { // 5주차: 심야근무 - 3조 적용
                  appliedGroup = '3조';
                } else if (cycleWeek === 5) { // 6주차: 초야근무 - 4조 적용
                  appliedGroup = '4조';
                } else {
                  // 6주차 이후는 6주 주기로 반복
                  const adjustedCycle = cycleWeek % 6;
                  if (adjustedCycle === 0) appliedGroup = 'A조';
                  else if (adjustedCycle === 1) appliedGroup = '1조';
                  else if (adjustedCycle === 2) appliedGroup = '2조';
                  else if (adjustedCycle === 3) appliedGroup = 'B조';
                  else if (adjustedCycle === 4) appliedGroup = '3조';
                  else if (adjustedCycle === 5) appliedGroup = '4조';
                }
                
                console.log(`보안1팀 ${emp.name} - ${cycleWeek}주차, 적용조: ${appliedGroup}`);
                
                // sundayGroup 필드가 있는 경우 해당 필드로 확인
                let isAppliedGroupMember = false;
                if (emp.weekendAssignment?.sundayGroup === appliedGroup) {
                  isAppliedGroupMember = true;
                } else {
                    // sundayGroup 필드가 없는 경우 직원 이름을 기준으로 조 구분
                    // 1팀 인원을 4개 조로 나누는 로직 (총 40명 기준)
                    const team1Members = ['보안1팀원1', '보안1팀원2', '보안1팀원3', '보안1팀원4', '보안1팀원5', '보안1팀원6', '보안1팀원7', '보안1팀원8', '보안1팀원9', '보안1팀원10', '보안1팀원11', '보안1팀원12', '보안1팀원13', '보안1팀원14', '보안1팀원15', '보안1팀원16', '보안1팀원17', '보안1팀원18', '보안1팀원19', '보안1팀원20', '보안1팀원21', '보안1팀원22', '보안1팀원23', '보안1팀원24', '보안1팀원25', '보안1팀원26', '보안1팀원27', '보안1팀원28', '보안1팀원29', '보안1팀원30', '보안1팀원31', '보안1팀원32', '보안1팀원33', '보안1팀원34', '보안1팀원35', '보안1팀원36', '보안1팀원37', '보안1팀원38', '보안1팀원39', '보안1팀원40'];
                  
                  const memberIndex = team1Members.indexOf(emp.name);
                  if (memberIndex !== -1) {
                    let actualGroup = '';
                    if (memberIndex < 10) actualGroup = '1조';
                    else if (memberIndex < 20) actualGroup = '2조';
                    else if (memberIndex < 30) actualGroup = '3조';
                    else actualGroup = '4조';
                    
                    // 주차별로 정확한 조만 매칭 (중복 제거)
                    if (cycleWeek === 0) { // 1주차: 주간근무 - A조(1조+2조) 적용
                      if (actualGroup === '1조' || actualGroup === '2조') {
                        isAppliedGroupMember = true;
                      }
                    } else if (cycleWeek === 1) { // 2주차: 심야근무 - 1조만 적용
                      if (actualGroup === '1조') {
                        isAppliedGroupMember = true;
                      }
                    } else if (cycleWeek === 2) { // 3주차: 초야근무 - 2조만 적용
                      if (actualGroup === '2조') {
                        isAppliedGroupMember = true;
                      }
                    } else if (cycleWeek === 3) { // 4주차: 주간근무 - B조(3조+4조) 적용
                      if (actualGroup === '3조' || actualGroup === '4조') {
                        isAppliedGroupMember = true;
                      }
                    } else if (cycleWeek === 4) { // 5주차: 심야근무 - 3조만 적용
                      if (actualGroup === '3조') {
                        isAppliedGroupMember = true;
                      }
                    } else if (cycleWeek === 5) { // 6주차: 초야근무 - 4조만 적용
                      if (actualGroup === '4조') {
                        isAppliedGroupMember = true;
                      }
                    }
                    
                    console.log(`보안1팀 ${emp.name} - 실제조: ${actualGroup}, 적용조: ${appliedGroup}, 주차: ${cycleWeek}, 매칭: ${isAppliedGroupMember}`);
                  }
                }
                
                // 해당 조에 속하는 직원만 근무
                if (isAppliedGroupMember) {
                  if (cycleWeek === 0) { // 1주차: 주간근무 - A조 주간특근
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    overtime = '0';
                    special = '12';     // 특근 12시간 (8×1.5 가중치)
                    specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                    note = getNoteByStatus(status);
                    console.log(`보안1팀 A조 주간특근 설정: ${emp.name}`);
                  } else if (cycleWeek === 1) { // 2주차: 심야근무 - 1조 야간특근
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    overtime = '0';
                    special = '12';     // 특근 12시간 (8×1.5 가중치)
                    specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                    night = '4';        // 야간 4시간 (8×0.5 가중치)
                    note = getNoteByStatus(status);
                    console.log(`보안1팀 1조 야간특근 설정: ${emp.name}`);
                  } else if (cycleWeek === 2) { // 3주차: 초야근무 - 2조 주간특근
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    overtime = '0';
                    special = '12';     // 특근 12시간 (8×1.5 가중치)
                    specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                    note = getNoteByStatus(status);
                    console.log(`보안1팀 2조 주간특근 설정: ${emp.name}`);
                  } else if (cycleWeek === 3) { // 4주차: 주간근무 - B조 주간특근
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    overtime = '0';
                    special = '12';     // 특근 12시간 (8×1.5 가중치)
                    specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                    note = getNoteByStatus(status);
                    console.log(`보안1팀 B조 주간특근 설정: ${emp.name}`);
                  } else if (cycleWeek === 4) { // 5주차: 심야근무 - 3조 야간특근
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    overtime = '0';
                    special = '12';     // 특근 12시간 (8×1.5 가중치)
                    specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                    night = '4';        // 야간 4시간 (8×0.5 가중치)
                    note = getNoteByStatus(status);
                    console.log(`보안1팀 3조 야간특근 설정: ${emp.name}`);
                  } else if (cycleWeek === 5) { // 6주차: 초야근무 - 4조 주간특근
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    overtime = '0';
                    special = '12';     // 특근 12시간 (8×1.5 가중치)
                    specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                    note = getNoteByStatus(status);
                    console.log(`보안1팀 4조 주간특근 설정: ${emp.name}`);
                  }
                } else {
                  // 해당 조가 아닌 직원은 정기휴무
                  status = '정기휴무';
                  basic = '8';
                  note = getNoteByStatus(status);
                  console.log(`보안1팀 ${emp.name} 정기휴무 설정 (${appliedGroup}가 아님)`);
                }
              } else {
                // 기존 A,B조 순환 규칙 (다른 팀용)
                let cycleWeekForSunday;
                if (targetDate >= new Date('2025-08-24') && targetDate < new Date('2025-08-31')) {
                  cycleWeekForSunday = 2; // 3주차
                } else if (targetDate >= new Date('2025-08-31') && targetDate < new Date('2025-09-07')) {
                  cycleWeekForSunday = 0; // 1주차
                } else if (targetDate >= new Date('2025-09-07') && targetDate < new Date('2025-09-14')) {
                  cycleWeekForSunday = 1; // 2주차
                } else {
                  cycleWeekForSunday = cycleWeek; // 기본값
                }
                
                console.log(`일요일 주차 계산: ${cycleWeekForSunday}주차`);
                
                // weekendGroup 필드가 있는 경우 A,B조 순환 적용 (3주 주기로 수정)
                // 'none'인 경우는 제외하고 A조/B조만 처리
                if (emp.weekendAssignment && emp.weekendAssignment.weekendGroup && emp.weekendAssignment.weekendGroup !== 'none') {
                  if (cycleWeekForSunday === 0) { // 1주차: A조 주간, B조 야간
                    if (emp.weekendAssignment.weekendGroup === 'A조') {
                      // 주간 특근: 06:00~18:00 (12시간)
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';        // 기본 8시간
                      overtime = '0';     // 연장 0시간
                      special = '12';     // 특근 12시간 (8×1.5 가중치)
                      specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                      note = getNoteByStatus(status);
                      console.log(`일요일 A조 주간특근 설정: ${emp.name}`);
                    } else if (emp.weekendAssignment.weekendGroup === 'B조') {
                      // 야간 특근: 18:00~06:00 (12시간) + 야간시간 중복
                      status = '출근(야특)';
                      checkIn = '18:00';
                      checkOut = '06:00';
                      basic = '8';        // 기본 8시간
                      overtime = '0';     // 연장 0시간
                      special = '12';     // 특근 12시간 (8×1.5 가중치)
                      specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                      night = '4';        // 야간 4시간 (8×0.5 가중치)
                      note = getNoteByStatus(status);
                      console.log(`일요일 B조 야간특근 설정: ${emp.name}`);
                    }
                  } else if (cycleWeekForSunday === 1) { // 2주차: A조 야간, B조 주간
                    if (emp.weekendAssignment.weekendGroup === 'A조') {
                      // 야간 특근: 18:00~06:00 (12시간) + 야간시간 중복
                      status = '출근(야특)';
                      checkIn = '18:00';
                      checkOut = '06:00';
                      basic = '8';        // 기본 8시간
                      overtime = '0';     // 연장 0시간
                      special = '12';     // 특근 12시간 (8×1.5 가중치)
                      specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                      night = '4';        // 야간 4시간 (8×0.5 가중치)
                      note = getNoteByStatus(status);
                      console.log(`일요일 A조 야간특근 설정: ${emp.name}`);
                    } else if (emp.weekendAssignment.weekendGroup === 'B조') {
                      // 주간 특근: 06:00~18:00 (12시간)
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';        // 기본 8시간
                      overtime = '0';     // 연장 0시간
                      special = '12';     // 특근 12시간 (8×1.5 가중치)
                      specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                      note = getNoteByStatus(status);
                      console.log(`일요일 B조 주간특근 설정: ${emp.name}`);
                    }
                  } else if (cycleWeekForSunday === 2) { // 3주차: A조 주간, B조 야간
                    if (emp.weekendAssignment.weekendGroup === 'A조') {
                      // 주간 특근: 06:00~18:00 (12시간)
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';        // 기본 8시간
                      overtime = '0';     // 연장 0시간
                      special = '12';     // 특근 12시간 (8×1.5 가중치)
                      specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                      note = getNoteByStatus(status);
                      console.log(`일요일 A조 주간특근 설정: ${emp.name}`);
                    } else if (emp.weekendAssignment.weekendGroup === 'B조') {
                      // 야간 특근: 18:00~06:00 (12시간) + 야간시간 중복
                      status = '출근(야특)';
                      checkIn = '18:00';
                      checkOut = '06:00';
                      basic = '8';        // 기본 8시간
                      overtime = '0';     // 연장 0시간
                      special = '12';     // 특근 12시간 (8×1.5 가중치)
                      specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                      night = '4';        // 야간 4시간 (8×0.5 가중치)
                      note = getNoteByStatus(status);
                      console.log(`일요일 B조 야간특근 설정: ${emp.name}`);
                    }
                  }
                } else {
                  // 기본값 설정 (보안1팀이 아닌 경우)
                  if (emp.department === '보안1팀') {
                    // 보안1팀: 스케줄표의 조 명단을 사용하여 일요일 근무 설정
                    console.log(`1팀 ${emp.name} 스케줄표 기반 일요일 근무 설정`);
                    
                    // 3주차(초야근무)는 2조만 주간특근, 나머지는 정기휴무
                    if (cycleWeek === 2) { // 3주차: 초야근무
                      if (team1Group2Members.includes(emp.name)) {
                        // 2조: 일요일 주간특근 근무
                        status = '출근(주특)';
                        checkIn = '06:00';
                        checkOut = '18:00';
                        basic = '8';        // 기본 8시간
                        overtime = '0';     // 연장 0시간
                        special = '12';     // 특근 12시간 (8×1.5 가중치)
                        specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                        note = getNoteByStatus(status);
                        console.log(`1팀 2조 일요일 주간특근 설정: ${emp.name}`);
                      } else {
                        // 1조, 3조, 4조: 정기 휴무
                        status = '정기휴무';
                        basic = '8';
                        note = getNoteByStatus(status);
                        console.log(`1팀 ${emp.name} 일요일 정기휴무 설정 (2조가 아님)`);
                      }
                    } else if (cycleWeek === 0) { // 1주차: 주간근무
                      // A조(1조+2조) 주간특근, B조(3조+4조) 야간특근
                      if (team1Group1Members.includes(emp.name) || team1Group2Members.includes(emp.name)) {
                        // A조: 주간특근
                        status = '출근(주특)';
                        checkIn = '06:00';
                        checkOut = '18:00';
                        basic = '8';
                        overtime = '0';
                        special = '12';     // 특근 12시간 (8×1.5 가중치)
                        specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                        note = getNoteByStatus(status);
                        console.log(`1팀 A조 일요일 주간특근 설정: ${emp.name}`);
                      } else if (team1Group3Members.includes(emp.name) || team1Group4Members.includes(emp.name)) {
                        // B조: 야간특근
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '12';     // 특근 12시간 (8×1.5 가중치)
                        specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                        night = '4';        // 야간 4시간 (8×0.5 가중치)
                        note = getNoteByStatus(status);
                        console.log(`1팀 B조 일요일 야간특근 설정: ${emp.name}`);
                      }
                    } else if (cycleWeek === 1) { // 2주차: 심야근무
                      // 1조만 야간특근, 나머지는 정기휴무
                      if (team1Group1Members.includes(emp.name)) {
                        // 1조: 야간특근
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '12';     // 특근 12시간 (8×1.5 가중치)
                        specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                        night = '4';        // 야간 4시간 (8×0.5 가중치)
                        note = getNoteByStatus(status);
                        console.log(`1팀 1조 일요일 야간특근 설정: ${emp.name}`);
                      } else {
                        // 2조, 3조, 4조: 정기 휴무
                        status = '정기휴무';
                        basic = '8';
                        note = getNoteByStatus(status);
                        console.log(`1팀 ${emp.name} 일요일 정기휴무 설정 (1조가 아님)`);
                      }
                    }
                  } else if (emp.department === '보안2팀') {
                    // 보안2팀: 1조만 일요일 야간특근, 나머지는 정기 휴무
                    // sundayGroup 필드 사용
                    const sundayGroup = emp.weekendAssignment?.sundayGroup;
                    console.log(`2팀 ${emp.name} sundayGroup: ${sundayGroup}`);
                    
                    if (sundayGroup === '1조') {
                      // 1조: 야간특근 근무
                      status = '출근(야특)';
                      checkIn = '18:00';
                      checkOut = '06:00';
                      basic = '8';        // 기본 8시간
                      overtime = '0';     // 연장 0시간
                      special = '12';     // 특근 12시간 (8×1.5 가중치)
                      specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                      night = '4';        // 야간 4시간 (8×0.5 가중치)
                      note = getNoteByStatus(status);
                      console.log(`2팀 1조 일요일 야간특근 설정: ${emp.name}`);
                    } else if (sundayGroup && ['2조', '3조', '4조'].includes(sundayGroup)) {
                      // 2조, 3조, 4조: 정기 휴무
                      status = '정기휴무';
                      basic = '8';
                      note = getNoteByStatus(status);
                      console.log(`2팀 ${sundayGroup} 일요일 정기휴무 설정: ${emp.name}`);
                    } else {
                      // sundayGroup이 설정되지 않은 경우
                      console.log(`2팀 ${emp.name} sundayGroup 미설정: ${sundayGroup}`);
                    }
                  } else if (emp.department === '보안3팀') {
                    // 보안3팀: 3주차 일요일 A조/B조 구분 근무
                    if (cycleWeekForSunday === 2) {
                      // 3팀도 A조/B조 구분이 필요함
                      // 임시로 이름 기준으로 A조/B조 구분 (실제로는 weekendGroup 필드 필요)
                      const memberIndex = ['보안3팀원1', '보안3팀원2', '보안3팀원3', '보안3팀원4', '보안3팀원5', '보안3팀원6', '보안3팀원7', '보안3팀원8', '보안3팀원9', '보안3팀원10', '보안3팀원11', '보안3팀원12', '보안3팀원13', '보안3팀원14', '보안3팀원15', '보안3팀원16', '보안3팀원17', '보안3팀원18', '보안3팀원19', '보안3팀원20', '보안3팀원21', '보안3팀원22', '보안3팀원23', '보안3팀원24', '보안3팀원25', '보안3팀원26', '보안3팀원27', '보안3팀원28', '보안3팀원29', '보안3팀원30', '보안3팀원31', '보안3팀원32', '보안3팀원33', '보안3팀원34', '보안3팀원35', '보안3팀원36', '보안3팀원37', '보안3팀원38', '보안3팀원39', '보안3팀원40'].indexOf(emp.name);
                      
                      if (memberIndex !== -1) {
                        if (memberIndex < 20) {
                          // A조(20명): 주간특근
                          status = '출근(주특)';
                          checkIn = '06:00';
                          checkOut = '18:00';
                          basic = '8';        // 기본 8시간
                          overtime = '0';     // 연장 0시간
                          special = '12';     // 특근 12시간 (8×1.5 가중치)
                          specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                          note = getNoteByStatus(status);
                          console.log(`3팀 A조 일요일 주간특근 설정: ${emp.name}`);
                        } else {
                          // B조(20명): 야간특근
                          status = '출근(야특)';
                          checkIn = '18:00';
                          checkOut = '06:00';
                          basic = '8';        // 기본 8시간
                          overtime = '0';     // 연장 0시간
                          special = '12';     // 특근 12시간 (8×1.5 가중치)
                          specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                          night = '4';        // 야간 4시간 (8×0.5 가중치)
                          note = getNoteByStatus(status);
                          console.log(`3팀 B조 일요일 야간특근 설정: ${emp.name}`);
                        }
                      } else {
                        // 이름 매칭 안됨: 기본값 없음
                        console.log(`3팀 이름 매칭 안됨, 기본값 설정 안함: ${emp.name}`);
                      }
                    } else {
                      // 1,2주차: 기본값 없음
                      console.log(`3팀 weekendGroup 없음, 기본값 설정 안함: ${emp.name}`);
                    }
                  } else {
                    // 기타 부서: 기본값 없음
                    console.log(`기타 부서 weekendGroup 없음, 기본값 설정 안함: ${emp.name}`);
                  }
                }
              }
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
              note = getNoteByStatus(status);
            } else if (teamNumber === '2') {
              status = '출근(초)';
              checkIn = '14:00';
              checkOut = '22:00';
              basic = '8';
              note = getNoteByStatus(status);
            } else if (teamNumber === '3') {
              status = '출근(심)';
              checkIn = '22:00';
              checkOut = '06:00';
              basic = '8';
              night = '4';        // 야간 4시간 (8×0.5 가중치)
              note = getNoteByStatus(status);
            }
          } else if (cycleWeek === 1) { // 2주차: 1팀 심야, 2팀 주간, 3팀 초야
            if (teamNumber === '1') {
              status = '출근(심)';
              checkIn = '22:00';
              checkOut = '06:00';
              basic = '8';
              night = '4';        // 야간 4시간 (8×0.5 가중치)
              note = getNoteByStatus(status);
            } else if (teamNumber === '2') {
              status = '출근(주)';
              checkIn = '06:00';
              checkOut = '14:00';
              basic = '8';
              note = getNoteByStatus(status);
            } else if (teamNumber === '3') {
              status = '출근(초)';
              checkIn = '14:00';
              checkOut = '22:00';
              basic = '8';
              note = getNoteByStatus(status);
            }
          } else if (cycleWeek === 2) { // 3주차: 1팀 초야, 2팀 심야, 3팀 주간
            if (teamNumber === '1') {
              status = '출근(초)';
              checkIn = '14:00';
              checkOut = '22:00';
              basic = '8';
              note = getNoteByStatus(status);
            } else if (teamNumber === '2') {
              status = '출근(심)';
              checkIn = '22:00';
              checkOut = '06:00';
              basic = '8';
              night = '4';        // 야간 4시간 (8×0.5 가중치)
              note = getNoteByStatus(status);
            } else if (teamNumber === '3') {
              status = '출근(주)';
              checkIn = '06:00';
              checkOut = '14:00';
              basic = '8';
              note = getNoteByStatus(status);
            }
          }
        }
      } else {
        // 보안팀이 아닌 경우 (관리팀, 지원팀 등)
        if (isWeekend) {
          // 주말에는 보안팀만 근무, 나머지는 휴무
          status = '휴무';
          basic = '8';
          note = getNoteByStatus(status);
        } else {
          // 평일에는 일반 근무
          status = '출근(주)';
          checkIn = '09:00';
          checkOut = '18:00';
          basic = '8';
          note = getNoteByStatus(status);
        }
      }

      // 자동 입력 데이터 저장
      if (status) {
        // 총시간 계산 (각 항목 합계)
        let totalTime = 0;
        if (basic) totalTime += parseInt(basic) || 0;
        if (overtime) totalTime += parseInt(overtime) || 0;
        if (special) totalTime += parseInt(special) || 0;
        if (specialOvertime) totalTime += parseInt(specialOvertime) || 0;
        if (night) totalTime += parseInt(night) || 0;
        
        // 디버깅: 각 항목별 값과 총시간 로그
        console.log(`📊 ${emp.name} 총시간 계산:`, {
          basic: basic || 0,
          overtime: overtime || 0,
          special: special || 0,
          specialOvertime: specialOvertime || 0,
          night: night || 0,
          totalTime: totalTime
        });
        
        autoAttendanceData[emp._id] = {
          status,
          checkIn,
          checkOut,
          basic,
          overtime,
          special,
          specialOvertime,
          night,
          totalTime: totalTime.toString(),
          note
        };
        console.log(`✅ 직원 ${emp.name} 데이터 저장됨:`, autoAttendanceData[emp._id]);
      } else {
        console.log(`❌ 직원 ${emp.name} 상태 미설정:`, { teamNumber, dayOfWeek, cycleWeek, isWeekend });
      }
    });

    console.log('=== 최종 autoAttendanceData ===');
    console.log('저장된 직원 수:', Object.keys(autoAttendanceData).length);
    console.log('데이터 키들:', Object.keys(autoAttendanceData));
    console.log('전체 데이터:', autoAttendanceData);

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
