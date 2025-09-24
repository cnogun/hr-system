const express = require('express');
const router = express.Router();
const WorkSchedule = require('../models/WorkSchedule');
const WorkScheduleService = require('../services/workScheduleService');
const Employee = require('../models/Employee');
const ExcelJS = require('exceljs');

// 근무 스케줄 관리 페이지 렌더링
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

    res.render('workSchedule', {
      session: req.session
    });

  } catch (error) {
    console.error('근무 스케줄 페이지 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('근무 스케줄 페이지 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// 현재 주차 정보 조회
router.get('/current-week', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const today = new Date();
    const weekStart = WorkScheduleService.getWeekStart(today);
    const weekEnd = WorkScheduleService.getWeekEnd(today);
    
    // 현재 주차 스케줄 조회
    const schedule = await WorkSchedule.findOne({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: 'active'
    });
    
    if (schedule) {
      res.json({ success: true, data: schedule });
    } else {
      res.json({ success: false, message: '현재 주차 스케줄이 없습니다.' });
    }
    
  } catch (error) {
    console.error('현재 주차 정보 조회 오류:', error);
    res.status(500).json({ success: false, message: '현재 주차 정보 조회 중 오류가 발생했습니다.' });
  }
});

// 이번주 스케줄 생성
router.post('/create-current-week', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    // 현재 주차 스케줄 생성
    const schedule = await WorkScheduleService.createCurrentWeekSchedule(req.session.userId);
    
    res.json({ 
      success: true, 
      message: '이번주 근무 스케줄이 생성되었습니다.',
      data: schedule
    });
    
  } catch (error) {
    console.error('이번주 스케줄 생성 오류:', error);
    res.status(500).json({ success: false, message: '이번주 스케줄 생성 중 오류가 발생했습니다.' });
  }
});

// 주말 스케줄 저장
router.post('/save-weekend', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    const weekendData = req.body;
    
    // 현재 주차 스케줄 찾기
    const today = new Date();
    const weekStart = WorkScheduleService.getWeekStart(today);
    const weekEnd = WorkScheduleService.getWeekEnd(today);
    
    let schedule = await WorkSchedule.findOne({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: 'active'
    });
    
    if (!schedule) {
      // 스케줄이 없으면 생성
        schedule = await WorkScheduleService.createCurrentWeekSchedule(req.session.userId);
    }
    
    // 주말 스케줄 업데이트 (팀별 조별 편성 명단)
    // 기존 weekendSchedule 구조 유지하면서 새로운 팀 데이터만 추가
    if (!schedule.weekendSchedule) {
      schedule.weekendSchedule = {};
    }
    
    // 기존 saturday, sunday 구조 유지
    if (!schedule.weekendSchedule.saturday) {
      schedule.weekendSchedule.saturday = {
        dayShift: { team1Count: 0, team3Count: 0 },
        nightShift: { team2Count: 0, team3Count: 0 }
      };
    }
    
    if (!schedule.weekendSchedule.sunday) {
      schedule.weekendSchedule.sunday = {
        dayShift: { team1Count: 0, team3Count: 0 },
        nightShift: { team2Count: 0, team3Count: 0 }
      };
    }
    
    // 새로운 팀별 조별 편성 명단 추가
    schedule.weekendSchedule.team1 = weekendData.team1;
    schedule.weekendSchedule.team2 = weekendData.team2;
    schedule.weekendSchedule.team3 = weekendData.team3;
    
    await schedule.save();
    
    // 편성 인원 현황도 함께 업데이트 및 근태 자동입력
    await updateAssignmentCounts(weekendData);
    
    res.json({ 
      success: true, 
      message: '주말 스케줄이 저장되었습니다. 근태 자동입력이 완료되었습니다.',
      data: schedule
    });
    
  } catch (error) {
    console.error('주말 스케줄 저장 오류:', error);
    res.status(500).json({ success: false, message: '주말 스케줄 저장 중 오류가 발생했습니다.' });
  }
});

