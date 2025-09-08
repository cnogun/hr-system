const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const ExcelJS = require('exceljs');

// 근태 상태에 따라 비고란 자동 설정 함수
function getNoteByStatus(status) {
  switch (status) {
    case '정기휴무':
      return '정기 휴무';
    case '경조휴가':
      return '경조 휴가';
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
    
    // 2025년 1월 1일부터의 주차 계산 (월요일 06시 기준)
    const yearStart = new Date(2025, 0, 1); // 2025년 1월 1일
    
    // 이번주(현재 주)를 3주차로 강제 설정
    let weekNumber;
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // 이번주 월요일
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const targetWeekStart = new Date(targetDate);
    targetWeekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1); // 대상 날짜의 주 월요일
    targetWeekStart.setHours(0, 0, 0, 0);
    
    // 이번주인지 확인 (월요일 기준)
    if (targetWeekStart.getTime() === currentWeekStart.getTime()) {
      weekNumber = 3; // 이번주는 3주차로 설정
    } else if ((targetDate.getFullYear() === 2025 && targetDate.getMonth() === 7 && targetDate.getDate() === 26) ||
               (targetDate.getFullYear() === 2025 && targetDate.getMonth() === 7 && targetDate.getDate() === 30) ||
               (targetDate.getFullYear() === 2025 && targetDate.getMonth() === 8 && targetDate.getDate() === 6) ||
               (targetDate.getFullYear() === 2025 && targetDate.getMonth() === 8 && targetDate.getDate() === 7)) {
      weekNumber = 3; // 특별 날짜들도 3주차로 설정
    } else {
      // 해당 날짜가 속한 주의 월요일 06시를 찾기
      const dayOfWeek = targetDate.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 일요일이면 6, 월요일이면 0
      
      const monday6am = new Date(targetDate);
      monday6am.setDate(targetDate.getDate() - mondayOffset);
      monday6am.setHours(6, 0, 0, 0);
      
      // 2025년 1월 1일(수)부터의 주차 계산
      const weekDiff = Math.floor((monday6am - yearStart) / (7 * 24 * 60 * 60 * 1000));
      weekNumber = weekDiff + 1; // 1부터 시작하는 주차 번호 + 보정값
    }
    
    // 3주 주기 계산 (3주차일 때 1팀 심야, 2팀 주간, 3팀 초야)
    let cycleWeek = weekNumber % 3; // 0: 3주차, 1: 1주차, 2: 2주차
    
    console.log(`=== 주차 계산 디버깅 ===`);
    console.log(`대상 날짜: ${date}, 요일: ${dayOfWeek} (0:일, 1:월, ..., 6:토)`);
    console.log(`이번주 월요일: ${currentWeekStart.toISOString().split('T')[0]}`);
    console.log(`대상 주 월요일: ${targetWeekStart.toISOString().split('T')[0]}`);
    console.log(`weekNumber: ${weekNumber}, cycleWeek: ${cycleWeek}`);
    console.log(`=== 이번주 팀 근무형태 (3주차) ===`);
    console.log(`1팀: ${cycleWeek === 0 ? '심야' : cycleWeek === 1 ? '주간' : '초야'} (22:00~06:00)`);
    console.log(`2팀: ${cycleWeek === 0 ? '주간' : cycleWeek === 1 ? '초야' : '심야'} (06:00~14:00)`);
    console.log(`3팀: ${cycleWeek === 0 ? '초야' : cycleWeek === 1 ? '심야' : '주간'} (14:00~22:00)`);

    // 직원 조회 (부서별 필터링 적용)
    let employeeQuery = { status: '재직' };
    if (department) {
      employeeQuery.department = department;
    }
    const employees = await Employee.find(employeeQuery).sort({ name: 1 });
    
    // 이름 오름차순 정렬을 위한 추가 정렬 (한글 이름 정렬을 위해)
    employees.sort((a, b) => {
      // 보안1팀원, 보안2팀원, 보안3팀원 순서로 정렬
      if (a.department !== b.department) {
        return a.department.localeCompare(b.department, 'ko');
      }
      
      // 같은 부서 내에서는 이름 번호로 정렬
      const aMatch = a.name.match(/(\d+)$/);
      const bMatch = b.name.match(/(\d+)$/);
      
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
      
      // 일반적인 이름 정렬
      return a.name.localeCompare(b.name, 'ko');
    });
    
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
             if (emp.department === '보안1팀') {
               // 보안1팀: 3주차 토요일 1조,3조,4조(30명) 야간특근, 2조(선택조 10명) 정기휴무
               console.log(`1팀 ${emp.name} 토요일 근무 처리 - cycleWeek: ${cycleWeek}`);
               if (cycleWeek === 0) { // 3주차: 심야근무
                 const nameMatch = emp.name.match(/보안1팀원(\d+)/);
                 if (nameMatch) {
                   const memberNumber = parseInt(nameMatch[1]);
                   if (memberNumber >= 11 && memberNumber <= 20) { // 2조(11-20번, 선택조)
                     // 2조(선택조 10명): 정기휴무
                     status = '정기휴무';
                     basic = '8';
                     note = getNoteByStatus(status);
                     console.log(`1팀 2조 토요일 정기휴무 설정: ${emp.name} (선택조 10명)`);
                   } else {
                     // 1조, 3조, 4조(30명): 야간특근
                     status = '출근(야특)';
                     checkIn = '18:00';
                     checkOut = '06:00';
                     basic = '8';        // 기본 8시간
                     overtime = '0';     // 연장 0시간
                     special = '12';     // 특근 12시간 (8×1.5 가중치)
                     specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                     night = '4';        // 야간 4시간 (8×0.5 가중치)
                     note = getNoteByStatus(status);
                     console.log(`1팀 ${emp.name} 토요일 야간특근 설정 (1,3,4조 30명)`);
                   }
                 } else {
                   console.log(`1팀 이름 매칭 안됨, 기본값 설정 안함: ${emp.name}`);
                 }
               } else {
                 console.log(`1팀 weekendGroup 없음, 기본값 설정 안함: ${emp.name}`);
               }
             } else if (emp.department === '보안2팀') {
               // 보안2팀: 3주차 토요일 전원 정기휴무
               console.log(`2팀 ${emp.name} 토요일 근무 처리 - cycleWeek: ${cycleWeek}`);
               if (cycleWeek === 0) { // 3주차: 주간근무
                 status = '정기휴무';
                 basic = '8';
                 note = getNoteByStatus(status);
                 console.log(`2팀 ${emp.name} 토요일 정기휴무 설정 (전원)`);
               } else {
                 console.log(`2팀 weekendGroup 없음, 기본값 설정 안함: ${emp.name}`);
               }
                           } else if (emp.department === '보안3팀') {
                // 보안3팀: 3주차 토요일 1조,3조,4조(30명) 주간특근, 2조(선택조 10명) 정기휴무
                console.log(`3팀 ${emp.name} 토요일 근무 처리 - cycleWeek: ${cycleWeek}`);
                if (cycleWeek === 0) { // 3주차: 초야근무
                  const nameMatch = emp.name.match(/보안3팀원(\d+)/);
                  if (nameMatch) {
                    const memberNumber = parseInt(nameMatch[1]);
                    if (memberNumber >= 11 && memberNumber <= 20) { // 2조(11-20번, 선택조)
                      // 2조(선택조 10명): 정기휴무
                      status = '정기휴무';
                      basic = '8';
                      note = getNoteByStatus(status);
                      console.log(`3팀 2조 토요일 정기휴무 설정: ${emp.name} (선택조 10명)`);
                    } else {
                      // 1조, 3조, 4조(30명): 주간특근
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';        // 기본 8시간
                      overtime = '0';     // 연장 0시간
                      special = '12';     // 특근 12시간 (8×1.5 가중치)
                      specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                      note = getNoteByStatus(status);
                      console.log(`3팀 ${emp.name} 토요일 주간특근 설정 (1,3,4조 30명)`);
                    }
                  } else {
                    console.log(`3팀 이름 매칭 안됨, 기본값 설정 안함: ${emp.name}`);
                  }
                } else {
                  console.log(`3팀 weekendGroup 없음, 기본값 설정 안함: ${emp.name}`);
                }
              }
           } else if (dayOfWeek === 0) { // 일요일
            if (emp.department === '보안1팀') {
              // 보안1팀: 3주차 일요일 2조(선택조 10명) 야간특근
              console.log(`1팀 ${emp.name} 일요일 근무 처리 - cycleWeek: ${cycleWeek}`);
              if (cycleWeek === 0) { // 3주차: 심야근무
                // 1팀은 2조(선택조 10명)만 야간특근, 나머지는 정기휴무
                const nameMatch = emp.name.match(/보안1팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber >= 11 && memberNumber <= 20) { // 2조(11-20번)
                      // 2조(선택조 10명): 야간특근
                      status = '출근(야특)';
                      checkIn = '18:00';
                      checkOut = '06:00';
                      basic = '8';        // 기본 8시간
                      overtime = '0';     // 연장 0시간
                      special = '12';     // 특근 12시간 (8×1.5 가중치)
                      specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                      night = '4';        // 야간 4시간 (8×0.5 가중치)
                    note = getNoteByStatus(status);
                    console.log(`1팀 2조 일요일 야간특근 설정: ${emp.name} (선택조 10명)`);
                  } else {
                    // 1조, 3조, 4조: 정기휴무
                    status = '정기휴무';
                    basic = '8';
                    note = getNoteByStatus(status);
                    console.log(`1팀 ${emp.name} 일요일 정기휴무 설정 (2조가 아님)`);
                  }
                } else {
                  // 이름 매칭 안됨: 기본값 없음
                  console.log(`1팀 이름 매칭 안됨, 기본값 설정 안함: ${emp.name}`);
                }
              } else {
                // 1,2주차: 기본값 없음
                console.log(`1팀 weekendGroup 없음, 기본값 설정 안함: ${emp.name}`);
              }
            } else if (emp.department === '보안2팀') {
              // 보안2팀: 3주차 일요일 A/B조 구분 근무 (주간근무이므로)
              console.log(`2팀 ${emp.name} 일요일 근무 처리 - cycleWeek: ${cycleWeek}`);
              if (cycleWeek === 0) { // 3주차: 주간근무
                // 2팀도 A조/B조 구분이 필요함
                // 임시로 이름 기준으로 A조/B조 구분 (실제로는 weekendGroup 필드 필요)
                const memberIndex = ['보안2팀원1', '보안2팀원2', '보안2팀원3', '보안2팀원4', '보안2팀원5', '보안2팀원6', '보안2팀원7', '보안2팀원8', '보안2팀원9', '보안2팀원10', '보안2팀원11', '보안2팀원12', '보안2팀원13', '보안2팀원14', '보안2팀원15', '보안2팀원16', '보안2팀원17', '보안2팀원18', '보안2팀원19', '보안2팀원20', '보안2팀원21', '보안2팀원22', '보안2팀원23', '보안2팀원24', '보안2팀원25', '보안2팀원26', '보안2팀원27', '보안2팀원28', '보안2팀원29', '보안2팀원30', '보안2팀원31', '보안2팀원32', '보안2팀원33', '보안2팀원34', '보안2팀원35', '보안2팀원36', '보안2팀원37', '보안2팀원38', '보안2팀원39', '보안2팀원40'].indexOf(emp.name);
                
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
                    console.log(`2팀 A조 일요일 주간특근 설정: ${emp.name}`);
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
                    console.log(`2팀 B조 일요일 야간특근 설정: ${emp.name}`);
                  }
                } else {
                  // 이름 매칭 안됨: 기본값 없음
                  console.log(`2팀 이름 매칭 안됨, 기본값 설정 안함: ${emp.name}`);
                }
              } else {
                // 1,2주차: 기본값 없음
                console.log(`2팀 weekendGroup 없음, 기본값 설정 안함: ${emp.name}`);
              }
                         } else if (emp.department === '보안3팀') {
               // 보안3팀: 3주차 일요일 2조(선택조 10명) 주간특근, 나머지 30명 정기휴무
               console.log(`3팀 ${emp.name} 일요일 근무 처리 - cycleWeek: ${cycleWeek}`);
               if (cycleWeek === 0) { // 3주차: 초야근무
                 const nameMatch = emp.name.match(/보안3팀원(\d+)/);
                 if (nameMatch) {
                   const memberNumber = parseInt(nameMatch[1]);
                   if (memberNumber >= 11 && memberNumber <= 20) { // 2조(11-20번, 선택조)
                     // 2조(선택조 10명): 주간특근
                     status = '출근(주특)';
                     checkIn = '06:00';
                     checkOut = '18:00';
                     basic = '8';        // 기본 8시간
                     overtime = '0';     // 연장 0시간
                     special = '12';     // 특근 12시간 (8×1.5 가중치)
                     specialOvertime = '8'; // 특근연장 8시간 (4×2.0 가중치)
                     note = getNoteByStatus(status);
                     console.log(`3팀 2조 일요일 주간특근 설정: ${emp.name} (선택조 10명)`);
                   } else {
                     // 1조, 3조, 4조(30명): 정기휴무
                     status = '정기휴무';
                     basic = '8';
                     note = getNoteByStatus(status);
                     console.log(`3팀 ${emp.name} 일요일 정기휴무 설정 (2조가 아님)`);
                   }
                 } else {
                   // 이름 매칭 안됨: 기본값 없음
                   console.log(`3팀 이름 매칭 안됨, 기본값 설정 안함: ${emp.name}`);
                 }
               } else {
                 // 1,2주차: 기본값 없음
                 console.log(`3팀 weekendGroup 없음, 기본값 설정 안함: ${emp.name}`);
               }
             }
          }
                 } else {
           // 평일 근무 로직 - 수정된 순환규칙 적용
           if (cycleWeek === 0) { // 37주차: 1팀 초야, 2팀 심야, 3팀 주간
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
           } else if (cycleWeek === 1) { // 38주차: 1팀 주간, 2팀 초야, 3팀 심야
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
           } else if (cycleWeek === 2) { // 39주차: 1팀 심야, 2팀 주간, 3팀 초야
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

// 근태 데이터 엑셀 내보내기
router.get('/excel/export', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const { date, department } = req.query;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('근태 데이터');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '이름', key: 'name', width: 15 },
      { header: '부서', key: 'department', width: 15 },
      { header: '직급', key: 'position', width: 15 },
      { header: '근태상태', key: 'status', width: 15 },
      { header: '출근시간', key: 'checkIn', width: 15 },
      { header: '퇴근시간', key: 'checkOut', width: 15 },
      { header: '기본시간', key: 'basicHours', width: 12 },
      { header: '연장시간', key: 'overtime', width: 12 },
      { header: '특근시간', key: 'specialWork', width: 12 },
      { header: '특연시간', key: 'specialOvertime', width: 12 },
      { header: '야간시간', key: 'nightHours', width: 12 },
      { header: '총시간', key: 'totalHours', width: 12 },
      { header: '비고', key: 'note', width: 20 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 직원 데이터 가져오기
    let query = {};
    if (department) {
      query.department = department;
    }
    
    const employees = await Employee.find(query).sort({ name: 1 });
    
    // 샘플 근태 데이터 추가
    employees.forEach(employee => {
      worksheet.addRow({
        name: employee.name,
        department: employee.department,
        position: employee.position,
        status: '출근(주)',
        checkIn: '09:00',
        checkOut: '18:00',
        basicHours: 8,
        overtime: 0,
        specialWork: 0,
        specialOvertime: 0,
        nightHours: 0,
        totalHours: 8,
        note: '정상 출근'
      });
    });

    // 파일명 설정
    const fileName = `근태데이터_${date || new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('근태 데이터 내보내기 오류:', error);
    res.status(500).json({ success: false, message: '데이터 내보내기 중 오류가 발생했습니다.' });
  }
});

// 근태 보고서 엑셀 다운로드
router.get('/report/excel', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ success: false, message: '월 정보가 필요합니다.' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('근태 보고서');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '부서', key: 'department', width: 15 },
      { header: '직원수', key: 'employeeCount', width: 12 },
      { header: '총 근무일수', key: 'totalWorkDays', width: 15 },
      { header: '평균 근무시간', key: 'avgWorkHours', width: 15 },
      { header: '총 연장시간', key: 'totalOvertime', width: 15 },
      { header: '총 특근시간', key: 'totalSpecialWork', width: 15 },
      { header: '총 야간시간', key: 'totalNightHours', width: 15 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 부서별 통계 데이터 추가 (샘플)
    const departments = ['보안1팀', '보안2팀', '보안3팀'];
    
    departments.forEach(dept => {
      worksheet.addRow({
        department: dept,
        employeeCount: 40,
        totalWorkDays: 22,
        avgWorkHours: 8.5,
        totalOvertime: 120,
        totalSpecialWork: 80,
        totalNightHours: 200
      });
    });

    // 파일명 설정
    const fileName = `근태보고서_${month}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('근태 보고서 다운로드 오류:', error);
    res.status(500).json({ success: false, message: '보고서 다운로드 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
