const express = require('express');
const router = express.Router();
const WorkSchedule = require('../models/WorkSchedule');
const WorkScheduleService = require('../services/workScheduleService');
const Employee = require('../models/Employee');

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
    schedule.weekendSchedule = {
      ...schedule.weekendSchedule, // 기존 데이터 유지
      team1: weekendData.team1,   // 보안1팀 A조, B조, 1~4조
      team2: weekendData.team2,   // 보안2팀 A조, B조, 1~4조
      team3: weekendData.team3    // 보안3팀 A조, B조, 1~4조
    };
    
    await schedule.save();
    
    // 편성 인원 현황도 함께 업데이트
    await updateAssignmentCounts(weekendData);
    
    res.json({ 
      success: true, 
      message: '주말 스케줄이 저장되었습니다.',
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
         // 토요일 주간: 2팀 초야조 30명 (1~4조 중 3개조)
         counts.saturdayDayCount = Math.min(counts.team2GroupsCount, 30);
         // 토요일 야간: 1팀, 3팀 심야조 30명 (1~4조 중 3개조씩)
         counts.saturdayNightCount = Math.min(counts.team1GroupsCount + counts.team3GroupsCount, 30);
         // 일요일 주간: A조 30명 (1팀 A조 20명 + 2팀 1조 10명)
         counts.sundayDayCount = Math.min(counts.team1ACount + (counts.team2GroupsCount > 0 ? 10 : 0), 30);
         // 일요일 야간: B조 30명 (1팀 B조 20명 + 3팀 1조 10명)
         counts.sundayNightCount = Math.min(counts.team1BCount + (counts.team3GroupsCount > 0 ? 10 : 0), 30);

    res.json({
      success: true,
      data: counts
    });

  } catch (error) {
    console.error('편성 인원 현황 조회 오류:', error);
    res.status(500).json({ success: false, message: '편성 인원 현황 조회 중 오류가 발생했습니다.' });
  }
});

// 편성 인원 현황 업데이트 (내부 함수)
async function updateAssignmentCounts(weekendData) {
  try {
    // 각 팀별로 편성 명단을 기반으로 weekendAssignment 업데이트
    const teams = ['team1', 'team2', 'team3'];
    
    for (const team of teams) {
      const teamData = weekendData[team];
      if (!teamData) continue;
      
      // A조, B조 명단 파싱
      const aGroupMembers = teamData.aGroup ? teamData.aGroup.split('\n').filter(line => line.trim()) : [];
      const bGroupMembers = teamData.bGroup ? teamData.bGroup.split('\n').filter(line => line.trim()) : [];
      
      // 1조, 2조, 3조, 4조 명단 파싱
      const group1Members = teamData.group1 ? teamData.group1.split('\n').filter(line => line.trim()) : [];
      const group2Members = teamData.group2 ? teamData.group2.split('\n').filter(line => line.trim()) : [];
      const group3Members = teamData.group3 ? teamData.group3.split('\n').filter(line => line.trim()) : [];
      const group4Members = teamData.group4 ? teamData.group4.split('\n').filter(line => line.trim()) : [];
      
      // 각 직원의 weekendAssignment 업데이트
      for (const member of aGroupMembers) {
        await Employee.updateOne(
          { name: member.trim() },
          { 
            'weekendAssignment.group': 'none',
            'weekendAssignment.weekendGroup': 'A조',
            'weekendAssignment.sundayGroup': 'none'
          }
        );
      }
      
      for (const member of bGroupMembers) {
        await Employee.updateOne(
          { name: member.trim() },
          { 
            'weekendAssignment.group': 'none',
            'weekendAssignment.weekendGroup': 'B조',
            'weekendAssignment.sundayGroup': 'none'
          }
        );
      }
      
      for (const member of group1Members) {
        await Employee.updateOne(
          { name: member.trim() },
          { 
            'weekendAssignment.group': '1/4',
            'weekendAssignment.weekendGroup': 'none',
            'weekendAssignment.sundayGroup': '1조'
          }
        );
      }
      
      for (const member of group2Members) {
        await Employee.updateOne(
          { name: member.trim() },
          { 
            'weekendAssignment.group': '1/4',
            'weekendAssignment.weekendGroup': 'none',
            'weekendAssignment.sundayGroup': '2조'
          }
        );
      }
      
      for (const member of group3Members) {
        await Employee.updateOne(
          { name: member.trim() },
          { 
            'weekendAssignment.group': '3/4',
            'weekendAssignment.weekendGroup': 'none',
            'weekendAssignment.sundayGroup': '3조'
          }
        );
      }
      
      for (const member of group4Members) {
        await Employee.updateOne(
          { name: member.trim() },
          { 
            'weekendAssignment.group': '3/4',
            'weekendAssignment.weekendGroup': 'none',
            'weekendAssignment.sundayGroup': '4조'
          }
        );
      }
    }
    
  } catch (error) {
    console.error('편성 인원 현황 업데이트 오류:', error);
    throw error; // 에러를 상위로 전파
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

module.exports = router;