// 공휴일 추가
router.post('/add-holiday', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    const { date, name, specialWorkType } = req.body;
    
    if (!date || !name) {
      return res.status(400).json({ success: false, message: '공휴일과 공휴일명을 입력해주세요.' });
    }
    
    // 현재 주차 스케줄 찾기
    const today = new Date();
    const weekStart = WorkScheduleService.getWeekStart(today);
    const weekEnd = WorkScheduleService.getWeekEnd(today);
    
    let schedule = await WorkSchedule.findOne({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: 'active'
    });
    
    if (!schedule) {
      // 스케줄이 없으면 생성
      schedule = await WorkScheduleService.createCurrentWeekSchedule(req.session.userId);
    }
    
    // 공휴일 정보 추가
    const holidayDate = new Date(date);
    const isWeekday = holidayDate.getDay() >= 1 && holidayDate.getDay() <= 5;
    
    schedule.holidays.push({
      date: holidayDate,
      name: name,
      isWeekday: isWeekday,
      specialWorkType: specialWorkType
    });
    
    await schedule.save();
    
    res.json({ 
      success: true, 
      message: '공휴일이 추가되었습니다.',
      data: schedule
    });
    
  } catch (error) {
    console.error('공휴일 추가 오류:', error);
    res.status(500).json({ success: false, message: '공휴일 추가 중 오류가 발생했습니다.' });
  }
});

// 주말 근태 자동입력 상태 확인
router.get('/weekend-attendance-status', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    // 현재 주차의 토요일, 일요일 날짜 계산
    const today = new Date();
    const weekStart = WorkScheduleService.getWeekStart(today);
    const weekEnd = WorkScheduleService.getWeekEnd(today);
    
    const saturday = new Date(weekStart);
    saturday.setDate(weekStart.getDate() + (5 - weekStart.getDay() + 7) % 7);
    
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    
    const saturdayStr = saturday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    // 보안팀 직원들의 주말 근태 상태 조회
    const securityEmployees = await Employee.find({
      department: { $regex: /^보안/ }
    }).select('name department weekendAssignment attendance');

    const attendanceStatus = {
      saturday: { date: saturdayStr, employees: [] },
      sunday: { date: sundayStr, employees: [] }
    };

    for (const employee of securityEmployees) {
      // 토요일 근태 상태
      const satAttendance = employee.attendance[saturdayStr];
      attendanceStatus.saturday.employees.push({
        name: employee.name,
        department: employee.department,
        status: satAttendance ? satAttendance.status : '미설정',
        weekendAssignment: employee.weekendAssignment
      });

      // 일요일 근태 상태
      const sunAttendance = employee.attendance[sundayStr];
      attendanceStatus.sunday.employees.push({
        name: employee.name,
        department: employee.department,
        status: sunAttendance ? sunAttendance.status : '미설정',
        weekendAssignment: employee.weekendAssignment
      });
    }

    res.json({
      success: true,
      data: attendanceStatus
    });

  } catch (error) {
    console.error('주말 근태 상태 조회 오류:', error);
    res.status(500).json({ success: false, message: '주말 근태 상태 조회 중 오류가 발생했습니다.' });
  }
});

// 공휴일 삭제
router.delete('/delete-holiday/:holidayId', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    const { holidayId } = req.params;
    
    // 현재 주차 스케줄 찾기
    const today = new Date();
    const weekStart = WorkScheduleService.getWeekStart(today);
    const weekEnd = WorkScheduleService.getWeekEnd(today);
    
    const schedule = await WorkSchedule.findOne({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: 'active'
    });
    
    if (!schedule) {
      return res.status(404).json({ success: false, message: '현재 주차 스케줄을 찾을 수 없습니다.' });
    }

    // 공휴일 삭제
    schedule.holidays = schedule.holidays.filter(holiday => 
      holiday._id.toString() !== holidayId
    );

    await schedule.save();

    res.json({ 
      success: true, 
      message: '공휴일이 삭제되었습니다.',
      data: schedule
    });
    
  } catch (error) {
    console.error('공휴일 삭제 오류:', error);
    res.status(500).json({ success: false, message: '공휴일 삭제 중 오류가 발생했습니다.' });
  }
});

