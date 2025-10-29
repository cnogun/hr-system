/**
 * 파일명: monthlyAttendance.js
 * 목적: 월간 사원별 근태현황 조회 및 엑셀 내보내기
 * 기능:
 * - 월간 근태현황 페이지 렌더링
 * - 월간 근태 데이터 조회
 * - 엑셀 파일로 내보내기
 */

const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const ExcelJS = require('exceljs');
const WorkScheduleService = require('../services/workScheduleService');

// 월간 근태현황 페이지 렌더링
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

    // 현재 년월
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // URL 파라미터에서 년월, 부서 가져오기
    const year = parseInt(req.query.year) || currentYear;
    const month = parseInt(req.query.month) || currentMonth;
    const selectedDepartment = req.query.department || '';

    // 해당 월의 시작일과 마지막일 계산 (윤년 고려)
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const daysInMonth = endDate.getDate();
    
    // 윤년 확인 (2월인 경우)
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const actualDaysInMonth = month === 2 ? (isLeapYear ? 29 : 28) : daysInMonth;

    // 모든 직원 조회 (부서별 필터링 적용)
    let employeeQuery = { status: '재직' };
    if (selectedDepartment) {
      employeeQuery.department = selectedDepartment;
    }
    const employees = await Employee.find(employeeQuery).sort({ name: 1 });

    // 전체 부서 목록 가져오기 (필터링과 관계없이 모든 부서)
    const allEmployees = await Employee.find({ status: '재직' });
    const allDepartments = [...new Set(allEmployees.map(emp => emp.department || '부서미정'))].sort();

    // 해당 월의 근태 데이터 수집
    const monthlyData = [];
    
    for (const employee of employees) {
      const employeeData = {
        _id: employee._id,
        name: employee.name,
        department: employee.department || '부서미정',
        position: employee.position || '직급미정',
        empNo: employee.empNo || '',
        dailyAttendance: []
      };

      // 해당 월의 각 날짜별 근태 데이터 수집
      for (let day = 1; day <= actualDaysInMonth; day++) {
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const attendance = employee.attendance?.get(dateStr) || {};
        
        employeeData.dailyAttendance.push({
          date: dateStr,
          day: day,
          status: attendance.status || '',
          checkIn: attendance.checkIn || '',
          checkOut: attendance.checkOut || '',
          basic: attendance.basic || '',
          overtime: attendance.overtime || '',
          special: attendance.special || '',
          specialOvertime: attendance.specialOvertime || '',
          night: attendance.night || '',
          totalTime: attendance.totalTime || '',
          note: attendance.note || ''
        });
      }

      // 디버깅: 데이터 배열 수와 마지막날 비교
      console.log(`[${employee.name}] 데이터 배열 수: ${employeeData.dailyAttendance.length}, 마지막날: ${actualDaysInMonth}`);
      if (employeeData.dailyAttendance.length !== actualDaysInMonth) {
        console.log(`⚠️  경고: ${employee.name}의 데이터 배열 수(${employeeData.dailyAttendance.length})가 마지막날(${actualDaysInMonth})과 다릅니다!`);
      }

      monthlyData.push(employeeData);
    }
    
    // 부서별 정렬: 보안1팀, 보안2팀, 보안3팀, 관리팀, 지원팀 순서
    const departmentOrder = ['보안1팀', '보안2팀', '보안3팀', '관리팀', '지원팀'];
    
    monthlyData.sort((a, b) => {
      const aIndex = departmentOrder.indexOf(a.department);
      const bIndex = departmentOrder.indexOf(b.department);
      
      // 지정된 부서 순서에 따라 정렬
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // 지정되지 않은 부서는 맨 뒤로
      if (aIndex === -1 && bIndex === -1) {
        return a.department.localeCompare(b.department);
      }
      
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return 0;
    });

    // 전체 요약 로그
    console.log(`\n=== 월간 근태현황 데이터 요약 ===`);
    console.log(`선택된 년월: ${year}년 ${month}월`);
    console.log(`해당 월의 실제 일수: ${actualDaysInMonth}일`);
    console.log(`직원 수: ${monthlyData.length}명`);
    console.log(`부서별 정렬 순서: ${monthlyData.map(emp => emp.department).join(' → ')}`);
    console.log(`각 직원별 데이터 배열 수: ${monthlyData.map(emp => `${emp.name}: ${emp.dailyAttendance.length}개`).join(', ')}`);
    console.log(`================================\n`);

    res.render('monthlyAttendance', {
      monthlyData,
      year,
      month,
      daysInMonth: actualDaysInMonth,
      currentYear,
      currentMonth,
      selectedDepartment,
      allDepartments,
      session: req.session
    });

  } catch (error) {
    console.error('월간 근태현황 페이지 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('월간 근태현황 페이지 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// 월간 근태현황 엑셀 내보내기
router.get('/export', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    const { year, month, department } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ success: false, message: '년월 정보가 필요합니다.' });
    }

    // 해당 월의 시작일과 마지막일 계산 (윤년 고려)
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    const daysInMonth = endDate.getDate();
    
    // 윤년 확인 (2월인 경우)
    const isLeapYear = (parseInt(year) % 4 === 0 && parseInt(year) % 100 !== 0) || (parseInt(year) % 400 === 0);
    const actualDaysInMonth = parseInt(month) === 2 ? (isLeapYear ? 29 : 28) : daysInMonth;

    // 모든 직원 조회 (부서별 필터링 적용)
    let employeeQuery = { status: '재직' };
    if (department) {
      employeeQuery.department = department;
    }
    const employees = await Employee.find(employeeQuery).sort({ name: 1 });

    // 부서별 정렬: 보안1팀, 보안2팀, 보안3팀, 관리팀, 지원팀 순서
    const departmentOrder = ['보안1팀', '보안2팀', '보안3팀', '관리팀', '지원팀'];
    
    employees.sort((a, b) => {
      const aIndex = departmentOrder.indexOf(a.department);
      const bIndex = departmentOrder.indexOf(b.department);
      
      // 지정된 부서 순서에 따라 정렬
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // 지정되지 않은 부서는 맨 뒤로
      if (aIndex === -1 && bIndex === -1) {
        return a.department.localeCompare(b.department);
      }
      
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return 0;
    });

    // Excel 워크북 생성
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('월간근태현황');

    // 헤더 스타일 설정
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    const subHeaderStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '70AD47' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    // 기본 정보 헤더 (고정 열) - 순서: 번호, 사번, 이름, 직급, 부서
    worksheet.columns = [
      { header: '번호', key: 'no', width: 5 },
      { header: '사번', key: 'empNo', width: 10 },
      { header: '이름', key: 'name', width: 12 },
      { header: '직급', key: 'position', width: 12 },
      { header: '부서', key: 'department', width: 12 }
    ];

    // 날짜별 헤더 추가
    for (let day = 1; day <= actualDaysInMonth; day++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const date = new Date(dateStr);
      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
      
      worksheet.columns.push(
        { header: `${day}일\n${dayOfWeek}`, key: `day${day}_status`, width: 8 },
        { header: '출근', key: `day${day}_checkIn`, width: 8 },
        { header: '퇴근', key: `day${day}_checkOut`, width: 8 },
        { header: '기본', key: `day${day}_basic`, width: 6 },
        { header: '연장', key: `day${day}_overtime`, width: 6 },
        { header: '특근', key: `day${day}_special`, width: 6 },
        { header: '특연', key: `day${day}_specialOvertime`, width: 6 },
        { header: '야간', key: `day${day}_night`, width: 6 },
        { header: '총시간', key: `day${day}_totalTime`, width: 8 },
        { header: '비고', key: `day${day}_note`, width: 15 }
      );
    }

    // 합계 열 추가
    worksheet.columns.push(
      { header: '월 기본시간', key: 'monthBasic', width: 12 },
      { header: '월 연장시간', key: 'monthOvertime', width: 12 },
      { header: '월 특근시간', key: 'monthSpecial', width: 12 },
      { header: '월 특연시간', key: 'monthSpecialOvertime', width: 12 },
      { header: '월 야간시간', key: 'monthNight', width: 12 },
      { header: '월 총시간', key: 'monthTotal', width: 12 }
    );

    // 헤더 행 추가
    const headerRow = worksheet.addRow({});
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber <= 5) {
        cell.style = headerStyle;
      } else {
        cell.style = subHeaderStyle;
      }
    });

    // 데이터 행 추가
    let rowNumber = 1;
    for (const employee of employees) {
      const rowData = {
        no: rowNumber,
        empNo: employee.empNo || '',
        name: employee.name,
        position: employee.position || '직급미정',
        department: employee.department || '부서미정'
      };

      // 월간 합계 계산
      let monthBasic = 0, monthOvertime = 0, monthSpecial = 0, 
          monthSpecialOvertime = 0, monthNight = 0, monthTotal = 0;

      // 각 날짜별 데이터 추가
      for (let day = 1; day <= actualDaysInMonth; day++) {
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const attendance = employee.attendance?.get(dateStr) || {};
        
        rowData[`day${day}_status`] = attendance.status || '';
        rowData[`day${day}_checkIn`] = attendance.checkIn || '';
        rowData[`day${day}_checkOut`] = attendance.checkOut || '';
        rowData[`day${day}_basic`] = parseFloat(attendance.basic) || 0;
        rowData[`day${day}_overtime`] = parseFloat(attendance.overtime) || 0;
        rowData[`day${day}_special`] = parseFloat(attendance.special) || 0;
        rowData[`day${day}_specialOvertime`] = parseFloat(attendance.specialOvertime) || 0;
        rowData[`day${day}_night`] = parseFloat(attendance.night) || 0;
        rowData[`day${day}_totalTime`] = parseFloat(attendance.totalTime) || 0;
        rowData[`day${day}_note`] = attendance.note || '';

        // 월간 합계 누적
        monthBasic += parseFloat(attendance.basic) || 0;
        monthOvertime += parseFloat(attendance.overtime) || 0;
        monthSpecial += parseFloat(attendance.special) || 0;
        monthSpecialOvertime += parseFloat(attendance.specialOvertime) || 0;
        monthNight += parseFloat(attendance.night) || 0;
        monthTotal += parseFloat(attendance.totalTime) || 0;
      }

      // 월간 합계 추가
      rowData.monthBasic = monthBasic.toFixed(1);
      rowData.monthOvertime = monthOvertime.toFixed(1);
      rowData.monthSpecial = monthSpecial.toFixed(1);
      rowData.monthSpecialOvertime = monthSpecialOvertime.toFixed(1);
      rowData.monthNight = monthNight.toFixed(1);
      rowData.monthTotal = monthTotal.toFixed(1);

      const row = worksheet.addRow(rowData);
      
      // 행 스타일 설정
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // 숫자 데이터는 우측 정렬
        if (colNumber > 5 && colNumber <= 5 + (daysInMonth * 9)) {
          const dayCol = Math.floor((colNumber - 6) / 9);
          const fieldType = (colNumber - 6) % 9;
          
          if (fieldType >= 3 && fieldType <= 7) { // 기본, 연장, 특근, 특연, 야간, 총시간
            cell.alignment = { horizontal: 'right' };
          }
        }
        
        // 월간 합계 열은 굵게 표시
        if (colNumber > 5 + (daysInMonth * 9)) {
          cell.font = { bold: true };
          cell.alignment = { horizontal: 'right' };
        }
      });

      rowNumber++;
    }

    // 파일명 설정
    const fileName = `근태현황_${year}년${month}월_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // 응답 헤더 설정
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    // Excel 파일 스트림으로 전송
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('엑셀 내보내기 오류:', error);
    res.status(500).json({ success: false, message: '엑셀 내보내기 중 오류가 발생했습니다.' });
  }
});

// 토요일 자동입력 로직 적용 API
router.post('/apply-saturday-logic', async (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    // 관리자 권한 확인
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }

    const { year, month } = req.body;
    
    if (!year || !month) {
      return res.status(400).json({ success: false, message: '년월 정보가 필요합니다.' });
    }

    console.log(`=== 토요일 자동입력 로직 적용 시작 ===`);
    console.log(`대상: ${year}년 ${month}월`);

    // 해당 월의 모든 토요일 찾기
    const saturdays = [];
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    for (let day = 1; day <= endDate.getDate(); day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === 6) { // 토요일
        saturdays.push(day);
      }
    }

    console.log(`해당 월의 토요일: ${saturdays.join(', ')}일`);

    // 보안팀 직원들 조회
    const securityEmployees = await Employee.find({
      department: { $regex: /^보안/ },
      status: '재직'
    }).sort({ department: 1, name: 1 });

    console.log(`보안팀 직원 수: ${securityEmployees.length}명`);

    let processedEmployees = 0;
    const appliedDates = [];

    // 각 토요일에 대해 자동입력 로직 적용
    for (const day of saturdays) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const date = new Date(year, month - 1, day);
      
      // 주차 계산
      const weekNumber = Math.ceil((date - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
      const cycle = (weekNumber - 1) % 3;
      
      // 해당 주차의 팀 근무 형태 결정
      let team1Schedule, team2Schedule, team3Schedule;
      if (cycle === 0) {
        team1Schedule = '초야'; team2Schedule = '심야'; team3Schedule = '주간';
      } else if (cycle === 1) {
        team1Schedule = '주간'; team2Schedule = '초야'; team3Schedule = '심야';
      } else {
        team1Schedule = '심야'; team2Schedule = '주간'; team3Schedule = '초야';
      }

      console.log(`\n--- ${dateStr} (${weekNumber}주차, ${cycle + 1}/3 순환) ---`);
      console.log(`보안1팀: ${team1Schedule}, 보안2팀: ${team2Schedule}, 보안3팀: ${team3Schedule}`);

      // 각 직원에 대해 토요일 근무 설정
      for (const emp of securityEmployees) {
        let status = '';
        let checkIn = '';
        let checkOut = '';
        let basic = '8';
        let overtime = '0';
        let special = '0';
        let specialOvertime = '0';
        let night = '0';
        let note = '';

        if (emp.department === '보안1팀') {
          if (team1Schedule === '심야') {
            // 1팀이 심야팀일 때: 1~30번 야간특근, 31~40번 정기휴무
            const memberNumber = parseInt(emp.name.match(/(\d+)$/)?.[1] || '0');
            if (memberNumber >= 1 && memberNumber <= 30) {
              status = '출근(야특)';
              checkIn = '18:00';
              checkOut = '06:00';
              special = '8';
              specialOvertime = '4';
              night = '8';
              note = '야간특근';
            } else {
              status = '정기휴무';
              note = '정기 휴무';
            }
          } else if (team1Schedule === '초야') {
            // 1팀이 초야팀일 때: 1~30번 주간특근, 31~40번 정기휴무
            const memberNumber = parseInt(emp.name.match(/(\d+)$/)?.[1] || '0');
            if (memberNumber >= 1 && memberNumber <= 30) {
              status = '출근(주특)';
              checkIn = '06:00';
              checkOut = '18:00';
              special = '8';
              specialOvertime = '4';
              note = '주간특근';
            } else {
              status = '정기휴무';
              note = '정기 휴무';
            }
          } else {
            // 1팀이 주간팀일 때: 정기휴무
            status = '정기휴무';
            note = '정기 휴무';
          }
        } else if (emp.department === '보안2팀') {
          if (team2Schedule === '심야') {
            // 2팀이 심야팀일 때: 1~30번 야간특근, 31~40번 정기휴무
            const memberNumber = parseInt(emp.name.match(/(\d+)$/)?.[1] || '0');
            if (memberNumber >= 1 && memberNumber <= 30) {
              status = '출근(야특)';
              checkIn = '18:00';
              checkOut = '06:00';
              special = '8';
              specialOvertime = '4';
              night = '8';
              note = '야간특근';
            } else {
              status = '정기휴무';
              note = '정기 휴무';
            }
          } else if (team2Schedule === '초야') {
            // 2팀이 초야팀일 때: 1~30번 주간특근, 31~40번 정기휴무
            const memberNumber = parseInt(emp.name.match(/(\d+)$/)?.[1] || '0');
            if (memberNumber >= 1 && memberNumber <= 30) {
              status = '출근(주특)';
              checkIn = '06:00';
              checkOut = '18:00';
              special = '8';
              specialOvertime = '4';
              note = '주간특근';
            } else {
              status = '정기휴무';
              note = '정기 휴무';
            }
          } else {
            // 2팀이 주간팀일 때: 정기휴무
            status = '정기휴무';
            note = '정기 휴무';
          }
        } else if (emp.department === '보안3팀') {
          if (team3Schedule === '심야') {
            // 3팀이 심야팀일 때: 1~30번 야간특근, 31~40번 정기휴무
            const memberNumber = parseInt(emp.name.match(/(\d+)$/)?.[1] || '0');
            if (memberNumber >= 1 && memberNumber <= 30) {
              status = '출근(야특)';
              checkIn = '18:00';
              checkOut = '06:00';
              special = '8';
              specialOvertime = '4';
              night = '8';
              note = '야간특근';
            } else {
              status = '정기휴무';
              note = '정기 휴무';
            }
          } else if (team3Schedule === '초야') {
            // 3팀이 초야팀일 때: 1~30번 주간특근, 31~40번 정기휴무
            const memberNumber = parseInt(emp.name.match(/(\d+)$/)?.[1] || '0');
            if (memberNumber >= 1 && memberNumber <= 30) {
              status = '출근(주특)';
              checkIn = '06:00';
              checkOut = '18:00';
              special = '8';
              specialOvertime = '4';
              note = '주간특근';
            } else {
              status = '정기휴무';
              note = '정기 휴무';
            }
          } else {
            // 3팀이 주간팀일 때: 정기휴무
            status = '정기휴무';
            note = '정기 휴무';
          }
        }

        // 총시간 계산
        let totalTime = parseInt(basic) + parseInt(overtime) + parseInt(special) + parseInt(specialOvertime) + parseInt(night);

        // 근태 데이터 업데이트
        if (!emp.attendance) {
          emp.attendance = new Map();
        }
        
        emp.attendance.set(dateStr, {
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
        });

        processedEmployees++;
      }

      appliedDates.push(`${month}월 ${day}일`);
    }

    // 모든 직원의 데이터 저장
    await Promise.all(securityEmployees.map(emp => emp.save()));

    console.log(`=== 토요일 자동입력 로직 적용 완료 ===`);
    console.log(`처리된 직원: ${processedEmployees}명`);
    console.log(`적용된 날짜: ${appliedDates.join(', ')}`);

    res.json({
      success: true,
      message: '토요일 자동입력이 완료되었습니다.',
      appliedDates,
      processedEmployees,
      totalEmployees: securityEmployees.length
    });

  } catch (error) {
    console.error('토요일 자동입력 오류:', error);
    res.status(500).json({
      success: false,
      message: '토요일 자동입력 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 일요일 자동입력 API
router.post('/apply-sunday-logic', async (req, res) => {
  try {
    const { year, month } = req.body;
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: '년도와 월 정보가 필요합니다.'
      });
    }

    console.log(`일요일 자동입력 시작: ${year}년 ${month}월`);

    // 해당 월의 모든 일요일 찾기
    const sundays = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === 0) { // 일요일
        sundays.push(date);
      }
    }

    console.log(`발견된 일요일: ${sundays.length}개`, sundays.map(d => d.toLocaleDateString('ko-KR')));

    let processedEmployees = 0;
    const appliedDates = [];

    // 각 일요일에 대해 자동입력 적용
    for (const sunday of sundays) {
      try {
        console.log(`${sunday.toLocaleDateString('ko-KR')} 일요일 자동입력 시작`);
        
        // workScheduleService를 사용하여 자동입력
        const result = await WorkScheduleService.setWeekendOrHolidaySchedule(
          sunday, 
          true, // isWeekend
          false, // isHoliday
          req.session.userId || 'system'
        );

        if (result.success) {
          processedEmployees += result.processedEmployees;
          appliedDates.push(sunday.toLocaleDateString('ko-KR'));
          console.log(`${sunday.toLocaleDateString('ko-KR')} 일요일 자동입력 완료: ${result.processedEmployees}명`);
        } else {
          console.error(`${sunday.toLocaleDateString('ko-KR')} 일요일 자동입력 실패:`, result.message);
        }
      } catch (error) {
        console.error(`${sunday.toLocaleDateString('ko-KR')} 일요일 자동입력 오류:`, error);
      }
    }

    console.log(`일요일 자동입력 완료: ${processedEmployees}명 처리, ${appliedDates.length}개 일요일 적용`);

    res.json({
      success: true,
      message: `일요일 자동입력이 완료되었습니다.`,
      processedEmployees,
      appliedDates,
      totalSundays: sundays.length
    });

  } catch (error) {
    console.error('일요일 자동입력 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '일요일 자동입력 중 오류가 발생했습니다: ' + error.message
    });
  }
});

module.exports = router;
