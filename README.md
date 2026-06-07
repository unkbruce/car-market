# Car Market

실시간 중고차 매물 검색, 딜러 차량 관리, 샘플/업로드 이미지 관리, Firebase 인증, Socket.io 상담 기능을 포함한 중고차 마켓 MVP입니다.

![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-2F2F46?style=flat&logo=vite&logoColor=FFD62E)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-0F172A?style=flat&logo=tailwindcss&logoColor=38BDF8)
![Node.js](https://img.shields.io/badge/Node.js-1F2937?style=flat&logo=nodedotjs&logoColor=5FA04E)
![Express](https://img.shields.io/badge/Express-111827?style=flat&logo=express&logoColor=FFFFFF)
![MongoDB](https://img.shields.io/badge/MongoDB-11231A?style=flat&logo=mongodb&logoColor=47A248)
![Firebase](https://img.shields.io/badge/Firebase-1F2937?style=flat&logo=firebase&logoColor=FFCA28)
![Socket.io](https://img.shields.io/badge/Socket.io-111827?style=flat&logo=socketdotio&logoColor=FFFFFF)
![Multer](https://img.shields.io/badge/Multer-334155?style=flat)
![Render](https://img.shields.io/badge/Render-111827?style=flat&logo=render&logoColor=46E3B7)

배포 주소:

- Frontend: [https://car-market-qxf3.onrender.com](https://car-market-qxf3.onrender.com)
- Backend: [https://car-market-server.onrender.com](https://car-market-server.onrender.com)

## 기술 스택

Frontend:

- React
- Vite
- Tailwind CSS
- React Router
- Axios
- Firebase Authentication
- Socket.io Client
- lucide-react

Backend:

- Node.js
- Express
- MongoDB Native Driver
- MongoDB Atlas
- Multer
- Socket.io
- dotenv
- cors

Deployment:

- Render

## 주요 기능

인증 및 권한:

- Firebase Authentication 기반 회원가입, 로그인, 로그아웃
- 회원가입 시 `buyer` 또는 `dealer` 역할로 구분
- MongoDB Atlas에 사용자 프로필 저장
- 딜러는 본인이 등록한 차량만 수정/삭제 가능

차량 목록:

- 차량 목록 조회 및 상세 조회
- 차량명, 제조사, 차종, 연식, 가격, 주행거리, 지역, 연료, 변속기 필터
- 최신순, 낮은 가격순, 높은 가격순, 최신 연식순, 낮은 주행거리순 정렬
- 검색/필터 결과 기준 9개 단위 페이지네이션
- 반응형 차량 카드 그리드: 데스크톱 3열, 태블릿 2열, 모바일 1열
- 차량 카드 전체 클릭으로 상세페이지 이동
- 카드 내 상담하기 버튼은 기존 상담방 생성 흐름 유지

차량 등록/수정:

- 딜러 차량 등록, 수정, 삭제
- 차량명, 제조사, 가격, 연식, 차종, 연료, 주행거리, 지역, 변속기, 외장 색상, 설명 입력
- 외장 색상은 직접 입력 text field로 관리
- 직접 파일 업로드와 샘플 이미지 선택 지원
- 등록/수정 화면 모두 샘플 이미지 선택 가능
- `client/public/images/cars/`의 샘플 이미지 사용
- `client/src/data/sampleCarImages.js`에서 샘플 이미지 목록 관리
- 기존 이미지, 새 업로드 이미지, 샘플 이미지 합산 최대 8장 관리
- 이미지 개별 추가/삭제
- 샘플 이미지는 클릭 순서대로 선택되고 `imageUrls` 배열에 저장
- 첫 번째 이미지를 대표 이미지 `imageUrl`로 저장

차량 상세:

- 주요 스펙, 요약 카드, 상세 설명 표시
- 상세 이미지 썸네일 선택
- 이전/다음 화살표로 이미지 순환
- 키보드 좌우 방향키 이미지 이동
- 모바일 터치 스와이프 이미지 이동
- 이미지가 1장일 때 화살표 숨김
- 판매자 본인 화면에서는 상담 버튼 대신 수정/삭제 버튼 표시

상담:

- 구매자/딜러 상담방 목록
- 차량 카드 또는 상세페이지에서 상담방 생성/이동
- Socket.io 기반 실시간 메시지
- 메시지 MongoDB 저장
- Enter 전송, Shift+Enter 줄바꿈
- 딜러 온라인/오프라인 상태 표시
- 딜러 온라인 상태는 채팅방 화면에서만 표시

AI Agent 확장:

- AI 자동응답은 구현 완료 상태가 아닙니다.
- 상담 메시지 처리 구조를 `server/src/services/chatMessageHandler.js`로 분리해 AI Agent 확장을 준비했습니다.

## 프로젝트 구조

핵심 파일 위주 구조입니다.

```text
car-market/
├── client/
│   ├── public/
│   │   └── images/
│   │       ├── car-placeholder.png
│   │       └── cars/
│   └── src/
│       ├── api/
│       │   ├── api.js
│       │   └── socket.js
│       ├── components/
│       │   ├── CarCard.jsx
│       │   ├── CarImagePlaceholder.jsx
│       │   ├── Header.jsx
│       │   └── StatusMessage.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── data/
│       │   └── sampleCarImages.js
│       ├── firebase/
│       │   └── firebase.js
│       ├── pages/
│       │   ├── CarListPage.jsx
│       │   ├── CarDetailPage.jsx
│       │   ├── CarNewPage.jsx
│       │   ├── CarEditPage.jsx
│       │   ├── ChatListPage.jsx
│       │   ├── ChatPage.jsx
│       │   ├── LoginPage.jsx
│       │   └── RegisterPage.jsx
│       └── utils/
│           ├── carOptions.js
│           ├── chat.js
│           └── formatters.js
├── server/
│   └── src/
│       ├── config/
│       │   ├── cors.js
│       │   └── db.js
│       ├── controllers/
│       │   ├── carController.js
│       │   ├── chatController.js
│       │   └── userController.js
│       ├── middleware/
│       │   └── upload.js
│       ├── routes/
│       │   ├── cars.js
│       │   ├── chats.js
│       │   └── users.js
│       ├── services/
│       │   └── chatMessageHandler.js
│       ├── app.js
│       ├── server.js
│       └── socket.js
├── docs/
│   └── screenshots/
│       ├── car-list.png
│       ├── car-detail-buyer.png
│       ├── car-detail-dealer.png
│       ├── car-register-form.png
│       ├── car-register-images.png
│       └── realtime-chat.png
└── README.md
```

## 로컬 실행

의존성 설치:

```bash
cd server
npm install

cd ../client
npm install
```

서버 실행:

```bash
cd server
npm run dev
```

클라이언트 실행:

```bash
cd client
npm run dev
```

기본 로컬 주소:

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- Health check: `GET http://localhost:3000/api/health`

## 환경 변수

실제 값과 비밀정보는 저장소에 노출하지 않습니다. 로컬과 Render 환경 변수에 각각 설정합니다.

Frontend:

```text
VITE_API_BASE_URL
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Backend:

```text
PORT
MONGODB_URI
DB_NAME
CLIENT_URL
```

`CLIENT_URL`은 CORS 허용 origin입니다. 여러 origin이 필요하면 콤마로 구분합니다.

## 데이터 저장

MongoDB Atlas 컬렉션:

- `cars`
- `users`
- `chat_rooms`
- `messages`

차량 이미지 관련 필드:

- `imageUrl`: 대표 이미지
- `imageUrls`: 전체 이미지 URL 배열
- `imageNames`: 이미지 파일명 배열

샘플 이미지는 `client/public/images/cars/`의 프론트 정적 파일로 배포되어 유지되며, MongoDB에는 해당 정적 파일 경로를 문자열로 저장합니다. 직접 업로드 이미지는 Multer를 통해 Render 서버 로컬 파일 시스템에 저장하고, MongoDB에는 이미지 URL을 저장합니다.

## API 요약

Health:

```text
GET /api/health
```

Cars:

```text
GET /api/cars
GET /api/cars/search
GET /api/cars/:id
POST /api/cars
PUT /api/cars/:id
DELETE /api/cars/:id
```

Users:

```text
POST /api/users
GET /api/users/me?uid=...
GET /api/users/dealers
```

Chats:

```text
POST /api/chats/rooms
GET /api/chats/rooms?uid=...
GET /api/chats/rooms/:roomId/messages?uid=...
POST /api/chats/rooms/:roomId/messages
```

Socket.io 이벤트:

- `join-room`
- `leave-room`
- `send-message`
- `receive-message`
- `dealer-online`
- `dealer-offline`

## Render 배포

Backend:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`
- 환경 변수: `MONGODB_URI`, `DB_NAME`, `CLIENT_URL`
- Render에서는 `PORT` 환경 변수가 자동으로 제공됩니다.

Frontend:

- Root Directory: `client`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- 환경 변수: `VITE_API_BASE_URL`, `VITE_FIREBASE_*`

추가 설정:

- `VITE_API_BASE_URL`은 배포된 Backend 주소로 설정
- Backend `CLIENT_URL`은 배포된 Frontend 주소로 설정
- Firebase Authentication Authorized domains에 배포 도메인 등록
- React Router Rewrite 설정: `/*` → `/index.html`
- MongoDB Atlas Network Access와 Database Access 설정 확인

Render 무료 서버 주의:

- `client/public/images/cars/`의 샘플 이미지는 프론트 정적 파일로 배포되어 유지됩니다.
- Multer로 직접 업로드한 이미지는 Render 서버 로컬 파일 시스템에 저장됩니다.
- Render 무료 환경에서는 재배포, 재시작, 인스턴스 교체 시 직접 업로드 이미지가 사라질 수 있습니다.
- 운영 환경에서는 S3, Cloudinary, Firebase Storage 같은 외부 스토리지 연동이 필요합니다.

## 샘플 이미지 관리

샘플 차량 이미지는 다음 위치를 기준으로 관리합니다.

```text
client/public/images/cars/
client/src/data/sampleCarImages.js
```

샘플 차량 추가 방법:

1. `client/public/images/cars/차량-폴더명/`에 이미지 파일을 추가합니다.
2. `client/src/data/sampleCarImages.js`에 id, label, imageUrls를 추가합니다.
3. `imageUrls`는 브라우저에서 접근 가능한 `/images/cars/...` 경로로 작성합니다.
4. 한 차량당 최대 8장까지 선택될 수 있습니다.

## 주요 화면

### 차량 목록 및 필터

차량 검색, 정렬, 제조사 및 조건별 필터, 반응형 차량 카드 화면을 확인할 수 있습니다.

<img src="docs/screenshots/car-list.png" alt="차량 목록 및 필터 화면" width="900" />

### 구매자 차량 상세

차량 이미지 갤러리, 주요 스펙, 상세 설명, 상담하기 기능을 확인할 수 있습니다.

<img src="docs/screenshots/car-detail-buyer.png" alt="구매자 차량 상세 화면" width="900" />

### 딜러 차량 관리

딜러가 본인 차량을 조회하고 수정·삭제할 수 있는 화면입니다.

<img src="docs/screenshots/car-detail-dealer.png" alt="딜러 차량 관리 화면" width="900" />

### 딜러 차량 등록

차량 기본 정보와 상세 설명을 입력하는 화면입니다.

<img src="docs/screenshots/car-register-form.png" alt="딜러 차량 등록 기본 정보 입력 화면" width="900" />

직접 업로드 또는 샘플 이미지를 최대 8장까지 선택할 수 있습니다.

<img src="docs/screenshots/car-register-images.png" alt="딜러 차량 등록 이미지 선택 화면" width="900" />

### 구매자/딜러 실시간 상담

구매자와 딜러가 같은 상담방에서 실시간 메시지를 주고받는 화면입니다. 딜러 온라인 상태와 좌우로 구분된 메시지 UI를 확인할 수 있습니다.

<img src="docs/screenshots/realtime-chat.png" alt="구매자와 딜러 실시간 상담 화면" width="900" />

## 구현 메모

- 관리자 기능은 구현되어 있지 않습니다.
- AI Agent는 구현 완료가 아니라 상담 처리 구조 분리와 확장 준비 상태입니다.
- 검색, 정렬, 페이지네이션은 현재 프론트엔드 중심으로 동작합니다.
- 서버 API 구조는 REST API와 Socket.io 이벤트를 함께 사용합니다.