// 편성 인원 현황 조회
router.get('/assignment-counts', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 현재 주차의 주말 스케줄 조회
    const currentWeek = WorkScheduleService.getWeekStart(new Date());
    const schedule = await WorkSchedule.findOne({
      weekStartDate: { $lte: currentWeek },
      weekEndDate: { $gte: currentWeek }
    });

    if (!schedule || !schedule.weekendSchedule) {
      return res.json({
        success: true,
        data: {
          saturdayDayCount: 0,
          saturdayNightCount: 0,
          sundayDayCount: 0,
          sundayNightCount: 0,
          team1ACount: 0,
          team1BCount: 0,
          team1GroupsCount: 0,
          team2ACount: 0,
          team2BCount: 0,
          team2GroupsCount: 0,
          team3ACount: 0,
          team3BCount: 0,
          team3GroupsCount: 0
        }
      });
    }

    const weekendSchedule = schedule.weekendSchedule;
    
    // 팀별 조별 인원 수 계산
    const counts = {
      saturdayDayCount: 0,
      saturdayNightCount: 0,
      sundayDayCount: 0,
      sundayNightCount: 0,
      team1ACount: 0,
      team1BCount: 0,
      team1GroupsCount: 0,
      team2ACount: 0,
      team2BCount: 0,
      team2GroupsCount: 0,
      team3ACount: 0,
      team3BCount: 0,
      team3GroupsCount: 0
    };

    // 보안1팀 계산
    if (weekendSchedule.team1) {
      counts.team1ACount = weekendSchedule.team1.aGroup ? weekendSchedule.team1.aGroup.split('\n').filter(line => line.trim()).length : 0;
      counts.team1BCount = weekendSchedule.team1.bGroup ? weekendSchedule.team1.bGroup.split('\n').filter(line => line.trim()).length : 0;
      counts.team1GroupsCount = (
        (weekendSchedule.team1.group1 ? weekendSchedule.team1.group1.split('\n').filter(line => line.trim()).length : 0) +
        (weekendSchedule.team1.group2 ? weekendSchedule.team1.group2.split('\n').filter(line => line.trim()).length : 0) +
        (weekendSchedule.team1.group3 ? weekendSchedule.team1.group3.split('\n').filter(line => line.trim()).length : 0) +
        (weekendSchedule.team1.group4 ? weekendSchedule.team1.group4.split('\n').filter(line => line.trim()).length : 0)
      );
    }

    // 보안2팀 계산
    if (weekendSchedule.team2) {
      counts.team2ACount = weekendSchedule.team2.aGroup ? weekendSchedule.team2.aGroup.split('\n').filter(line => line.trim()).length : 0;
      counts.team2BCount = weekendSchedule.team2.bGroup ? weekendSchedule.team2.bGroup.split('\n').filter(line => line.trim()).length : 0;
      counts.team2GroupsCount = (
        (weekendSchedule.team2.group1 ? weekendSchedule.team2.group1.split('\n').filter(line => line.trim()).length : 0) +
        (weekendSchedule.team2.group2 ? weekendSchedule.team2.group2.split('\n').filter(line => line.trim()).length : 0) +
        (weekendSchedule.team2.group3 ? weekendSchedule.team2.group3.split('\n').filter(line => line.trim()).length : 0) +
        (weekendSchedule.team2.group4 ? weekendSchedule.team2.group4.split('\n').filter(line => line.trim()).length : 0)
      );
    }

    // 보안3팀 계산
    if (weekendSchedule.team3) {
      counts.team3ACount = weekendSchedule.team3.aGroup ? weekendSchedule.team3.aGroup.split('\n').filter(line => line.trim()).length : 0;
      counts.team3BCount = weekendSchedule.team3.bGroup ? weekendSchedule.team3.bGroup.split('\n').filter(line => line.trim()).length : 0;
      counts.team3GroupsCount = (
        (weekendSchedule.team3.group1 ? weekendSchedule.team3.group1.split('\n').filter(line => line.trim()).length : 0) +
        (weekendSchedule.team3.group2 ? weekendSchedule.team3.group2.split('\n').filter(line => line.trim()).length : 0) +
        (weekendSchedule.team3.group3 ? weekendSchedule.team3.group3.split('\n').filter(line => line.trim()).length : 0) +
        (weekendSchedule.team3.group4 ? weekendSchedule.team3.group4.split('\n').filter(line => line.trim()).length : 0)
      );
    }

         // 주말 근무 인원 계산 (이번주 기준: 1팀 주간, 2팀 초야, 3팀 심야)
         // 토요일 주간: 2팀 초야조 (1~4조 중 3개조)
         counts.saturdayDayCount = Math.min(counts.team2GroupsCount, 30);
         
         // 토요일 야간: 1팀, 3팀 심야조 (1~4조 중 3개조씩)
         counts.saturdayNightCount = Math.min(counts.team1GroupsCount + counts.team3GroupsCount, 30);
         
         // 일요일 주간: 1팀 A조 + 2팀 1조 (실제 인원 수 기반)
         const team2Group1Count = weekendSchedule.team2 && weekendSchedule.team2.group1 ? 
           weekendSchedule.team2.group1.split('\n').filter(line => line.trim()).length : 0;
         counts.sundayDayCount = Math.min(counts.team1ACount + team2Group1Count, 30);
         
         // 일요일 야간: 1팀 B조 + 3팀 1조 (실제 인원 수 기반)
         const team3Group1Count = weekendSchedule.team3 && weekendSchedule.team3.group1 ? 
           weekendSchedule.team3.group1.split('\n').filter(line => line.trim()).length : 0;
         counts.sundayNightCount = Math.min(counts.team1BCount + team3Group1Count, 30);

    res.json({
      success: true,
      data: counts
    });

  } catch (error) {
    console.error('편성 인원 현황 조회 오류:', error);
    res.status(500).json({ success: false, message: '편성 인원 현황 조회 중 오류가 발생했습니다.' });
  }
});

