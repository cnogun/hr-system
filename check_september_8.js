// 9월 8일 월요일 주차 계산 및 팀 근무 확인
function getWeekNumber(date) {
  // 2025년 1월 1일(수) 06:00을 기준으로 계산
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

function getTeamSchedule(teamNumber, weekNumber) {
  // 3주 주기로 팀별 근무 형태 순환
  const cycle = (weekNumber - 1) % 3; // 0, 1, 2 반복
  
  if (teamNumber === 1) {
    // 1팀: 초야(cycle 0) → 주간(cycle 1) → 심야(cycle 2)
    const schedules = ['초야', '주간', '심야'];
    return schedules[cycle];
  } else if (teamNumber === 2) {
    // 2팀: 심야(cycle 0) → 초야(cycle 1) → 주간(cycle 2)
    const schedules = ['심야', '초야', '주간'];
    return schedules[cycle];
  } else if (teamNumber === 3) {
    // 3팀: 주간(cycle 0) → 심야(cycle 1) → 초야(cycle 2)
    const schedules = ['주간', '심야', '초야'];
    return schedules[cycle];
  }
  
  return '주간'; // 기본값
}

// 9월 8일 월요일 확인
const september8 = new Date('2025-09-08');
const weekNumber = getWeekNumber(september8);
const cycle = (weekNumber - 1) % 3;

console.log('=== 9월 8일 월요일 근무 확인 ===');
console.log('날짜:', september8.toISOString().split('T')[0]);
console.log('요일:', ['일', '월', '화', '수', '목', '금', '토'][september8.getDay()]);
console.log('주차:', weekNumber);
console.log('사이클:', cycle);
console.log('');
console.log('팀별 근무 형태:');
console.log('1반:', getTeamSchedule(1, weekNumber));
console.log('2반:', getTeamSchedule(2, weekNumber));
console.log('3반:', getTeamSchedule(3, weekNumber));
console.log('');
console.log('예상 결과: 1반 초야, 2반 심야, 3반 주간');
