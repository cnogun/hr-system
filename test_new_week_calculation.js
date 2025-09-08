console.log('=== 새로운 주차 계산 로직 테스트 ===');

// 새로운 주차 계산 함수 (월요일 06:00 ~ 토요일 06:00 기준)
function getWeekNumber(date) {
    // 2025년 9월 8일(월요일)을 1주차로 설정
    const week1Start = new Date(2025, 8, 8, 6, 0, 0); // 2025년 9월 8일 06:00
    const targetDate = new Date(date);
    
    // 토요일 06:00까지가 한 주이므로, 토요일 06:00 이전까지는 같은 주
    const dayOfWeek = targetDate.getDay();
    let adjustedDate = new Date(targetDate);
    
    // 일요일이면 전주 토요일로 조정
    if (dayOfWeek === 0) {
        adjustedDate.setDate(targetDate.getDate() - 1);
    }
    // 토요일이고 06:00 이전이면 전주로 조정
    else if (dayOfWeek === 6 && targetDate.getHours() < 6) {
        adjustedDate.setDate(targetDate.getDate() - 1);
    }
    
    // 월요일 06:00으로 조정
    const mondayOffset = adjustedDate.getDay() === 0 ? 6 : adjustedDate.getDay() - 1;
    adjustedDate.setDate(adjustedDate.getDate() - mondayOffset);
    adjustedDate.setHours(6, 0, 0, 0);
    
    const weekDiff = Math.floor((adjustedDate - week1Start) / (7 * 24 * 60 * 60 * 1000));
    const weekNumber = weekDiff + 1;
    
    return weekNumber;
}

// 팀별 근무형태 계산 함수
function getTeamSchedule(teamNumber, weekNumber) {
    const cycle = (weekNumber - 1) % 3; // 0, 1, 2 반복
    
    if (teamNumber === 1) {
        const schedules = ['초야', '주간', '심야'];
        return schedules[cycle];
    } else if (teamNumber === 2) {
        const schedules = ['심야', '초야', '주간'];
        return schedules[cycle];
    } else if (teamNumber === 3) {
        const schedules = ['주간', '심야', '초야'];
        return schedules[cycle];
    }
    
    return '주간';
}

// 테스트 날짜들
const testDates = [
    '2025-09-08', // 월요일 (1주차 시작)
    '2025-09-07', // 일요일 (전주)
    '2025-09-20', // 토요일
    '2025-09-21', // 일요일
    '2025-10-23'  // 목요일
];

testDates.forEach(dateStr => {
    const date = new Date(dateStr);
    const weekNumber = getWeekNumber(date);
    
    console.log(`\n=== ${dateStr} (${['일','월','화','수','목','금','토'][date.getDay()]}요일) ===`);
    console.log('주차:', weekNumber);
    
    const team1Weekday = getTeamSchedule(1, weekNumber);
    const team2Weekday = getTeamSchedule(2, weekNumber);
    const team3Weekday = getTeamSchedule(3, weekNumber);
    
    console.log('근무형태: 1반', team1Weekday, ', 2반', team2Weekday, ', 3반', team3Weekday);
});