// 편성 인원 현황 업데이트 및 근태 자동입력 (내부 함수)
async function updateAssignmentCounts(weekendData) {
  try {
    console.log('=== updateAssignmentCounts 시작 ===');
    console.log('weekendData:', weekendData);
    
    // 각 팀별로 편성 명단을 기반으로 weekendAssignment 업데이트
    const teams = ['team1', 'team2', 'team3'];
    
    // 현재 주차의 토요일, 일요일 날짜 계산
    const today = new Date();
    const weekStart = WorkScheduleService.getWeekStart(today);
    const weekEnd = WorkScheduleService.getWeekEnd(today);
    
    // 토요일과 일요일 날짜 찾기
    const saturday = new Date(weekStart);
    saturday.setDate(weekStart.getDate() + 5); // 월요일 + 5일 = 토요일
    
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1); // 토요일 + 1일 = 일요일
    
    // 날짜 형식 변환 (YYYY-MM-DD)
    const saturdayStr = saturday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];
    
    console.log('주말 날짜 계산:', { saturday: saturdayStr, sunday: sundayStr });
    
    for (const team of teams) {
      try {
        console.log(`=== ${team} 처리 시작 ===`);
        const teamData = weekendData[team];
        if (!teamData) {
          console.log(`${team} 데이터가 없습니다.`);
          continue;
        }
        
        console.log(`${team} 데이터:`, teamData);
        
        // A조, B조 명단 파싱
        const aGroupMembers = teamData.aGroup ? teamData.aGroup.split('\n').filter(line => line.trim()) : [];
        const bGroupMembers = teamData.bGroup ? teamData.bGroup.split('\n').filter(line => line.trim()) : [];
        
        // 1조, 2조, 3조, 4조 명단 파싱
        const group1Members = teamData.group1 ? teamData.group1.split('\n').filter(line => line.trim()) : [];
        const group2Members = teamData.group2 ? teamData.group2.split('\n').filter(line => line.trim()) : [];
        const group3Members = teamData.group3 ? teamData.group3.split('\n').filter(line => line.trim()) : [];
        const group4Members = teamData.group4 ? teamData.group4.split('\n').filter(line => line.trim()) : [];
        
        console.log(`${team} 파싱된 명단:`, {
          aGroup: aGroupMembers.length,
          bGroup: bGroupMembers.length,
          group1: group1Members.length,
          group2: group2Members.length,
          group3: group3Members.length,
          group4: group4Members.length
        });
      
        // 각 직원의 weekendAssignment 업데이트 및 근태 자동입력
        for (const member of aGroupMembers) {
          try {
            await Employee.updateOne(
              { name: member.trim() },
              { 
                $set: {
                  'weekendAssignment.group': 'none',
                  'weekendAssignment.weekendGroup': 'A조',
                  'weekendAssignment.sundayGroup': 'none'
                }
              }
            );
            
            // 일요일 주간근무 근태 자동입력
            await updateAttendanceStatus(member.trim(), sundayStr, '일요일특근');
            console.log(`A조 ${member.trim()} 처리 완료`);
          } catch (error) {
            console.error(`A조 ${member.trim()} 처리 오류:`, error);
          }
        }
      
        for (const member of bGroupMembers) {
          try {
            await Employee.updateOne(
              { name: member.trim() },
              { 
                $set: {
                  'weekendAssignment.group': 'none',
                  'weekendAssignment.weekendGroup': 'B조',
                  'weekendAssignment.sundayGroup': 'none'
                }
              }
            );
            
            // 일요일 야간근무 근태 자동입력
            await updateAttendanceStatus(member.trim(), sundayStr, '일요일야간특근');
            console.log(`B조 ${member.trim()} 처리 완료`);
          } catch (error) {
            console.error(`B조 ${member.trim()} 처리 오류:`, error);
          }
        }
        
        for (const member of group1Members) {
          try {
            await Employee.updateOne(
              { name: member.trim() },
              { 
                $set: {
                  'weekendAssignment.group': '1/4',
                  'weekendAssignment.weekendGroup': 'none',
                  'weekendAssignment.sundayGroup': '1조'
                }
              }
            );
            
            // 1조는 토요일과 일요일 모두 근무
            await updateAttendanceStatus(member.trim(), saturdayStr, '토요일특근');
            await updateAttendanceStatus(member.trim(), sundayStr, '일요일특근');
            console.log(`1조 ${member.trim()} 처리 완료`);
          } catch (error) {
            console.error(`1조 ${member.trim()} 처리 오류:`, error);
          }
        }
        
        for (const member of group2Members) {
          try {
            await Employee.updateOne(
              { name: member.trim() },
              { 
                $set: {
                  'weekendAssignment.group': '1/4',
                  'weekendAssignment.weekendGroup': 'none',
                  'weekendAssignment.sundayGroup': '2조'
                }
              }
            );
            
            // 2조는 토요일과 일요일 모두 근무
            await updateAttendanceStatus(member.trim(), saturdayStr, '토요일특근');
            await updateAttendanceStatus(member.trim(), sundayStr, '일요일특근');
            console.log(`2조 ${member.trim()} 처리 완료`);
          } catch (error) {
            console.error(`2조 ${member.trim()} 처리 오류:`, error);
          }
        }
        
        for (const member of group3Members) {
          try {
            await Employee.updateOne(
              { name: member.trim() },
              { 
                $set: {
                  'weekendAssignment.group': '3/4',
                  'weekendAssignment.weekendGroup': 'none',
                  'weekendAssignment.sundayGroup': '3조'
                }
              }
            );
            
            // 3조는 토요일과 일요일 모두 근무
            await updateAttendanceStatus(member.trim(), saturdayStr, '토요일특근');
            await updateAttendanceStatus(member.trim(), sundayStr, '일요일특근');
            console.log(`3조 ${member.trim()} 처리 완료`);
          } catch (error) {
            console.error(`3조 ${member.trim()} 처리 오류:`, error);
          }
        }
        
        for (const member of group4Members) {
          try {
            await Employee.updateOne(
              { name: member.trim() },
              { 
                $set: {
                  'weekendAssignment.group': '3/4',
                  'weekendAssignment.weekendGroup': 'none',
                  'weekendAssignment.sundayGroup': '4조'
                }
              }
            );
            
            // 4조는 토요일과 일요일 모두 근무
            await updateAttendanceStatus(member.trim(), saturdayStr, '토요일특근');
            await updateAttendanceStatus(member.trim(), sundayStr, '일요일특근');
            console.log(`4조 ${member.trim()} 처리 완료`);
          } catch (error) {
            console.error(`4조 ${member.trim()} 처리 오류:`, error);
          }
        }
        
        console.log(`=== ${team} 처리 완료 ===`);
      } catch (error) {
        console.error(`${team} 처리 중 오류:`, error);
      }
    }
    
    // 주말에 근무하지 않는 직원들의 근태를 정기휴무로 설정
    try {
      await updateNonWorkingEmployees(saturdayStr, sundayStr);
      console.log('=== updateAssignmentCounts 완료 ===');
    } catch (error) {
      console.error('비근무 직원 처리 오류:', error);
    }
    
  } catch (error) {
    console.error('편성 인원 현황 업데이트 오류:', error);
    throw error; // 에러를 상위로 전파
  }
}

