# Car Market

실시간 중고차 매물 검색, 딜러 차량 등록, 이미지 업로드, Firebase 인증, Socket.io 상담 기능을 포함한 중고차 마켓 MVP 프로젝트입니다.

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

## 주요 기능

- 차량 목록 조회 및 상세 조회
- 조건별 차량 검색
  - 차량명, 제조사, 가격, 연식, 주행거리, 지역, 연료, 변속기 등
- Firebase Authentication 기반 회원가입, 로그인, 로그아웃
- MongoDB `users` 컬렉션에 사용자 프로필 저장
- buyer/dealer 역할 기반 화면 및 권한 분기
- dealer 차량 등록, 수정, 삭제
- Multer 기반 차량 이미지 업로드
  - 최대 8장 업로드
  - 대표 이미지는 `imageUrl`, 전체 이미지는 `imageUrls` 배열로 관리
  - 기존 이미지 유지/삭제 및 새 이미지 추가
- 차량 카드와 상세 화면 이미지 갤러리
- 상담방 생성 및 상담방 목록
- Socket.io 기반 실시간 상담
- 딜러 온라인/오프라인 상태 표시
- AI Agent 자동응답 확장 준비
  - 현재 OpenAI API 호출은 구현하지 않음
  - 메시지 처리 구조만 `handleChatMessage`, `generateAgentReply`로 분리

## 사용 기술

### Frontend

- React
- Vite
- Tailwind CSS
- React Router
- Axios
- Firebase Authentication
- Socket.io Client

### Backend

- Node.js
- Express
- MongoDB Native Driver
- MongoDB Atlas
- Multer
- Socket.io
- dotenv
- cors

### Deployment

- Render 배포 예정

## 폴더 구조

```text
car-market/
├── client/
│   ├── public/
│   │   └── images/
│   ├── src/
│   │   ├── api/
│   │   │   ├── api.js
│   │   │   └── socket.js
│   │   ├── components/
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── firebase/
│   │   │   └── firebase.js
│   │   ├── pages/
│   │   │   ├── CarListPage.jsx
│   │   │   ├── CarDetailPage.jsx
│   │   │   ├── CarNewPage.jsx
│   │   │   ├── CarEditPage.jsx
│   │   │   ├── ChatListPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── cors.js
│   │   │   └── db.js
│   │   ├── controllers/
│   │   ├── middleware/
│   │   │   └── upload.js
│   │   ├── routes/
│   │   ├── services/
│   │   │   └── chatMessageHandler.js
│   │   ├── app.js
│   │   ├── server.js
│   │   └── socket.js
│   ├── uploads/
│   ├── .env.example
│   └── package.json
└── README.md
```

## 로컬 실행 방법

### 1. 의존성 설치

```bash
cd server
npm install

cd ../client
npm install
```

### 2. 환경 변수 설정

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

각 `.env` 값을 실제 MongoDB Atlas, Firebase 프로젝트 값으로 수정합니다.

### 3. 서버 실행

```bash
cd server
npm run dev
```

기본 서버 주소:

```text
http://localhost:3000
```

Health check:

```text
GET http://localhost:3000/api/health
```

### 4. 클라이언트 실행

```bash
cd client
npm run dev
```

기본 클라이언트 주소:

```text
http://localhost:5173
```

개발 환경 CORS는 아래 주소를 허용합니다.

```text
http://localhost:5173
http://127.0.0.1:5173
```

## 환경 변수

### client/.env

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

### server/.env

```env
PORT=3000
MONGODB_URI=your_mongodb_atlas_uri
DB_NAME=car_market
CLIENT_URL=http://localhost:5173
```

`CLIENT_URL`은 콤마로 여러 origin을 지정할 수 있습니다.

```env
CLIENT_URL=http://localhost:5173,http://127.0.0.1:5173
```

## MongoDB Atlas 설정

1. MongoDB Atlas에서 프로젝트와 클러스터를 생성합니다.
2. Database Access에서 DB 사용자를 생성합니다.
3. Network Access에서 현재 IP를 허용합니다.
4. Connect 메뉴에서 connection string을 복사합니다.
5. `server/.env`의 `MONGODB_URI`에 저장합니다.
6. `DB_NAME`은 기본값으로 `car_market`을 사용합니다.

사용 컬렉션:

- `cars`
- `users`
- `chat_rooms`
- `messages`

## Firebase Authentication 설정

1. Firebase Console에서 프로젝트를 생성합니다.
2. Authentication 메뉴에서 Email/Password 로그인을 활성화합니다.
3. 프로젝트 설정에서 Web App을 추가합니다.
4. Firebase 설정값을 `client/.env`의 `VITE_FIREBASE_*` 값에 입력합니다.
5. 회원가입 시 Firebase 계정 생성 후 MongoDB `users` 컬렉션에 사용자 프로필을 저장합니다.

회원가입 입력 정보:

- email
- password
- displayName
- role: `buyer` 또는 `dealer`

## 차량 기능

### 차량 목록 및 검색

목록 화면 `/`에서 차량 목록을 조회하고 필터를 적용할 수 있습니다.

검색 API:

```text
GET /api/cars/search
```

지원 조건:

- `keyword`
- `company`
- `minPrice`
- `maxPrice`
- `minYear`
- `maxYear`
- `type`
- `fuel`
- `location`
- `minMileage`
- `maxMileage`
- `transmission`

### 차량 등록

dealer 사용자만 `/cars/new`에서 차량을 등록할 수 있습니다.

등록 API:

```text
POST /api/cars
```

등록 항목:

- name
- company
- price
- year
- type
- fuel
- mileage
- location
- description
- transmission
- dealerId
- dealerName
- images

### 차량 수정/삭제

본인이 등록한 차량만 상세 화면에서 수정/삭제할 수 있습니다.

```text
PUT /api/cars/:id
DELETE /api/cars/:id
```

서버에서도 요청 uid와 차량의 `dealerId`를 비교해 최소한의 권한 확인을 수행합니다.

## 이미지 업로드

- Multer를 사용해 `server/uploads` 폴더에 이미지 파일을 저장합니다.
- 차량 등록/수정 시 최대 8장까지 업로드할 수 있습니다.
- MongoDB에는 다음 필드를 저장합니다.
  - `imageUrl`: 대표 이미지
  - `imageUrls`: 전체 이미지 URL 배열
  - `imageNames`: 원본 파일명 배열

주의:

- 현재 이미지는 서버 로컬 `uploads` 폴더에 저장됩니다.
- Render 무료 환경에서는 서버 재시작 또는 재배포 시 업로드 파일이 유지되지 않을 수 있습니다.
- 운영 환경에서는 S3, Cloudinary, Firebase Storage 같은 외부 스토리지 연동이 필요합니다.

## 상담 기능

### 상담방 생성

차량 상세 또는 차량 카드에서 `상담하기`를 클릭하면 상담방을 생성하거나 기존 상담방을 반환합니다.

```text
POST /api/chats/rooms
```

상담방 ID 형식:

```text
carId_buyerId_dealerId
```

### 상담방 목록

```text
GET /api/chats/rooms?uid=현재사용자UID
```

- buyer는 본인이 만든 상담방만 조회합니다.
- dealer는 본인 차량 관련 상담방만 조회합니다.
- 최신 메시지 순으로 표시합니다.

화면:

```text
/chats
```

### 실시간 상담

화면:

```text
/chats/:roomId
```

Socket.io 이벤트:

- `join-room`
- `leave-room`
- `send-message`
- `receive-message`
- `dealer-online`
- `dealer-offline`

기존 메시지는 REST API로 조회하고, 새 메시지는 Socket.io로 실시간 전송합니다.

메시지 저장:

```text
POST /api/chats/rooms/:roomId/messages
GET /api/chats/rooms/:roomId/messages?uid=현재사용자UID
```

## 딜러 온라인/오프라인 상태

- 딜러가 Socket.io에 연결되면 서버 메모리에서 온라인 상태로 관리합니다.
- 딜러 연결이 끊기면 오프라인 상태로 변경합니다.
- 같은 딜러가 여러 탭에서 접속해도 연결 수를 기준으로 관리합니다.
- 채팅 화면에서는 buyer에게 딜러 상태를 작은 점과 텍스트로 표시합니다.
  - 초록 점: 온라인
  - 회색 점: 오프라인

## AI Agent 확장 준비

현재 AI 자동응답은 구현하지 않았습니다.

다만 Socket.io 메시지 처리 구조를 아래처럼 분리해두었습니다.

- `server/src/services/chatMessageHandler.js`
  - `handleChatMessage`
  - `generateAgentReply`

현재 `generateAgentReply`는 `null`을 반환합니다. 이후 딜러가 오프라인일 때 상담방 정보, 차량 정보, 이전 메시지를 바탕으로 AI 응답을 생성하도록 확장할 수 있습니다.

## API 요약

### Health

```text
GET /api/health
```

### Cars

```text
GET /api/cars
GET /api/cars/search
GET /api/cars/:id
POST /api/cars
PUT /api/cars/:id
DELETE /api/cars/:id
```

### Users

```text
POST /api/users
GET /api/users/me?uid=...
GET /api/users/dealers
```

### Chats

```text
POST /api/chats/rooms
GET /api/chats/rooms?uid=...
GET /api/chats/rooms/:roomId/messages?uid=...
POST /api/chats/rooms/:roomId/messages
```

## Render 배포

배포 주소:

```text
배포 예정
```

작성란:

- Client:
- Server:

배포 시 확인할 사항:

- `server/.env` 환경 변수 등록
- `client/.env`의 `VITE_API_BASE_URL`을 배포된 서버 주소로 변경
- Firebase Authentication Authorized domains에 배포 도메인 추가
- MongoDB Atlas Network Access 설정 확인
- Render 무료 환경의 로컬 uploads 저장소 휘발성 확인

## 제출용 화면 캡처 목록

- 차량 목록 및 필터 화면
- 차량 상세 화면
- 차량 등록 화면
- 차량 수정 화면
- 다중 이미지 업로드 및 미리보기
- 로그인 화면
- 회원가입 화면
- 상담방 목록 화면
- 실시간 상담 화면
- 딜러 온라인/오프라인 상태 표시
- MongoDB Atlas 컬렉션 데이터
- Firebase Authentication 사용자 목록
