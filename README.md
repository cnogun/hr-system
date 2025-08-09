# 직원 관리 시스템 (Employee Management System)

## 개요
이 프로젝트는 직원 정보를 관리하고, 유니폼 사이즈를 추적하며, 공지사항을 관리할 수 있는 웹 애플리케이션입니다.

## 주요 기능

### 1. 직원 관리
- 직원 정보 등록, 수정, 삭제
- 엑셀 파일을 통한 대량 직원 등록
- 직원 정보 엑셀 다운로드
- 직원 검색 및 필터링

### 2. 유니폼 관리
- 유니폼 사이즈별 수량 관리
- 유니폼 요약 통계
- 엑셀 파일을 통한 유니폼 데이터 업로드

### 3. 공지사항 관리
- 공지사항 작성, 수정, 삭제
- 공지사항 목록 조회

### 4. 사용자 인증
- 회원가입 및 로그인
- **비밀번호 찾기 기능** (새로 추가)
- 사용자 권한 관리
- 활동 로그 추적

## 비밀번호 찾기 기능

### 새로운 보안 기능
- **토큰 기반 비밀번호 재설정**: 임시 비밀번호 대신 안전한 토큰 사용
- **1시간 만료**: 보안을 위한 토큰 자동 만료
- **이메일 템플릿**: 전문적인 HTML 이메일 템플릿
- **실시간 유효성 검사**: 비밀번호 요구사항 실시간 확인

### 사용 방법
1. 로그인 페이지에서 "비밀번호 찾기" 클릭
2. 가입 시 등록한 이메일 주소 입력
3. 이메일로 받은 링크 클릭
4. 새로운 비밀번호 설정
5. 자동으로 로그인 페이지로 이동

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`config.env.example` 파일을 참고하여 `.env` 파일을 생성하세요:

```env
# 데이터베이스 설정
MONGODB_URI=mongodb://localhost:27017/hr_system
PORT=3000
SESSION_SECRET=your-secret-key

# 이메일 설정 (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# 애플리케이션 설정
NODE_ENV=development
```

### 3. Gmail 앱 비밀번호 설정
1. Gmail 계정에서 2단계 인증 활성화
2. 앱 비밀번호 생성: https://myaccount.google.com/apppasswords
3. 생성된 16자리 비밀번호를 `EMAIL_PASS`에 설정

### 4. 애플리케이션 실행
```bash
npm start
```

## 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: MongoDB, Mongoose
- **Template Engine**: EJS
- **Authentication**: bcrypt, express-session
- **Email**: Nodemailer
- **File Upload**: Multer
- **Excel Processing**: ExcelJS

## 보안 기능

- 비밀번호 해싱 (bcrypt)
- 세션 관리
- CSRF 보호
- 입력 데이터 검증
- 토큰 기반 비밀번호 재설정
- 활동 로그 추적

## 파일 구조

```
├── app.js                 # 메인 애플리케이션 파일
├── models/               # 데이터베이스 모델
│   ├── Employee.js      # 직원 모델
│   ├── User.js          # 사용자 모델
│   ├── Log.js           # 로그 모델
│   ├── Notice.js        # 공지사항 모델
│   └── PasswordReset.js # 비밀번호 재설정 모델 (새로 추가)
├── routes/              # 라우트 파일들
│   ├── auth.js          # 인증 관련 라우트
│   ├── employees.js     # 직원 관리 라우트
│   ├── uniform.js       # 유니폼 관리 라우트
│   └── notice.js        # 공지사항 라우트
├── views/               # EJS 템플릿 파일들
│   ├── login.ejs        # 로그인 페이지
│   ├── forgotPassword.ejs # 비밀번호 찾기 페이지 (개선됨)
│   ├── resetPassword.ejs  # 비밀번호 재설정 페이지 (새로 추가)
│   └── ...
└── uploads/             # 업로드된 파일들
```

## 라이센스

ISC License 