// 근태 상태 업데이트 함수
async function updateAttendanceStatus(employeeName, date, status) {
  try {
    const employee = await Employee.findOne({ name: employeeName });
    if (!employee) {
      console.log(`직원을 찾을 수 없음: ${employeeName}`);
      return;
    }
    
    // attendance 필드가 없으면 초기화
    if (!employee.attendance) {
      employee.attendance = {};
    }
    
    // 해당 날짜의 근태 상태 업데이트
    employee.attendance[date] = {
      status: status,
      checkIn: status.includes('야간') ? '18:00' : '06:00',
      checkOut: status.includes('야간') ? '06:00' : '18:00',
      basic: status.includes('야간') ? '8' : '8',
      overtime: '0',
      nightTime: status.includes('야간') ? '8' : '0',
      updatedAt: new Date()
    };
    
    await employee.save();
    console.log(`${employeeName}의 ${date} 근태 상태가 ${status}로 업데이트되었습니다.`);
    
  } catch (error) {
    console.error(`${employeeName}의 근태 상태 업데이트 오류:`, error);
  }
}

// 주말에 근무하지 않는 직원들의 근태를 정기휴무로 설정
async function updateNonWorkingEmployees(saturdayStr, sundayStr) {
  try {
    // 보안팀 직원들 조회
    const securityEmployees = await Employee.find({
      department: { $regex: /^보안/ }
    });
    
    for (const employee of securityEmployees) {
      // 주말 할당이 없는 직원들만 처리
      if (!employee.weekendAssignment || 
          (employee.weekendAssignment.group === 'none' && 
           employee.weekendAssignment.weekendGroup === 'none' && 
           employee.weekendAssignment.sundayGroup === 'none')) {
        
        // 토요일과 일요일을 정기휴무로 설정
        await updateAttendanceStatus(employee.name, saturdayStr, '정기휴무');
        await updateAttendanceStatus(employee.name, sundayStr, '정기휴무');
      }
    }
    
    console.log('주말 근무하지 않는 직원들의 근태가 정기휴무로 설정되었습니다.');
    
  } catch (error) {
    console.error('비근무 직원 근태 설정 오류:', error);
  }
}

