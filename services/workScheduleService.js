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
   * 주차 시작일 계산 (월요일)
   */
  static getWeekStart(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }
  
  /**
   * 주차 종료일 계산 (일요일)
   */
  static getWeekEnd(date) {
    const weekStart = this.getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
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
        let status, checkIn, checkOut, basic, special, night;
        
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
          // 주말 근무
          if (dayOfWeek === 6) { // 토요일
            if (emp.department === '보안3팀') {
              status = '휴가';
              checkIn = '';
              checkOut = '';
              basic = '0';
              special = '0';
              night = '0';
            } else {
              // 1팀, 2팀: 12시간 근무
              status = '출근(사무)';
              if (emp.department === '보안1팀') {
                checkIn = '06:00';
                checkOut = '18:00';
                basic = '12';
                special = '0';
                night = '0';
              } else { // 보안2팀
                checkIn = '18:00';
                checkOut = '06:00';
                basic = '12';
                special = '0';
                night = '12';
              }
            }
          } else { // 일요일
            // 1팀, 2팀: 12시간 근무 (인원 조정 필요)
            status = '출근(사무)';
            if (emp.department === '보안1팀') {
              checkIn = '06:00';
              checkOut = '18:00';
              basic = '12';
              special = '0';
              night = '0';
            } else { // 보안2팀
              checkIn = '18:00';
              checkOut = '06:00';
              basic = '12';
              special = '0';
              night = '12';
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
            specialOvertime: '0',
            night,
            totalTime: this.calculateTotalTime(basic, '0', special || '0', '0', night),
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
   * 총시간 계산
   */
  static calculateTotalTime(basic, overtime, special, specialOvertime, night) {
    const basicNum = parseFloat(basic) || 0;
    const overtimeNum = parseFloat(overtime) || 0;
    const specialNum = parseFloat(special) || 0;
    const specialOvertimeNum = parseFloat(specialOvertime) || 0;
    const nightNum = parseFloat(night) || 0;
    
    // 총시간 = 기본시간*8 + 연장*1.5 + 특근*1.5 + 특연*2 + 야간*0.5
    return (basicNum * 8) + (overtimeNum * 1.5) + (specialNum * 1.5) + (specialOvertimeNum * 2) + (nightNum * 0.5);
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
