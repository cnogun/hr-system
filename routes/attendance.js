const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const WorkSchedule = require('../models/WorkSchedule');
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
    const weekNumber = Math.ceil((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    const cycleWeek = (weekNumber - 1) % 3; // 3주 주기
    
    // 디버깅용 로그 추가
    console.log(`=== 날짜 계산 디버깅 ===`);
    console.log(`선택된 날짜: ${date}`);
    console.log(`targetDate: ${targetDate}`);
    console.log(`dayOfWeek: ${dayOfWeek} (${dayOfWeek === 0 ? '일요일' : dayOfWeek === 6 ? '토요일' : '평일'})`);
    console.log(`weekStart: ${weekStart}`);
    console.log(`weekNumber: ${weekNumber}`);
    console.log(`cycleWeek: ${cycleWeek}`);
    console.log(`isWeekend: ${isWeekend}`);

    // 해당 주차의 근무 스케줄 조회 (1조 명단 확인용)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const workSchedule = await WorkSchedule.findOne({
      weekStartDate: { $lte: weekStart },
      weekEndDate: { $gte: weekStart },
      status: 'active'
    });

    // 각 팀의 1조 명단 추출
    const team1Group1Members = workSchedule?.weekendSchedule?.team1?.group1?.split('\n').filter(line => line.trim()) || [];
    const team2Group1Members = workSchedule?.weekendSchedule?.team2?.group1?.split('\n').filter(line => line.trim()) || [];
    const team3Group1Members = workSchedule?.weekendSchedule?.team3?.group1?.split('\n').filter(line => line.trim()) || [];

    console.log('=== 근무 스케줄 1조 명단 ===');
    console.log('보안1팀 1조:', team1Group1Members);
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
      
      // 디버깅용 로그 추가
      if (emp.department && emp.department.includes('보안')) {
        console.log(`직원 처리 시작: ${emp.name}, 팀: ${emp.department}, 팀번호: ${teamNumber}, 요일: ${dayOfWeek}, 주차: ${cycleWeek}, 주말여부: ${isWeekend}`);
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
              note = '정기 휴무';
              // 3팀은 토요일 휴무 후 일요일에 A조/B조 근무를 하므로 saturdayWorkers에 추가하지 않음
              console.log(`3팀 전체 정기휴무 설정: ${emp.name}`);
            }
            // 1조는 무조건 휴무 (3팀이 아닌 경우)
            else if (isGroup1Member) {
              status = '정기휴무';
              basic = '8';
              note = '토요일 휴무(1조)';
              saturdayWorkers.push(emp.name); // 1조도 토요일 근무자로 추가 (일요일 정기휴무 적용용)
              console.log(`1조 휴무 설정 완료: ${emp.name}`);
            } 
            // 1조가 아닌 경우 근무 로직 적용
            else {
              console.log(`1조가 아닌 직원 근무 로직 - 직원: ${emp.name}, 팀번호: ${teamNumber}, 주차: ${cycleWeek}`);
              
              if (cycleWeek === 0) { // 1주차: 1팀 주간, 2팀 초야, 3팀 심야
                if (teamNumber === '2') { // 2팀 초야조 (토요일 주간특근)
                  status = '출근(주특)';
                  checkIn = '06:00';
                  checkOut = '18:00';
                  basic = '8';
                  special = '4';
                  note = '토요일 주간특근';
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`2팀 주간특근 설정: ${emp.name}`);
                } else if (teamNumber === '3') { // 3팀 심야조 (토요일 야간특근)
                  status = '출근(야특)';
                  checkIn = '18:00';
                  checkOut = '06:00';
                  basic = '8';
                  special = '4';
                  night = '8';
                  note = '토요일 야간특근';
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`3팀 야간특근 설정: ${emp.name}`);
                } else {
                  // 1팀은 휴무
                  status = '정기휴무';
                  basic = '8';
                  note = '정기 휴무';
                  console.log(`1팀 휴무 설정: ${emp.name}`);
                }
              } else if (cycleWeek === 1) { // 2주차: 1팀 심야, 2팀 주간, 3팀 초야
                if (teamNumber === '3') { // 3팀 초야조 (토요일 주간특근)
                  status = '출근(주특)';
                  checkIn = '06:00';
                  checkOut = '18:00';
                  basic = '8';
                  special = '4';
                  note = '토요일 주간특근';
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`3팀 주간특근 설정: ${emp.name}`);
                } else if (teamNumber === '1') { // 1팀 심야조 (토요일 야간특근)
                  status = '출근(야특)';
                  checkIn = '18:00';
                  checkOut = '06:00';
                  basic = '8';
                  special = '4';
                  night = '8';
                  note = '토요일 야간특근';
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`1팀 야간특근 설정: ${emp.name}`);
                } else {
                  // 2팀은 휴무
                  status = '정기휴무';
                  basic = '8';
                  note = '정기 휴무';
                  console.log(`2팀 휴무 설정: ${emp.name}`);
                }
              } else if (cycleWeek === 2) { // 3주차: 1팀 초야, 2팀 심야, 3팀 주간
                if (teamNumber === '1') { // 1팀 초야조 (토요일 주간특근)
                  status = '출근(주특)';
                  checkIn = '06:00';
                  checkOut = '18:00';
                  basic = '8';
                  special = '4';
                  note = '토요일 주간특근';
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`1팀 주간특근 설정: ${emp.name}`);
                } else if (teamNumber === '2') { // 2팀 심야조 (토요일 야간특근)
                  status = '출근(야특)';
                  checkIn = '18:00';
                  checkOut = '06:00';
                  basic = '8';
                  special = '4';
                  night = '8';
                  note = '토요일 야간특근';
                  saturdayWorkers.push(emp.name); // 토요일 근무자 추가
                  console.log(`2팀 야간특근 설정: ${emp.name}`);
                } else {
                  // 3팀은 이미 위에서 처리됨 (3주차일 때 전체 정기휴무)
                  console.log(`3팀 직원이지만 이미 처리됨: ${emp.name}`);
                }
              }
            }
          } else if (dayOfWeek === 0) { // 일요일
            // 토요일 근무자들은 정기휴무
            if (saturdayWorkers.includes(emp.name)) {
              status = '정기휴무';
              basic = '8';
              note = '토요일 근무 후 정기휴무';
              console.log(`토요일 근무 후 정기휴무 설정: ${emp.name}`);
            } else {
              // A,B조 순환 규칙에 따른 일요일 근무
              // 3주 후 주간근무 → 토요일 휴무 → 일요일 근무시 주간/야간 전환
              const cycleWeekForSunday = cycleWeek; // 이미 계산된 cycleWeek 사용
              
              // weekendGroup 필드가 있는 경우 A,B조 순환 적용 (3주 주기로 수정)
              if (emp.weekendAssignment && emp.weekendAssignment.weekendGroup) {
                if (cycleWeekForSunday === 0) { // 1주차: A조 주간, B조 야간
                  if (emp.weekendAssignment.weekendGroup === 'A조') {
                    // 주간 특근: 06:00~18:00 (12시간)
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';        // 기본 8시간
                    overtime = '0';     // 연장 0시간
                    special = '8';      // 특근 8시간
                    specialOvertime = '4'; // 특근연장 4시간
                    note = '일요일 주간특근 (A조)';
                    console.log(`일요일 A조 주간특근 설정: ${emp.name}`);
                  } else if (emp.weekendAssignment.weekendGroup === 'B조') {
                    // 야간 특근: 18:00~06:00 (12시간) + 야간시간 중복
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';        // 기본 8시간
                    overtime = '0';     // 연장 0시간
                    special = '8';      // 특근 8시간
                    specialOvertime = '4'; // 특근연장 4시간
                    night = '8';        // 야간 8시간
                    note = '일요일 야간특근 (B조)';
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
                    special = '8';      // 특근 8시간
                    specialOvertime = '4'; // 특근연장 4시간
                    night = '8';        // 야간 8시간
                    note = '일요일 야간특근 (A조)';
                    console.log(`일요일 A조 야간특근 설정: ${emp.name}`);
                  } else if (emp.weekendAssignment.weekendGroup === 'B조') {
                    // 주간 특근: 06:00~18:00 (12시간)
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';        // 기본 8시간
                    overtime = '0';     // 연장 0시간
                    special = '8';      // 특근 8시간
                    specialOvertime = '4'; // 특근연장 4시간
                    note = '일요일 주간특근 (B조)';
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
                    special = '8';      // 특근 8시간
                    specialOvertime = '4'; // 특근연장 4시간
                    note = '일요일 주간특근 (A조)';
                    console.log(`일요일 A조 주간특근 설정: ${emp.name}`);
                  } else if (emp.weekendAssignment.weekendGroup === 'B조') {
                    // 야간 특근: 18:00~06:00 (12시간) + 야간시간 중복
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';        // 기본 8시간
                    overtime = '0';     // 연장 0시간
                    special = '8';      // 특근 8시간
                    specialOvertime = '4'; // 특근연장 4시간
                    night = '8';        // 야간 8시간
                    note = '일요일 야간특근 (B조)';
                    console.log(`일요일 B조 야간특근 설정: ${emp.name}`);
                  }
                }
              } else {
                // weekendGroup 필드가 없는 경우 기본값 설정
                // 보안3팀은 일요일에 기본적으로 주간 특근
                if (cycleWeekForSunday === 2) { // 3주차: 3팀 전체 주간특근
                  status = '출근(주특)';
                  checkIn = '06:00';
                  checkOut = '18:00';
                  basic = '8';        // 기본 8시간
                  overtime = '0';     // 연장 0시간
                  special = '8';      // 특근 8시간
                  specialOvertime = '4'; // 특근연장 4시간
                  note = '일요일 주간특근';
                  console.log(`3팀 기본 일요일 주간특근 설정: ${emp.name}`);
                } else {
                  // 1,2주차: 기본값 없음
                  console.log(`weekendGroup 없음, 기본값 설정 안함: ${emp.name}`);
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
              note = '평일 주간근무';
            } else if (teamNumber === '2') {
              status = '출근(초)';
              checkIn = '14:00';
              checkOut = '22:00';
              basic = '8';
              note = '평일 초야근무';
            } else if (teamNumber === '3') {
              status = '출근(심)';
              checkIn = '22:00';
              checkOut = '06:00';
              basic = '8';
              night = '8';
              note = '평일 심야근무';
            }
          } else if (cycleWeek === 1) { // 2주차: 1팀 심야, 2팀 주간, 3팀 초야
            if (teamNumber === '1') {
              status = '출근(심)';
              checkIn = '22:00';
              checkOut = '06:00';
              basic = '8';
              night = '8';
              note = '평일 심야근무';
            } else if (teamNumber === '2') {
              status = '출근(주)';
              checkIn = '06:00';
              checkOut = '14:00';
              basic = '8';
              note = '평일 주간근무';
            } else if (teamNumber === '3') {
              status = '출근(초)';
              checkIn = '14:00';
              checkOut = '22:00';
              basic = '8';
              note = '평일 초야근무';
            }
          } else if (cycleWeek === 2) { // 3주차: 1팀 초야, 2팀 심야, 3팀 주간
            if (teamNumber === '1') {
              status = '출근(초)';
              checkIn = '14:00';
              checkOut = '22:00';
              basic = '8';
              note = '평일 초야근무';
            } else if (teamNumber === '2') {
              status = '출근(심)';
              checkIn = '22:00';
              checkOut = '06:00';
              basic = '8';
              night = '8';
              note = '평일 심야근무';
            } else if (teamNumber === '3') {
              status = '출근(주)';
              checkIn = '06:00';
              checkOut = '14:00';
              basic = '8';
              note = '평일 주간근무';
            }
          }
        }
      } else {
        // 보안팀이 아닌 경우 (관리팀, 지원팀 등)
        if (isWeekend) {
          // 주말에는 보안팀만 근무, 나머지는 휴무
          status = '휴무';
          basic = '8';
          note = '주말 휴무';
        } else {
          // 평일에는 일반 근무
          status = '출근(주)';
          checkIn = '09:00';
          checkOut = '18:00';
          basic = '8';
          note = '일반 근무';
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