// 팀별 조별 편성 명단 자동 생성
router.post('/generate-personnel/:team', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    const { team } = req.params;
    const teamNumber = team.replace('team', '');
    
    // 팀별 조별 편성 명단 자동 생성
    const personnelData = generateTeamPersonnelData(teamNumber);
    
    res.json({
      success: true,
      message: `보안${teamNumber}팀의 조별 편성 명단이 자동 생성되었습니다.`,
      data: personnelData
    });

  } catch (error) {
    console.error('팀별 편성 명단 자동 생성 오류:', error);
    res.status(500).json({ success: false, message: '팀별 편성 명단 자동 생성 중 오류가 발생했습니다.' });
  }
});

// 전체 팀 조별 편성 명단 자동 생성
router.post('/generate-all-teams', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    // 모든 팀의 조별 편성 명단 자동 생성
    const allTeamsData = {
      team1: generateTeamPersonnelData('1'),
      team2: generateTeamPersonnelData('2'),
      team3: generateTeamPersonnelData('3')
    };
    
    res.json({
      success: true,
      message: '모든 팀의 조별 편성 명단이 자동 생성되었습니다.',
      data: allTeamsData
    });

  } catch (error) {
    console.error('전체 팀 편성 명단 자동 생성 오류:', error);
    res.status(500).json({ success: false, message: '전체 팀 편성 명단 자동 생성 중 오류가 발생했습니다.' });
  }
});

// 팀별 조별 편성 명단 데이터 생성 함수
function generateTeamPersonnelData(teamNumber) {
  const aGroup = [];
  const bGroup = [];
  const group1 = [];
  const group2 = [];
  const group3 = [];
  const group4 = [];

  // A조: 1번~20번
  for (let i = 1; i <= 20; i++) {
    aGroup.push(`보안${teamNumber}팀원${i}번`);
  }

  // B조: 21번~40번
  for (let i = 21; i <= 40; i++) {
    bGroup.push(`보안${teamNumber}팀원${i}번`);
  }

  // 1조: 1번~10번
  for (let i = 1; i <= 10; i++) {
    group1.push(`보안${teamNumber}팀원${i}번`);
  }

  // 2조: 11번~20번
  for (let i = 11; i <= 20; i++) {
    group2.push(`보안${teamNumber}팀원${i}번`);
  }

  // 3조: 21번~30번
  for (let i = 21; i <= 30; i++) {
    group3.push(`보안${teamNumber}팀원${i}번`);
  }

  // 4조: 31번~40번
  for (let i = 31; i <= 40; i++) {
    group4.push(`보안${teamNumber}팀원${i}번`);
  }
  
  return {
    aGroup: aGroup.join('\n'),
    bGroup: bGroup.join('\n'),
    group1: group1.join('\n'),
    group2: group2.join('\n'),
    group3: group3.join('\n'),
    group4: group4.join('\n')
  };
}

