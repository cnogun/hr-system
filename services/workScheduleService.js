const WorkSchedule = require('../models/WorkSchedule');
const Employee = require('../models/Employee');

class WorkScheduleService {
  /**
   * 현재 주차의 근무 스케줄 생성
   */
  static async createCurrentWeekSchedule(userId) {
    try {
      const today = new Date();
      const weekStart = this.getWeekStart(today);
      const weekEnd = this.getWeekEnd(today);
      
      // 주차 번호 계산
      const weekNumber = this.getWeekNumber(today);
      
      // 기존 스케줄이 있는지 확인
      const existingSchedule = await WorkSchedule.findOne({
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        status: 'active'
      });
      
      if (existingSchedule) {
        return existingSchedule;
      }
      
      // 새로운 스케줄 생성
      const schedule = new WorkSchedule({
        weekNumber: weekNumber,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        currentWeekSchedule: {
          team1: '출근(초)',  // 보안1팀
          team2: '출근(심)',  // 보안2팀
          team3: '출근(주)'   // 보안3팀
        },
        createdBy: userId,
        status: 'active'
      });
      
      await schedule.save();
      return schedule;
      
    } catch (error) {
      console.error('근무 스케줄 생성 오류:', error);
      throw error;
    }
  }
  
  /**
   * 주차 번호 계산 (2025년 1월 1일 기준)
   */
  static getWeekNumber(date) {
    const yearStart = new Date(2025, 0, 1, 6, 0, 0); // 2025년 1월 1일 06:00
    const targetDate = new Date(date);
    
    // 월요일 06:00으로 조정
    const dayOfWeek = targetDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const monday6am = new Date(targetDate);
    monday6am.setDate(targetDate.getDate() - mondayOffset);
    monday6am.setHours(6, 0, 0, 0);
    
    const weekDiff = Math.floor((monday6am - yearStart) / (7 * 24 * 60 * 60 * 1000));
    return weekDiff + 2; // 1월 1일 수요일이 1주차, 1월 6일 월요일이 2주차
  }
  
  /**
   * 주차 시작일 계산 (월요일 06:00)
   * 규칙: 평일 = 월요일 06:00 ~ 토요일 06:00, 휴일 = 토요일 06:00 ~ 월요일 06:00
   * 토요일이라고 지칭하면 휴일로 인식 (날짜 기준)
   */
  static getWeekStart(date) {
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    
    // 월요일까지의 오프셋 계산
    let mondayOffset;
    if (dayOfWeek === 0) { // 일요일 - 이전 주 월요일
      mondayOffset = 6;
    } else if (dayOfWeek === 1) { // 월요일 - 같은 주 월요일
      mondayOffset = 0;
    } else { // 화요일~토요일 - 같은 주 월요일
      mondayOffset = dayOfWeek - 1;
    }
    
    // 월요일 날짜 계산 (UTC 기준으로 계산하여 시간대 문제 방지)
    const mondayDate = new Date(targetDate);
    mondayDate.setUTCDate(targetDate.getUTCDate() - mondayOffset);
    mondayDate.setUTCHours(6, 0, 0, 0);
    
    return mondayDate;
  }
  
