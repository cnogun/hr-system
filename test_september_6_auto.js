const fetch = require('node-fetch');

async function testAutoAttendance() {
  try {
    console.log('9월 6일 토요일 근태 자동 입력 테스트 시작...');
    
    const response = await fetch('http://localhost:10000/attendance/auto-attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3Ayour-session-id' // 실제 세션 ID 필요
      },
      body: JSON.stringify({
        date: '2025-09-06',
        department: ''
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('자동 입력 성공!');
      console.log('저장된 데이터:');
      
      for (const [employeeId, data] of Object.entries(result.data)) {
        if (data.status && data.status.includes('야특')) {
          console.log(`\n${data.status} - 총시간: ${data.totalTime}`);
          console.log(`  기본: ${data.basic}, 연장: ${data.overtime}`);
          console.log(`  특근: ${data.special}, 특연: ${data.specialOvertime}, 야간: ${data.night}`);
          
          // 계산 확인
          const calculated = (parseInt(data.basic) || 0) + 
                           (parseInt(data.overtime) || 0) + 
                           (parseInt(data.special) || 0) + 
                           (parseInt(data.specialOvertime) || 0) + 
                           (parseInt(data.night) || 0);
          console.log(`  계산된 총시간: ${calculated}`);
        }
      }
    } else {
      console.log('자동 입력 실패:', result.message);
    }
    
  } catch (error) {
    console.error('테스트 오류:', error);
  }
}

testAutoAttendance();