// 근무 스케줄 엑셀 템플릿 다운로드
router.get('/excel/template', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('근무 스케줄 템플릿');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '날짜', key: 'date', width: 15 },
      { header: '요일', key: 'dayOfWeek', width: 10 },
      { header: '보안1팀', key: 'team1', width: 20 },
      { header: '보안2팀', key: 'team2', width: 20 },
      { header: '보안3팀', key: 'team3', width: 20 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 샘플 데이터 추가
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = dayNames[date.getDay()];
      
      worksheet.addRow({
        date: date.toISOString().split('T')[0],
        dayOfWeek: dayOfWeek,
        team1: '주간/심야/초야',
        team2: '심야/초야/주간',
        team3: '초야/주간/심야'
      });
    }

    // 파일명 설정
    const fileName = `근무스케줄_템플릿_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('근무 스케줄 템플릿 다운로드 오류:', error);
    res.status(500).json({ success: false, message: '템플릿 다운로드 중 오류가 발생했습니다.' });
  }
});

// 근무 스케줄 엑셀 내보내기
router.get('/excel/export', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('근무 스케줄');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '날짜', key: 'date', width: 15 },
      { header: '요일', key: 'dayOfWeek', width: 10 },
      { header: '보안1팀', key: 'team1', width: 20 },
      { header: '보안2팀', key: 'team2', width: 20 },
      { header: '보안3팀', key: 'team3', width: 20 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 현재 주차 데이터 가져오기
    const today = new Date();
    const weekStart = WorkScheduleService.getWeekStart(today);
    const weekEnd = WorkScheduleService.getWeekEnd(today);
    
    // 주차 정보 계산
    const weekNumber = WorkScheduleService.getWeekNumber(today);
    const teamSchedule = WorkScheduleService.getTeamSchedule(weekNumber);

    // 일주일 데이터 추가
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = dayNames[date.getDay()];
      
      worksheet.addRow({
        date: date.toISOString().split('T')[0],
        dayOfWeek: dayOfWeek,
        team1: teamSchedule.team1,
        team2: teamSchedule.team2,
        team3: teamSchedule.team3
      });
    }

    // 파일명 설정
    const fileName = `근무스케줄_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('근무 스케줄 내보내기 오류:', error);
    res.status(500).json({ success: false, message: '데이터 내보내기 중 오류가 발생했습니다.' });
  }
});