  /**
   * 주차 종료일 계산 (다음주 월요일 06:00)
   */
  static getWeekEnd(date) {
    const weekStart = this.getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7); // 7일 후 (다음주 월요일)
    weekEnd.setHours(6, 0, 0, 0); // 06:00으로 설정
    return weekEnd;
  }
  
  /**
   * 특정 날짜의 근무 형태 자동 설정
   */
  static async autoSetWorkSchedule(date, userId) {
    try {
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0: 일요일, 6: 토요일
      const isHoliday = await this.isHoliday(targetDate);
      
      // 주말이거나 공휴일인 경우
      if (isWeekend || isHoliday) {
        return await this.setWeekendOrHolidaySchedule(targetDate, isWeekend, isHoliday, userId);
      }
      
      // 평일인 경우
      return await this.setWeekdaySchedule(targetDate, userId);
      
    } catch (error) {
      console.error('근무 스케줄 자동 설정 오류:', error);
      throw error;
    }
  }
  
  /**
   * 평일 근무 스케줄 설정
   */
  static async setWeekdaySchedule(date, userId) {
    try {
      const employees = await Employee.find({ 
        status: '재직',
        department: { $in: ['보안1팀', '보안2팀', '보안3팀'] }
      });
      
      const scheduleData = {};
      
      employees.forEach(emp => {
        let status, checkIn, checkOut, basic, night;
        
        switch (emp.department) {
          case '보안1팀':
            status = '출근(초)';
            checkIn = '14:00';
            checkOut = '22:00';
            basic = '8';
            night = '0';
            break;
          case '보안2팀':
            status = '출근(심)';
            checkIn = '22:00';
            checkOut = '06:00';
            basic = '8';
            night = '8';
            break;
          case '보안3팀':
            status = '출근(주)';
            checkIn = '06:00';
            checkOut = '14:00';
            basic = '8';
            night = '0';
            break;
          default:
            return;
        }
        
        scheduleData[emp._id] = {
          status,
          checkIn,
          checkOut,
          basic,
          overtime: '0',
          special: '0',
          specialOvertime: '0',
          night,
          totalTime: this.calculateTotalTime(basic, '0', '0', '0', night),
          note: '자동 설정',
          updatedAt: new Date()
        };
      });
      
      return scheduleData;
      
    } catch (error) {
      console.error('평일 근무 스케줄 설정 오류:', error);
      throw error;
    }
  }
  
  /**
   * 주말/공휴일 근무 스케줄 설정
   */
  static async setWeekendOrHolidaySchedule(date, isWeekend, isHoliday, userId) {
    try {
      const employees = await Employee.find({ 
        status: '재직',
        department: { $in: ['보안1팀', '보안2팀', '보안3팀'] }
      });
      
      const scheduleData = {};
      const dayOfWeek = date.getDay();
      
      employees.forEach(emp => {
        let status, checkIn, checkOut, basic, special, specialOvertime, night;
        
        if (isHoliday) {
          // 공휴일인 경우 특근 처리
          if (this.isWeekdayHoliday(date)) {
            // 평일 공휴일: 8시간 특근
            status = '출근(주특)';
            checkIn = '06:00';
            checkOut = '18:00';
            basic = '8';
            special = '8';
            night = '0';
          } else {
            // 휴일 공휴일: 다음날 특근으로 처리
            status = '출근(주특)';
            checkIn = '06:00';
            checkOut = '18:00';
            basic = '8';
            special = '8';
            night = '0';
          }
        } else if (isWeekend) {
          // 주말 근무 (새로운 공식 적용)
          if (dayOfWeek === 6) { // 토요일
            if (emp.department === '보안2팀') {
              // 2팀: 주간특근 (06:00~18:00)
              status = '출근(주특)';
              checkIn = '06:00';
              checkOut = '18:00';
              basic = '8';
              special = '8';        // 특근 8시간
              specialOvertime = '4'; // 특근연장 4시간
              night = '0';
            } else if (emp.department === '보안3팀') {
              // 3팀: 야간특근 (18:00~06:00)
              status = '출근(야특)';
              checkIn = '18:00';
              checkOut = '06:00';
              basic = '8';
              special = '8';        // 특근 8시간
              specialOvertime = '4'; // 특근연장 4시간
              night = '8';          // 야간 8시간
            } else {
              // 1팀: 정기휴무 (일요일 주간근무 준비)
              status = '정기휴무';
              checkIn = '';
              checkOut = '';
              basic = '8';
              special = '0';
              specialOvertime = '0';
              night = '0';
            }
          } else { // 일요일
            // 주차별 팀 근무 형태 확인
            const weekNumber = this.getWeekNumber(date);
            const cycle = (weekNumber - 1) % 3;
            
            let team1Schedule, team2Schedule, team3Schedule;
            if (cycle === 0) {
              team1Schedule = '초야'; team2Schedule = '심야'; team3Schedule = '주간';
            } else if (cycle === 1) {
              team1Schedule = '주간'; team2Schedule = '초야'; team3Schedule = '심야';
            } else {
              team1Schedule = '심야'; team2Schedule = '주간'; team3Schedule = '초야';
            }
            
            if (emp.department === '보안1팀') {
              if (team1Schedule === '주간') {
                // 1팀이 주간팀일 때: A조(주간) 또는 B조(야간)
                const nameMatch = emp.name.match(/보안1팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber <= 20) { // A조: 주간특근
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '0';
                  } else { // B조: 야간특근
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '8';
                  }
                }
              } else if (team1Schedule === '심야') {
                // 1팀이 심야팀일 때: 2조(선택조) 10명 야간특근
                const nameMatch = emp.name.match(/보안1팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber >= 11 && memberNumber <= 20) { // 2조
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '8';
                  } else {
                    status = '정기휴무';
                    basic = '8';
                  }
                }
              } else if (team1Schedule === '초야') {
                // 1팀이 초야팀일 때: 2조(선택조) 10명 주간특근
                const nameMatch = emp.name.match(/보안1팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber >= 11 && memberNumber <= 20) { // 2조
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '0';
                  } else {
                    status = '정기휴무';
                    basic = '8';
                  }
                }
              }
            } else if (emp.department === '보안2팀') {
              if (team2Schedule === '주간') {
                // 2팀이 주간팀일 때: A조(주간) 또는 B조(야간)
                const nameMatch = emp.name.match(/보안2팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber <= 20) { // A조: 주간특근
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '0';
                  } else { // B조: 야간특근
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '8';
                  }
                }
              } else if (team2Schedule === '초야') {
                // 2팀이 초야팀일 때: 1조(선택조) 10명 주간특근
                const nameMatch = emp.name.match(/보안2팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber >= 1 && memberNumber <= 10) { // 1조
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '0';
                  } else {
                    status = '정기휴무';
                    basic = '8';
                  }
                }
              } else if (team2Schedule === '심야') {
                // 2팀이 심야팀일 때: 1조(선택조) 10명 야간특근
                const nameMatch = emp.name.match(/보안2팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber >= 1 && memberNumber <= 10) { // 1조
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '8';
                  } else {
                    status = '정기휴무';
                    basic = '8';
                  }
                }
              }
            } else if (emp.department === '보안3팀') {
              if (team3Schedule === '주간') {
                // 3팀이 주간팀일 때: A조(주간) 또는 B조(야간)
                const nameMatch = emp.name.match(/보안3팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber <= 20) { // A조: 주간특근
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '0';
                  } else { // B조: 야간특근
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '8';
                  }
                }
              } else if (team3Schedule === '심야') {
                // 3팀이 심야팀일 때: 1조(선택조) 10명 야간특근
                const nameMatch = emp.name.match(/보안3팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber >= 1 && memberNumber <= 10) { // 1조
                    status = '출근(야특)';
                    checkIn = '18:00';
                    checkOut = '06:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '8';
                  } else {
                    status = '정기휴무';
                    basic = '8';
                  }
                }
              } else if (team3Schedule === '초야') {
                // 3팀이 초야팀일 때: 1조(선택조) 10명 주간특근
                const nameMatch = emp.name.match(/보안3팀원(\d+)/);
                if (nameMatch) {
                  const memberNumber = parseInt(nameMatch[1]);
                  if (memberNumber >= 1 && memberNumber <= 10) { // 1조
                    status = '출근(주특)';
                    checkIn = '06:00';
                    checkOut = '18:00';
                    basic = '8';
                    special = '8';
                    specialOvertime = '4';
                    night = '0';
                  } else {
                    status = '정기휴무';
                    basic = '8';
                  }
                }
              }
            }
          }
        }
        
        if (status) {
          scheduleData[emp._id] = {
            status,
            checkIn,
            checkOut,
            basic,
            overtime: '0',
            special: special || '0',
            specialOvertime: specialOvertime || '0',
            night,
            totalTime: this.calculateTotalTime(basic, '0', special || '0', specialOvertime || '0', night),
            note: isHoliday ? '공휴일 특근' : '주말 근무',
            updatedAt: new Date()
          };
        }
      });
      
      return scheduleData;
      
    } catch (error) {
      console.error('주말/공휴일 근무 스케줄 설정 오류:', error);
      throw error;
    }
  }
  
  /**
   * 평일 공휴일 여부 확인
   */
  static isWeekdayHoliday(date) {
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // 월요일(1) ~ 금요일(5)
  }
  
  /**
   * 공휴일 여부 확인 (간단한 예시)
   */
  static async isHoliday(date) {
    // 실제로는 공휴일 API나 데이터베이스를 사용해야 함
    const holidays = [
      '01-01', // 신정
      '03-01', // 삼일절
      '05-05', // 어린이날
      '06-06', // 현충일
      '08-15', // 광복절
      '10-03', // 개천절
      '10-09', // 한글날
      '12-25'  // 크리스마스
    ];
    
    const dateString = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return holidays.includes(dateString);
  }
  
  /**
   * 총시간 계산 (수정됨 - 새로운 공식 적용)
   */
  static calculateTotalTime(basic, overtime, special, specialOvertime, night) {
    const basicNum = parseFloat(basic) || 0;
    const overtimeNum = parseFloat(overtime) || 0;
    const specialNum = parseFloat(special) || 0;
    const specialOvertimeNum = parseFloat(specialOvertime) || 0;
    const nightNum = parseFloat(night) || 0;
    
    // 새로운 공식:
    // 토요일 주간특근: 기본(8) + 특근(8×1.5) + 특근연장(4×2) = 28시간
    // 토요일 야간특근: 기본(8) + 특근(8×1.5) + 특근연장(4×2) + 야간(8×0.5) = 32시간
    // 일요일 주간/야간: 토요일과 동일
    return basicNum + (overtimeNum * 1.5) + (specialNum * 1.5) + (specialOvertimeNum * 2) + (nightNum * 0.5);
  }
  
  /**
   * 야간시간 계산 (22:00~06:00)
   */
  static calculateNightTime(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    
    const [checkInHour, checkInMin] = checkIn.split(':').map(Number);
    const [checkOutHour, checkOutMin] = checkOut.split(':').map(Number);
    
    let nightTime = 0;
    
    // 22:00~06:00 구간 계산
    if (checkInHour < 6) {
      // 00:00~06:00
      nightTime += Math.min(6, checkOutHour) - checkInHour;
    } else if (checkInHour >= 22) {
      // 22:00~24:00
      nightTime += 24 - checkInHour;
      if (checkOutHour < 6) {
        nightTime += checkOutHour;
      }
    } else if (checkOutHour >= 22) {
      // 22:00~24:00
      nightTime += checkOutHour - 22;
    }
    
    return Math.max(0, nightTime);
  }
}

module.exports = WorkScheduleService;
