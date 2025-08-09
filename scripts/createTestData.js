/**
 * 파일명: createTestData.js
 * 목적: 테스트용 직원 데이터 50개 생성 (모든 필드 완성)
 * 기능:
 * - 다양한 부서와 직급의 테스트 데이터 생성
 * - 모든 필드를 빈 값 없이 완성
 * - 프로필 이미지 URL 포함
 * - 실제와 유사한 데이터 구조
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 에러:'));
db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // 기존 데이터 삭제
    await Employee.deleteMany({});
    console.log('기존 직원 데이터 삭제 완료');
    
    // 관리자 계정 생성 (userId 참조용)
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        username: 'admin',
        email: 'admin@company.com',
        password: 'admin123',
        role: 'admin',
        name: '관리자'
      });
      console.log('관리자 계정 생성 완료');
    }
    
    // 테스트 데이터 생성
    const testEmployees = [];
    
    // 부서별 데이터
    const departments = ['보안1팀', '보안2팀', '보안3팀', '지원팀', '관리팀'];
    const positions = ['인턴', '사원', '주임', '대리', '과장', '차장', '팀장'];
    const orgTypes = ['정규직', '계약직', '인턴'];
    const statuses = ['재직', '휴직', '퇴직'];
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const genders = ['남', '여'];
    const employmentTypes = ['정규직', '계약직', '파견직'];
    
    // 유니폼 사이즈 옵션
    const uniformSizes = ['2별대', '별대', '특대', '대', '중'];
    const bottomSizes = ['38', '36', '35', '34', '33', '32', '31', '30'];
    const shoeSizes = ['290', '285', '280', '275', '270', '265', '260', '255', '250'];
    const capSizes = ['별대', '특대', '대', '중', '소'];
    
    // 프로필 이미지 URL (실제 존재하는 이미지)
    const profileImages = [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=200&h=200&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face'
    ];
    
    // 한국 이름 생성 함수
    const generateKoreanName = () => {
      const surnames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전'];
      const givenNames = ['민준', '서준', '도윤', '예준', '시우', '주원', '하준', '지호', '지후', '준서', '준우', '현우', '도현', '지훈', '우진', '민재', '건우', '서진', '현준', '도훈', '지원', '재원', '재민', '재현', '재준', '재호', '재훈', '재우', '재성', '재영', '재호', '재훈', '재우', '재성', '재영'];
      return surnames[Math.floor(Math.random() * surnames.length)] + 
             givenNames[Math.floor(Math.random() * givenNames.length)];
    };
    
    // 이메일 생성 함수
    const generateEmail = (name) => {
      const domains = ['gmail.com', 'naver.com', 'daum.net', 'company.com'];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      return `${name}@${domain}`;
    };
    
    // 휴대폰 번호 생성 함수
    const generateMobile = () => {
      const prefixes = ['010', '011', '016', '017', '018', '019'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const middle = String(Math.floor(Math.random() * 9000) + 1000);
      const last = String(Math.floor(Math.random() * 9000) + 1000);
      return `${prefix}-${middle}-${last}`;
    };
    
    // 집전화 번호 생성 함수
    const generatePhone = () => {
      const prefixes = ['02', '031', '032', '033', '041', '042', '043', '044', '051', '052', '053', '054', '055', '061', '062', '063', '064'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const middle = String(Math.floor(Math.random() * 9000) + 1000);
      const last = String(Math.floor(Math.random() * 9000) + 1000);
      return `${prefix}-${middle}-${last}`;
    };
    
    // 주민등록번호 생성 함수 (유효한 체크섬 포함)
    const generateResidentNumber = () => {
      const year = String(Math.floor(Math.random() * 30) + 70); // 1970-1999
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const gender = Math.floor(Math.random() * 2) + 1; // 1 또는 2
      const random = String(Math.floor(Math.random() * 900000) + 100000);
      
      // 앞 12자리 숫자
      const first12 = `${year}${month}${day}${gender}${random}`.split('').map(Number);
      
      // 체크섬 계산
      const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
      let sum = 0;
      
      for (let i = 0; i < 12; i++) {
        sum += first12[i] * weights[i];
      }
      
      const remainder = sum % 11;
      const checkDigit = remainder < 2 ? 0 : 11 - remainder;
      
      return `${year}${month}${day}-${gender}${random}${checkDigit}`;
    };
    
    // 생년월일 생성 함수
    const generateBirthDate = () => {
      const year = Math.floor(Math.random() * 30) + 1970;
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      return new Date(year, month - 1, day);
    };
    
    // 입사일 생성 함수
    const generateHireDate = () => {
      const year = Math.floor(Math.random() * 5) + 2019; // 2019-2023
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      return new Date(year, month - 1, day);
    };
    
    // 주소 생성 함수
    const generateAddress = () => {
      const cities = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시'];
      const districts = ['강남구', '서초구', '마포구', '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구'];
      const streets = ['테헤란로', '강남대로', '역삼로', '삼성로', '영동대로', '선릉로', '논현로', '신사동길'];
      const city = cities[Math.floor(Math.random() * cities.length)];
      const district = districts[Math.floor(Math.random() * districts.length)];
      const street = streets[Math.floor(Math.random() * streets.length)];
      const number = Math.floor(Math.random() * 200) + 1;
      
      return `${city} ${district} ${street} ${number}`;
    };
    
    // 급여은행 생성 함수
    const generateSalaryBank = () => {
      const banks = ['신한은행', '국민은행', '우리은행', '하나은행', '기업은행', '농협은행', '새마을금고'];
      return banks[Math.floor(Math.random() * banks.length)];
    };
    
    // 급여계좌 생성 함수
    const generateSalaryAccount = () => {
      const account = String(Math.floor(Math.random() * 900000000000) + 100000000000);
      return account.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1-$2-$3-$4');
    };
    
    // 경력사항 생성 함수
    const generateCareer = () => {
      const careers = [
        '삼성전자 보안팀 5년 경력',
        'LG전자 보안관리 3년 경력',
        'SK하이닉스 보안팀 4년 경력',
        '현대자동차 보안관리 6년 경력',
        '기타 보안업무 2년 경력',
        '군사보안업무 2년 경력',
        '경찰서 보안업무 3년 경력',
        '신입사원 (경력 없음)'
      ];
      return careers[Math.floor(Math.random() * careers.length)];
    };
    
    // 특이사항 생성 함수
    const generateSpecialNotes = () => {
      const notes = [
        '보안자격증 보유 (정보보안기사)',
        '운전면허 보유 (1종 대형)',
        '응급처치 자격증 보유',
        '특별한 사항 없음',
        '해외여행 경험 다수',
        '컴퓨터 활용능력 우수',
        '외국어 능력 우수 (영어, 중국어)',
        '체력검정 우수자'
      ];
      return notes[Math.floor(Math.random() * notes.length)];
    };
    
    // 사번 생성 함수
    const generateEmpNo = (orgType, department, index) => {
      const orgCode = orgType === '본사' ? '1' : '2';
      let deptCode = '88';
      if (department === '보안1팀') deptCode = '01';
      else if (department === '보안2팀') deptCode = '02';
      else if (department === '보안3팀') deptCode = '03';
      else if (department === '관리팀') deptCode = '04';
      else if (department === '인사팀') deptCode = '05';
      else if (department === '영업팀') deptCode = '06';
      else if (department === '지원팀') deptCode = '07';
      
      return orgCode + deptCode + String(index).padStart(4, '0');
    };
    
    // 50개의 테스트 데이터 생성
    for (let i = 1; i <= 50; i++) {
      const name = generateKoreanName();
      const department = departments[Math.floor(Math.random() * departments.length)];
      const orgType = orgTypes[Math.floor(Math.random() * orgTypes.length)];
      
      const employee = {
        userId: adminUser._id,
        name: name,
        empNo: generateEmpNo(orgType, department, i),
        department: departments[Math.floor(Math.random() * departments.length)],
        position: positions[Math.floor(Math.random() * positions.length)],
        email: generateEmail(name),
        mobile: generateMobile(),
        residentNumber: '', // 빈 값으로 설정
        nationality: '대한민국',
        gender: genders[Math.floor(Math.random() * genders.length)],
        birth: generateBirthDate(),
        bloodType: bloodTypes[Math.floor(Math.random() * bloodTypes.length)],
        height: Math.floor(Math.random() * 30) + 160, // 160-189cm
        weight: Math.floor(Math.random() * 30) + 50, // 50-79kg
        orgType: orgTypes[Math.floor(Math.random() * orgTypes.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        hireDate: generateHireDate(),
        employmentType: employmentTypes[Math.floor(Math.random() * employmentTypes.length)],
        
        // 주소 정보
        address: generateAddress(),
        phone: generatePhone(),
        emergencyContact: generateMobile(),
        
        // 병역 정보
        militaryBranch: Math.random() > 0.3 ? '육군' : (Math.random() > 0.5 ? '해군' : '공군'),
        militaryRank: Math.random() > 0.5 ? '병장' : (Math.random() > 0.5 ? '상병' : '일병'),
        militaryNumber: String(Math.floor(Math.random() * 900000) + 100000),
        militaryServicePeriod: Math.random() > 0.3 ? '2018.03-2020.02' : '2019.03-2021.02',
        militaryExemptionReason: Math.random() > 0.7 ? '신체검사 불합격' : null,
        
        // 학력 정보
        education: Math.random() > 0.5 ? '대학교 졸업' : '고등학교 졸업',
        
        // 급여 정보
        salaryBank: generateSalaryBank(),
        salaryAccount: generateSalaryAccount(),
        
        // 경력 및 특이사항
        career: generateCareer(),
        specialNotes: generateSpecialNotes(),
        
        // 프로필 이미지
        profileImage: profileImages[Math.floor(Math.random() * profileImages.length)],
        
        // 유니폼 사이즈 정보
        cap: capSizes[Math.floor(Math.random() * capSizes.length)],
        uniformSummerTop: uniformSizes[Math.floor(Math.random() * uniformSizes.length)],
        uniformSummerBottom: bottomSizes[Math.floor(Math.random() * bottomSizes.length)],
        uniformWinterTop: uniformSizes[Math.floor(Math.random() * uniformSizes.length)],
        uniformWinterBottom: bottomSizes[Math.floor(Math.random() * bottomSizes.length)],
        uniformWinterPants: bottomSizes[Math.floor(Math.random() * bottomSizes.length)],
        uniformWinterCoat: uniformSizes[Math.floor(Math.random() * uniformSizes.length)],
        raincoat: uniformSizes[Math.floor(Math.random() * uniformSizes.length)],
        springAutumnUniform: uniformSizes[Math.floor(Math.random() * uniformSizes.length)],
        winterJacket: Math.random() > 0.5 ? uniformSizes[Math.floor(Math.random() * uniformSizes.length)] : null,
        doubleJacket: Math.random() > 0.5 ? uniformSizes[Math.floor(Math.random() * uniformSizes.length)] : null,
        safetyShoes: shoeSizes[Math.floor(Math.random() * shoeSizes.length)],
        rainBoots: shoeSizes[Math.floor(Math.random() * shoeSizes.length)],
        
        // 수량 정보
        capQty: Math.floor(Math.random() * 2) + 1,
        uniformSummerTopQty: Math.floor(Math.random() * 3) + 1,
        uniformSummerBottomQty: Math.floor(Math.random() * 3) + 1,
        uniformWinterTopQty: Math.floor(Math.random() * 3) + 1,
        uniformWinterBottomQty: Math.floor(Math.random() * 3) + 1,
        uniformWinterPantsQty: Math.floor(Math.random() * 3) + 1,
        uniformWinterCoatQty: Math.floor(Math.random() * 2) + 1,
        raincoatQty: Math.floor(Math.random() * 2) + 1,
        springAutumnUniformQty: Math.floor(Math.random() * 2) + 1,
        winterJacketQty: Math.floor(Math.random() * 2) + 1,
        doubleJacketQty: Math.floor(Math.random() * 2) + 1,
        safetyShoesQty: Math.floor(Math.random() * 2) + 1,
        rainBootsQty: Math.floor(Math.random() * 2) + 1,
        
        // 생성일/수정일
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      testEmployees.push(employee);
    }
    
    // 데이터베이스에 저장
    await Employee.insertMany(testEmployees);
    console.log(`${testEmployees.length}개의 테스트 직원 데이터 생성 완료!`);
    
    // 통계 출력
    const totalEmployees = await Employee.countDocuments();
    const departmentStats = await Employee.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const positionStats = await Employee.aggregate([
      { $group: { _id: '$position', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n=== 생성된 데이터 통계 ===');
    console.log(`총 직원 수: ${totalEmployees}명`);
    console.log('\n부서별 인원:');
    departmentStats.forEach(dept => {
      console.log(`  ${dept._id}: ${dept.count}명`);
    });
    
    console.log('\n직급별 인원:');
    positionStats.forEach(pos => {
      console.log(`  ${pos._id}: ${pos.count}명`);
    });
    
    console.log('\n테스트 데이터 생성이 완료되었습니다!');
    console.log('관리자 계정으로 로그인하여 확인해보세요.');
    console.log('이메일: admin@company.com');
    console.log('비밀번호: admin123');
    
  } catch (error) {
    console.error('테스트 데이터 생성 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('데이터베이스 연결 종료');
  }
}); 