// 근무 통계 보고서 엑셀 다운로드
router.get('/stats/excel', async (req, res) => {
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
    const worksheet = workbook.addWorksheet('근무 통계 보고서');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '구분', key: 'category', width: 20 },
      { header: '보안1팀', key: 'team1', width: 15 },
      { header: '보안2팀', key: 'team2', width: 15 },
      { header: '보안3팀', key: 'team3', width: 15 },
      { header: '합계', key: 'total', width: 15 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 통계 데이터 추가 (샘플)
    worksheet.addRow({
      category: '주간 근무',
      team1: '7일',
      team2: '7일',
      team3: '7일',
      total: '21일'
    });

    worksheet.addRow({
      category: '심야 근무',
      team1: '7일',
      team2: '7일',
      team3: '7일',
      total: '21일'
    });

    worksheet.addRow({
      category: '초야 근무',
      team1: '7일',
      team2: '7일',
      team3: '7일',
      total: '21일'
    });

    // 파일명 설정
    const fileName = `근무통계_${month}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('근무 통계 보고서 다운로드 오류:', error);
    res.status(500).json({ success: false, message: '보고서 다운로드 중 오류가 발생했습니다.' });
  }
});

// 주차별 스케줄 관리 라우트

// 주차 목록 조회
router.get('/week-list', async (req, res) => {
  try {
    const schedules = await WorkSchedule.find({ status: 'active' })
      .sort({ weekStartDate: -1 })
      .select('_id weekNumber weekStartDate weekEndDate status')
      .limit(20);
    
    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('주차 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '주차 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 특정 주차 스케줄 조회
router.get('/week/:id', async (req, res) => {
  try {
    const schedule = await WorkSchedule.findById(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: '해당 주차 스케줄을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('주차 스케줄 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '주차 스케줄 조회 중 오류가 발생했습니다.'
    });
  }
});

// 주차 스케줄 생성
router.post('/create-week', async (req, res) => {
  try {
    const { weekNumber, weekStartDate, weekEndDate, status, createdBy } = req.body;
    
    // 중복 주차 번호 확인
    const existingSchedule = await WorkSchedule.findOne({
      weekNumber: weekNumber,
      status: 'active'
    });
    
    if (existingSchedule) {
      return res.status(400).json({
        success: false,
        message: '해당 주차 번호의 스케줄이 이미 존재합니다.'
      });
    }
    
    // 중복 날짜 범위 확인
    const overlappingSchedule = await WorkSchedule.findOne({
      status: 'active',
      $or: [
        {
          weekStartDate: { $lte: new Date(weekStartDate) },
          weekEndDate: { $gte: new Date(weekStartDate) }
        },
        {
          weekStartDate: { $lte: new Date(weekEndDate) },
          weekEndDate: { $gte: new Date(weekEndDate) }
        }
      ]
    });
    
    if (overlappingSchedule) {
      return res.status(400).json({
        success: false,
        message: '해당 기간과 겹치는 스케줄이 이미 존재합니다.'
      });
    }
    
    const newSchedule = new WorkSchedule({
      weekNumber,
      weekStartDate: new Date(weekStartDate),
      weekEndDate: new Date(weekEndDate),
      status: status || 'active',
      createdBy: createdBy || req.session.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await newSchedule.save();
    
    res.json({
      success: true,
      message: '주차 스케줄이 생성되었습니다.',
      data: newSchedule
    });
  } catch (error) {
    console.error('주차 스케줄 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '주차 스케줄 생성 중 오류가 발생했습니다.'
    });
  }
});

// 다음 주차 생성
router.post('/create-next-week', async (req, res) => {
  try {
    const { currentWeekId } = req.body;
    
    if (!currentWeekId) {
      return res.status(400).json({
        success: false,
        message: '현재 주차 ID가 필요합니다.'
      });
    }
    
    // 현재 주차 정보 조회
    const currentWeek = await WorkSchedule.findById(currentWeekId);
    if (!currentWeek) {
      return res.status(404).json({
        success: false,
        message: '현재 주차를 찾을 수 없습니다.'
      });
    }
    
    // 다음 주차 시작일 계산 (현재 주차 종료일 다음날)
    const nextWeekStartDate = new Date(currentWeek.weekEndDate);
    nextWeekStartDate.setDate(nextWeekStartDate.getDate() + 1);
    nextWeekStartDate.setHours(6, 0, 0, 0); // 월요일 06:00
    
    // 다음 주차 종료일 계산 (7일 후)
    const nextWeekEndDate = new Date(nextWeekStartDate);
    nextWeekEndDate.setDate(nextWeekStartDate.getDate() + 6);
    nextWeekEndDate.setHours(23, 59, 59, 999); // 일요일 23:59:59
    
    // 주차 번호 계산
    const yearStart = new Date(2025, 0, 1, 6, 0, 0); // 2025년 1월 1일 06:00
    const dayOfWeek = nextWeekStartDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const monday6am = new Date(nextWeekStartDate);
    monday6am.setDate(nextWeekStartDate.getDate() - mondayOffset);
    monday6am.setHours(6, 0, 0, 0);
    
    const weekDiff = Math.floor((monday6am - yearStart) / (7 * 24 * 60 * 60 * 1000));
    const weekNumber = weekDiff + 2;
    
    // 다음 주차 스케줄 생성
    const nextWeekSchedule = new WorkSchedule({
      weekStartDate: nextWeekStartDate,
      weekEndDate: nextWeekEndDate,
      weekNumber: weekNumber,
      currentWeekSchedule: {
        team1: '출근(초)',
        team2: '출근(심)',
        team3: '출근(주)'
      },
      weekendSchedule: {
        saturday: {
          dayShift: { team1Count: 0, team2Count: 0, team3Count: 0 },
          nightShift: { team1Count: 0, team2Count: 0, team3Count: 0 }
        },
        sunday: {
          dayShift: { team1Count: 0, team2Count: 0, team3Count: 0 },
          nightShift: { team1Count: 0, team2Count: 0, team3Count: 0 }
        },
        team1: { aGroup: '', bGroup: '', group1: '', group2: '', group3: '', group4: '' },
        team2: { aGroup: '', bGroup: '', group1: '', group2: '', group3: '', group4: '' },
        team3: { aGroup: '', bGroup: '', group1: '', group2: '', group3: '', group4: '' }
      },
      holidays: [],
      status: 'active',
      createdBy: req.session.userId
    });
    
    await nextWeekSchedule.save();
    
    res.json({
      success: true,
      message: '다음 주차 스케줄이 생성되었습니다.',
      data: nextWeekSchedule
    });
    
  } catch (error) {
    console.error('다음 주차 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '다음 주차 생성 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
