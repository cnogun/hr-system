const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const WorkSchedule = require('../models/WorkSchedule');
const ExcelJS = require('exceljs');

// 주차 번호 계산 함수
function getWeekNumber(date) {
  const yearStart = new Date(2025, 0, 1, 6, 0, 0); // 2025년 1월 1일 06:00
  const targetDate = new Date(date);
  
  // 월요일 06:00으로 조정
  const dayOfWeek = targetDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const monday6am = new Date(targetDate);
  monday6am.setDate(targetDate.getDate() - mondayOffset);
  monday6am.setHours(6, 0, 0, 0);
  
  const weekDiff = Math.floor((monday6am - yearStart) / (7 * 24 * 60 * 60 * 1000));
  const weekNumber = weekDiff + 2; // 1월 1일 수요일이 1주차, 1월 6일 월요일이 2주차
  
  return weekNumber;
}

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
    for (const emp of employees) {
      if (emp.attendance && emp.attendance.has(date)) {
        // MongoDB Map 타입을 일반 객체로 변환
        const dateData = emp.attendance.get(date);
        attendanceData[emp._id] = dateData;
      } else {
        attendanceData[emp._id] = {};
      }
    }

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
    
    // 올바른 주차 계산 사용
    const weekNumber = getWeekNumber(targetDate);
    
    // 3주 주기 계산 (1주차: 0, 2주차: 1, 3주차: 2)
    let cycleWeek = (weekNumber - 1) % 3; // 0: 1주차, 1: 2주차, 2: 3주차
    
    console.log(`=== 주차 계산 디버깅 ===`);
    console.log(`대상 날짜: ${date}, 요일: ${dayOfWeek} (0:일, 1:월, ..., 6:토)`);
    console.log(`weekNumber: ${weekNumber}, cycleWeek: ${cycleWeek}`);
    console.log(`=== 이번주 팀 근무형태 (${weekNumber}주차) ===`);
    console.log(`1팀: ${cycleWeek === 0 ? '주간' : cycleWeek === 1 ? '초야' : '심야'}`);
    console.log(`2팀: ${cycleWeek === 0 ? '초야' : cycleWeek === 1 ? '심야' : '주간'}`);
    console.log(`3팀: ${cycleWeek === 0 ? '심야' : cycleWeek === 1 ? '주간' : '초야'}`);

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

    for (const emp of employees) {
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
             // 주차별 팀 근무 형태 확인
             const weekNumber = getWeekNumber(targetDate);
             const cycle = (weekNumber - 1) % 3;
             
             let team1Schedule, team2Schedule, team3Schedule;
             if (cycle === 0) {
               team1Schedule = '초야'; team2Schedule = '심야'; team3Schedule = '주간';
             } else if (cycle === 1) {
               team1Schedule = '주간'; team2Schedule = '초야'; team3Schedule = '심야';
             } else {
               team1Schedule = '심야'; team2Schedule = '주간'; team3Schedule = '초야';
             }
             
             // 주말 스케줄에서 조별 편성 명단 조회
             const weekStart = new Date(targetDate);
             weekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1); // 월요일
             weekStart.setHours(6, 0, 0, 0);
             
             const weekEnd = new Date(weekStart);
             weekEnd.setDate(weekStart.getDate() + 6);
             weekEnd.setHours(6, 0, 0, 0);
             
             const schedule = await WorkSchedule.findOne({
               weekStartDate: weekStart,
               weekEndDate: weekEnd,
               status: 'active'
             });
             
             if (schedule && schedule.weekendSchedule) {
               // 조별 편성 명단이 있는 경우
               const teamData = schedule.weekendSchedule[emp.department.replace('보안', 'team')];
               
               if (teamData) {
                 // A조, B조, 1조, 2조, 3조, 4조 명단 파싱
                 const aGroupMembers = teamData.aGroup ? teamData.aGroup.split('\n').filter(line => line.trim()) : [];
                 const bGroupMembers = teamData.bGroup ? teamData.bGroup.split('\n').filter(line => line.trim()) : [];
                 const group1Members = teamData.group1 ? teamData.group1.split('\n').filter(line => line.trim()) : [];
                 const group2Members = teamData.group2 ? teamData.group2.split('\n').filter(line => line.trim()) : [];
                 const group3Members = teamData.group3 ? teamData.group3.split('\n').filter(line => line.trim()) : [];
                 const group4Members = teamData.group4 ? teamData.group4.split('\n').filter(line => line.trim()) : [];
                 
                 // 직원이 어느 조에 속하는지 확인
                 const isInAGroup = aGroupMembers.includes(emp.name);
                 const isInBGroup = bGroupMembers.includes(emp.name);
                 const isInGroup1 = group1Members.includes(emp.name);
                 const isInGroup2 = group2Members.includes(emp.name);
                 const isInGroup3 = group3Members.includes(emp.name);
                 const isInGroup4 = group4Members.includes(emp.name);
                 
                 if (emp.department === '보안1팀') {
                   if (team1Schedule === '초야') {
                     // 1팀이 초야팀일 때: 1조~4조 중 3개조 (30명) - 선택조 1개 제외
                     if (isInGroup1 || isInGroup2 || isInGroup3) {
                       status = '출근(주특)';
                       checkIn = '06:00';
                       checkOut = '18:00';
                       basic = '8';
                       overtime = '0';
                       special = '8';
                       specialOvertime = '4';
                       night = '0';
                       note = getNoteByStatus(status);
                       console.log(`1팀 초야 ${emp.name} 토요일 주간특근 설정`);
                     } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                       note = getNoteByStatus(status);
                       console.log(`1팀 초야 ${emp.name} 토요일 정기휴무 설정`);
                     }
                   } else if (team1Schedule === '심야') {
                     // 1팀이 심야팀일 때: 1조~4조 중 3개조 (30명) - 선택조 1개 제외
                     if (isInGroup1 || isInGroup2 || isInGroup3) {
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                       note = getNoteByStatus(status);
                       console.log(`1팀 심야 ${emp.name} 토요일 야간특근 설정`);
                     } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                       note = getNoteByStatus(status);
                       console.log(`1팀 심야 ${emp.name} 토요일 정기휴무 설정`);
                     }
                   } else {
                     // 1팀이 주간팀일 때: 토요일 휴무
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                     note = getNoteByStatus(status);
                     console.log(`1팀 주간 ${emp.name} 토요일 정기휴무 설정`);
                   }
                 } else if (emp.department === '보안2팀') {
                   if (team2Schedule === '초야') {
                     // 2팀이 초야팀일 때: 1조~4조 중 3개조 (30명) - 선택조 1개 제외
                     if (isInGroup1 || isInGroup2 || isInGroup3) {
                       status = '출근(주특)';
                       checkIn = '06:00';
                       checkOut = '18:00';
                       basic = '8';
                       overtime = '0';
                       special = '8';
                       specialOvertime = '4';
                       night = '0';
                       note = getNoteByStatus(status);
                       console.log(`2팀 초야 ${emp.name} 토요일 주간특근 설정`);
                     } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                       note = getNoteByStatus(status);
                       console.log(`2팀 초야 ${emp.name} 토요일 정기휴무 설정`);
                     }
                   } else if (team2Schedule === '심야') {
                     // 2팀이 심야팀일 때: 1조~4조 중 3개조 (30명) - 선택조 1개 제외
                     if (isInGroup1 || isInGroup2 || isInGroup3) {
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                       note = getNoteByStatus(status);
                       console.log(`2팀 심야 ${emp.name} 토요일 야간특근 설정`);
                     } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                       note = getNoteByStatus(status);
                       console.log(`2팀 심야 ${emp.name} 토요일 정기휴무 설정`);
                     }
                   } else {
                     // 2팀이 주간팀일 때: 토요일 휴무
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                     note = getNoteByStatus(status);
                     console.log(`2팀 주간 ${emp.name} 토요일 정기휴무 설정`);
                   }
                 } else if (emp.department === '보안3팀') {
                   if (team3Schedule === '초야') {
                     // 3팀이 초야팀일 때: 1조~4조 중 3개조 (30명) - 선택조 1개 제외
                     if (isInGroup1 || isInGroup2 || isInGroup3) {
                       status = '출근(주특)';
                       checkIn = '06:00';
                       checkOut = '18:00';
                       basic = '8';
                       overtime = '0';
                       special = '8';
                       specialOvertime = '4';
                       night = '0';
                       note = getNoteByStatus(status);
                       console.log(`3팀 초야 ${emp.name} 토요일 주간특근 설정`);
                     } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                       note = getNoteByStatus(status);
                       console.log(`3팀 초야 ${emp.name} 토요일 정기휴무 설정`);
                     }
                   } else if (team3Schedule === '심야') {
                     // 3팀이 심야팀일 때: 1조~4조 중 3개조 (30명) - 선택조 1개 제외
                     if (isInGroup1 || isInGroup2 || isInGroup3) {
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                       note = getNoteByStatus(status);
                       console.log(`3팀 심야 ${emp.name} 토요일 야간특근 설정`);
                     } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                       note = getNoteByStatus(status);
                       console.log(`3팀 심야 ${emp.name} 토요일 정기휴무 설정`);
                     }
                   } else {
                     // 3팀이 주간팀일 때: 토요일 휴무
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                     note = getNoteByStatus(status);
                     console.log(`3팀 주간 ${emp.name} 토요일 정기휴무 설정`);
                   }
                 }
               } else {
                 // 조별 편성 명단이 없는 경우 기본 로직 사용
                 console.log(`${emp.department} 조별 편성 명단이 없습니다. 기본 로직을 사용합니다.`);
                 status = '정기휴무';
                 basic = '8';
                 note = getNoteByStatus(status);
               }
             } else {
               // 주말 스케줄이 없는 경우 기본 로직 사용
               console.log('주말 스케줄이 없습니다. 기본 로직을 사용합니다.');
               
               // 토요일 기본 로직
               if (emp.department === '보안1팀') {
                 // 1팀은 토요일 정기휴무 (40명)
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                 note = getNoteByStatus(status);
                 console.log(`1팀 ${emp.name} 토요일 정기휴무 설정 (기본 로직)`);
               } else if (emp.department === '보안2팀') {
                 // 2팀은 토요일 1~3조 주간특근 (30명) + 4조 휴무 (10명)
                 const nameMatch = emp.name.match(/(\d+)$/);
                 const nameNumber = nameMatch ? parseInt(nameMatch[1]) : 0;
                 
                 if (nameNumber <= 30) {
                   // 1~30번: 주간특근
                   status = '출근(주특)';
                   checkIn = '06:00';
                   checkOut = '18:00';
                   basic = '8';
                   special = '8';
                   specialOvertime = '4';
                   night = '0';
                   note = getNoteByStatus(status);
                   console.log(`2팀 ${emp.name} 토요일 주간특근 설정 (기본 로직)`);
                 } else {
                   // 31~40번: 휴무
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                   note = getNoteByStatus(status);
                   console.log(`2팀 ${emp.name} 토요일 정기휴무 설정 (기본 로직)`);
                 }
               } else if (emp.department === '보안3팀') {
                 // 3팀은 토요일 1~3조 야간특근 (30명) + 4조 휴무 (10명)
                 const nameMatch = emp.name.match(/(\d+)$/);
                 const nameNumber = nameMatch ? parseInt(nameMatch[1]) : 0;
                 
                 if (nameNumber <= 30) {
                   // 1~30번: 야간특근
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                   note = getNoteByStatus(status);
                   console.log(`3팀 ${emp.name} 토요일 야간특근 설정 (기본 로직)`);
                 } else {
                   // 31~40번: 휴무
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                   note = getNoteByStatus(status);
                   console.log(`3팀 ${emp.name} 토요일 정기휴무 설정 (기본 로직)`);
                 }
               } else {
                 status = '정기휴무';
                 basic = '8';
                 note = getNoteByStatus(status);
               }
             }
           } else if (dayOfWeek === 0) { // 일요일
            // 주차별 팀 근무 형태 확인
            const weekNumber = getWeekNumber(targetDate);
            const cycle = (weekNumber - 1) % 3;
            
            let team1Schedule, team2Schedule, team3Schedule;
            if (cycle === 0) {
              team1Schedule = '초야'; team2Schedule = '심야'; team3Schedule = '주간';
            } else if (cycle === 1) {
              team1Schedule = '주간'; team2Schedule = '초야'; team3Schedule = '심야';
            } else {
              team1Schedule = '심야'; team2Schedule = '주간'; team3Schedule = '초야';
            }
            
            // 주말 스케줄에서 조별 편성 명단 조회
            const weekStart = new Date(targetDate);
            weekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1); // 월요일
            weekStart.setHours(6, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(6, 0, 0, 0);
            
            const schedule = await WorkSchedule.findOne({
              weekStartDate: weekStart,
              weekEndDate: weekEnd,
              status: 'active'
            });
            
            if (schedule && schedule.weekendSchedule) {
              // 조별 편성 명단이 있는 경우
              const teamData = schedule.weekendSchedule[emp.department.replace('보안', 'team')];
              
              if (teamData) {
                // A조, B조, 1조, 2조, 3조, 4조 명단 파싱
                const aGroupMembers = teamData.aGroup ? teamData.aGroup.split('\n').filter(line => line.trim()) : [];
                const bGroupMembers = teamData.bGroup ? teamData.bGroup.split('\n').filter(line => line.trim()) : [];
                const group1Members = teamData.group1 ? teamData.group1.split('\n').filter(line => line.trim()) : [];
                const group2Members = teamData.group2 ? teamData.group2.split('\n').filter(line => line.trim()) : [];
                const group3Members = teamData.group3 ? teamData.group3.split('\n').filter(line => line.trim()) : [];
                const group4Members = teamData.group4 ? teamData.group4.split('\n').filter(line => line.trim()) : [];
                
                // 직원이 어느 조에 속하는지 확인
                const isInAGroup = aGroupMembers.includes(emp.name);
                const isInBGroup = bGroupMembers.includes(emp.name);
                const isInGroup1 = group1Members.includes(emp.name);
                const isInGroup2 = group2Members.includes(emp.name);
                const isInGroup3 = group3Members.includes(emp.name);
                const isInGroup4 = group4Members.includes(emp.name);
                
                if (emp.department === '보안1팀') {
                  if (team1Schedule === '주간') {
                    // 1팀이 주간팀일 때: A조(주간) 또는 B조(야간)
                    if (isInAGroup) {
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';
                      special = '8';
                      specialOvertime = '4';
                      night = '0';
                      note = getNoteByStatus(status);
                      console.log(`1팀 A조 ${emp.name} 일요일 주간특근 설정`);
                    } else if (isInBGroup) {
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                      note = getNoteByStatus(status);
                      console.log(`1팀 B조 ${emp.name} 일요일 야간특근 설정`);
                    } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                      note = getNoteByStatus(status);
                      console.log(`1팀 ${emp.name} 일요일 정기휴무 설정`);
                    }
                  } else if (team1Schedule === '심야') {
                    // 1팀이 심야팀일 때: 2조(선택조) 10명 야간특근
                    if (isInGroup2) {
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                      note = getNoteByStatus(status);
                      console.log(`1팀 2조 ${emp.name} 일요일 야간특근 설정`);
                    } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                      note = getNoteByStatus(status);
                      console.log(`1팀 ${emp.name} 일요일 정기휴무 설정`);
                    }
                  } else {
                    // 1팀이 초야팀일 때: 2조(선택조) 10명 주간특근
                    if (isInGroup2) {
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';
                      special = '8';
                      specialOvertime = '4';
                      night = '0';
                      note = getNoteByStatus(status);
                      console.log(`1팀 2조 ${emp.name} 일요일 주간특근 설정`);
                    } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                      note = getNoteByStatus(status);
                      console.log(`1팀 ${emp.name} 일요일 정기휴무 설정`);
                    }
                  }
                } else if (emp.department === '보안2팀') {
                  if (team2Schedule === '주간') {
                    // 2팀이 주간팀일 때: A조(주간) 또는 B조(야간) - 하지만 일요일은 1조만 근무
                    if (isInGroup1) {
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';
                      special = '8';
                      specialOvertime = '4';
                      night = '0';
                      note = getNoteByStatus(status);
                      console.log(`2팀 1조 ${emp.name} 일요일 주간특근 설정`);
                    } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                      note = getNoteByStatus(status);
                      console.log(`2팀 ${emp.name} 일요일 정기휴무 설정`);
                    }
                  } else if (team2Schedule === '초야') {
                    // 2팀이 초야팀일 때: 1조(선택조) 10명 주간특근
                    if (isInGroup1) {
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';
                      special = '8';
                      specialOvertime = '4';
                      night = '0';
                      note = getNoteByStatus(status);
                      console.log(`2팀 1조 ${emp.name} 일요일 주간특근 설정`);
                    } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                      note = getNoteByStatus(status);
                      console.log(`2팀 ${emp.name} 일요일 정기휴무 설정`);
                    }
                  } else {
                    // 2팀이 심야팀일 때: 1조(선택조) 10명 야간특근
                    if (isInGroup1) {
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                      note = getNoteByStatus(status);
                      console.log(`2팀 1조 ${emp.name} 일요일 야간특근 설정`);
                    } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                      note = getNoteByStatus(status);
                      console.log(`2팀 ${emp.name} 일요일 정기휴무 설정`);
                    }
                  }
                } else if (emp.department === '보안3팀') {
                  if (team3Schedule === '주간') {
                    // 3팀이 주간팀일 때: A조(주간) 또는 B조(야간) - 하지만 일요일은 1조만 근무
                    if (isInGroup1) {
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';
                      special = '8';
                      specialOvertime = '4';
                      night = '0';
                      note = getNoteByStatus(status);
                      console.log(`3팀 1조 ${emp.name} 일요일 주간특근 설정`);
                    } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                      note = getNoteByStatus(status);
                      console.log(`3팀 ${emp.name} 일요일 정기휴무 설정`);
                    }
                  } else if (team3Schedule === '심야') {
                    // 3팀이 심야팀일 때: 1조(선택조) 10명 야간특근
                    if (isInGroup1) {
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                      note = getNoteByStatus(status);
                      console.log(`3팀 1조 ${emp.name} 일요일 야간특근 설정`);
                    } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                      note = getNoteByStatus(status);
                      console.log(`3팀 ${emp.name} 일요일 정기휴무 설정`);
                    }
                  } else {
                    // 3팀이 초야팀일 때: 1조(선택조) 10명 주간특근
                    if (isInGroup1) {
                      status = '출근(주특)';
                      checkIn = '06:00';
                      checkOut = '18:00';
                      basic = '8';
                      special = '8';
                      specialOvertime = '4';
                      night = '0';
                      note = getNoteByStatus(status);
                      console.log(`3팀 1조 ${emp.name} 일요일 주간특근 설정`);
                    } else {
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                      note = getNoteByStatus(status);
                      console.log(`3팀 ${emp.name} 일요일 정기휴무 설정`);
                    }
                  }
                }
              } else {
                // 조별 편성 명단이 없는 경우 기본 로직 사용
                console.log(`${emp.department} 조별 편성 명단이 없습니다. 기본 로직을 사용합니다.`);
                status = '정기휴무';
                basic = '8';
                note = getNoteByStatus(status);
              }
            } else {
              // 주말 스케줄이 없는 경우 기본 로직 사용
              console.log('주말 스케줄이 없습니다. 기본 로직을 사용합니다.');
              
              // 일요일 기본 로직
              if (emp.department === '보안1팀') {
                // 1팀은 일요일 A조 주간특근 (20명) + B조 야간특근 (20명)
                const nameMatch = emp.name.match(/(\d+)$/);
                const nameNumber = nameMatch ? parseInt(nameMatch[1]) : 0;
                
                if (nameNumber <= 20) {
                  // 1~20번: A조 주간특근
                  status = '출근(주특)';
                  checkIn = '06:00';
                  checkOut = '18:00';
                  basic = '8';
                  special = '8';
                  specialOvertime = '4';
                  night = '0';
                  note = getNoteByStatus(status);
                  console.log(`1팀 A조 ${emp.name} 일요일 주간특근 설정 (기본 로직)`);
                } else {
                  // 21~40번: B조 야간특근
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                  note = getNoteByStatus(status);
                  console.log(`1팀 B조 ${emp.name} 일요일 야간특근 설정 (기본 로직)`);
                }
              } else if (emp.department === '보안2팀') {
                // 2팀은 일요일 1조 주간특근 (10명) + 나머지 휴무 (30명)
                const nameMatch = emp.name.match(/(\d+)$/);
                const nameNumber = nameMatch ? parseInt(nameMatch[1]) : 0;
                
                if (nameNumber <= 10) {
                  // 1~10번: 1조 주간특근
                  status = '출근(주특)';
                  checkIn = '06:00';
                  checkOut = '18:00';
                  basic = '8';
                  special = '8';
                  specialOvertime = '4';
                  night = '0';
                  note = getNoteByStatus(status);
                  console.log(`2팀 1조 ${emp.name} 일요일 주간특근 설정 (기본 로직)`);
                } else {
                  // 11~40번: 휴무
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                  note = getNoteByStatus(status);
                  console.log(`2팀 ${emp.name} 일요일 정기휴무 설정 (기본 로직)`);
                }
              } else if (emp.department === '보안3팀') {
                // 3팀은 일요일 1조 야간특근 (10명) + 나머지 휴무 (30명)
                const nameMatch = emp.name.match(/(\d+)$/);
                const nameNumber = nameMatch ? parseInt(nameMatch[1]) : 0;
                
                if (nameNumber <= 10) {
                  // 1~10번: 1조 야간특근
                        status = '출근(야특)';
                        checkIn = '18:00';
                        checkOut = '06:00';
                        basic = '8';
                        overtime = '0';
                        special = '8';
                        specialOvertime = '4';
                        night = '8';
                  note = getNoteByStatus(status);
                  console.log(`3팀 1조 ${emp.name} 일요일 야간특근 설정 (기본 로직)`);
                } else {
                  // 11~40번: 휴무
                        status = '정기휴무';
                        checkIn = '';
                        checkOut = '';
                        basic = '8';
                        overtime = '0';
                        special = '0';
                        specialOvertime = '0';
                        night = '0';
                  note = getNoteByStatus(status);
                  console.log(`3팀 ${emp.name} 일요일 정기휴무 설정 (기본 로직)`);
                }
              } else {
                status = '정기휴무';
                basic = '8';
                note = getNoteByStatus(status);
              }
            }
          }
                 } else {
           // 평일 근무 로직 - 수정된 순환규칙 적용
           if (cycleWeek === 0) { // 1주차: 1팀 주간, 2팀 초야, 3팀 심야
             if (teamNumber === '1') {
               status = '출근(주)';
               checkIn = '06:00';
               checkOut = '14:00';
               basic = '8';
               overtime = '0';
               special = '0';
               specialOvertime = '0';
               night = '0';
               note = getNoteByStatus(status);
             } else if (teamNumber === '2') {
               status = '출근(초)';
               checkIn = '14:00';
               checkOut = '22:00';
               basic = '8';
               overtime = '0';
               special = '0';
               specialOvertime = '0';
               night = '0';
               note = getNoteByStatus(status);
             } else if (teamNumber === '3') {
               status = '출근(심)';
               checkIn = '22:00';
               checkOut = '06:00';
               basic = '8';
               overtime = '0';
               special = '0';
               specialOvertime = '0';
               night = '8';        // 야간 8시간 (원본 시간)
               note = getNoteByStatus(status);
             }
           } else if (cycleWeek === 1) { // 2주차: 1팀 초야, 2팀 심야, 3팀 주간
             if (teamNumber === '1') {
               status = '출근(초)';
               checkIn = '14:00';
               checkOut = '22:00';
               basic = '8';
               overtime = '0';
               special = '0';
               specialOvertime = '0';
               night = '0';
               note = getNoteByStatus(status);
             } else if (teamNumber === '2') {
               status = '출근(심)';
               checkIn = '22:00';
               checkOut = '06:00';
               basic = '8';
               overtime = '0';
               special = '0';
               specialOvertime = '0';
               night = '8';        // 야간 8시간 (원본 시간)
               note = getNoteByStatus(status);
             } else if (teamNumber === '3') {
               status = '출근(주)';
               checkIn = '06:00';
               checkOut = '14:00';
               basic = '8';
               overtime = '0';
               special = '0';
               specialOvertime = '0';
               night = '0';
               note = getNoteByStatus(status);
             }
           } else if (cycleWeek === 2) { // 3주차: 1팀 심야, 2팀 주간, 3팀 초야
             if (teamNumber === '1') {
               status = '출근(심)';
               checkIn = '22:00';
               checkOut = '06:00';
               basic = '8';
               overtime = '0';
               special = '0';
               specialOvertime = '0';
               night = '8';        // 야간 8시간 (원본 시간)
               note = getNoteByStatus(status);
             } else if (teamNumber === '2') {
               status = '출근(주)';
               checkIn = '06:00';
               checkOut = '14:00';
               basic = '8';
               overtime = '0';
               special = '0';
               specialOvertime = '0';
               night = '0';
               note = getNoteByStatus(status);
             } else if (teamNumber === '3') {
               status = '출근(초)';
               checkIn = '14:00';
               checkOut = '22:00';
               basic = '8';
               overtime = '0';
               special = '0';
               specialOvertime = '0';
               night = '0';
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
        // 총시간 계산 (가중치 적용)
        let totalTime = 0;
        if (basic) totalTime += parseInt(basic) || 0;
        if (overtime) totalTime += parseInt(overtime) || 0;
        if (special) totalTime += (parseInt(special) || 0) * 1.5;
        if (specialOvertime) totalTime += (parseInt(specialOvertime) || 0) * 2;
        if (night) totalTime += (parseInt(night) || 0) * 0.5;
        
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
    }

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
