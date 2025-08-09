# 배포 가이드 (Render + MongoDB Atlas)

## 1. 사전 준비
- GitHub 계정, Render 계정, MongoDB Atlas 계정
- 코드 푸시: GitHub에 현재 프로젝트를 업로드

## 2. MongoDB Atlas 설정 (무료 M0)
1) Atlas 로그인 → Project 생성 → Free(M0) 클러스터 생성
2) Database Access: DB 사용자 생성 (아이디/비밀번호)
3) Network Access: 0.0.0.0/0 허용(테스트) 또는 Render 고정 IP만 허용
4) Connect → Drivers → SRV URI 복사 → `.env.example`의 `MONGODB_URI` 참고

## 3. Render 웹 서비스 생성
1) Render → New → Web Service → GitHub 레포 선택
2) 환경설정
   - Build Command: `npm install`
   - Start Command: `node app.js`
   - Environment: Node
   - Plan: Free
3) Environment Variables 추가
   - `MONGODB_URI`: Atlas URI
   - `SESSION_SECRET`: 강한 랜덤 문자열
   - `PORT`: 설정 불필요(Render 자동 주입)
4) Deploy

## 4. 배포 후 확인 체크리스트
- `/healthz` → "OK" 응답 확인
- 로그인/세션 정상
- 직원 찾기/상세/게시판 정상

## 5. 업로드 파일(이미지) 주의
- 현재 `/uploads`는 서버 로컬 저장소입니다
- Render 무료 플랜은 재시작/재배포 시 파일 유실 가능
- 영구 저장을 원하면 Cloudinary 연동 권장

## 6. 권장 .env 예시
`.env.example` 파일 참고 후 Render 대시보드에 환경변수로 설정

## 7. 문제 해결
- DB 연결 실패: `MONGODB_URI`/IP 허용 범위 확인
- 포트 충돌: Render에서는 `PORT`를 지정하지 말 것
- 첫 요청 느림: 무료 플랜 슬립 현상(정상)

