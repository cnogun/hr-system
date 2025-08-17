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

module.exports = router;
