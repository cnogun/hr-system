# 파일명: Dockerfile
# 목적: HR 관리 시스템 Docker 컨테이너 설정
# 기능:
# - Node.js 애플리케이션 컨테이너화
# - 의존성 설치 및 빌드
# - 포트 설정 및 환경 변수 관리
# - 프로덕션 배포 최적화

# Node.js 18 이미지 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 애플리케이션 코드 복사
COPY . .

# uploads 폴더 생성
RUN mkdir -p uploads

# 포트 설정
EXPOSE 10000

# 애플리케이션 실행
CMD ["npm", "start"] 