# Push Notification 운영 설정

코드에는 비밀키를 저장하지 않습니다. 아래 값이 등록되기 전에는 앱이 빌드되지만 알림 연결 버튼은 비활성화됩니다.

## 1. Supabase SQL

Supabase Dashboard → SQL Editor에서 다음 파일 전체를 실행합니다.

- `supabase/migrations/20260729000000_push_notifications.sql`
- `supabase/migrations/20260729010000_notification_operations.sql`

두 파일을 번호 순서대로 실행합니다. 공지사항, 기기별 Push Token, 알림별 설정, 발송 작업, 성공·실패·읽음 이력, 재시도 및 예외 로그를 생성합니다.

## 2. Vercel 환경변수

Vercel Dashboard → Project → Settings → Environment Variables → Production에 등록합니다.

| 환경변수 | 설명 |
| --- | --- |
| `VITE_PUSH_ENABLED` | 운영 활성화 시 `true`, 개발 기본값은 미설정 또는 `false` |
| `VITE_PUSH_ENVIRONMENT` | 운영 `production`, 개발 `development` |
| `VITE_FIREBASE_API_KEY` | Firebase Web App config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Web App config |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Web App config |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Web App config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web App config |
| `VITE_FIREBASE_APP_ID` | Firebase Web App config |
| `VITE_FIREBASE_VAPID_PUBLIC_KEY` | FCM Web Push 공개키 |
| `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` | iPhone 표준 Web Push 공개키 |

`VITE_` 값은 브라우저에 전달되는 공개 설정만 사용합니다. 비밀키를 등록하면 안 됩니다.

## 3. Supabase Edge Function 환경변수

Supabase Dashboard → Edge Functions → Secrets에 등록합니다.

| 환경변수 | 설명 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Service Account JSON 전체 문자열 |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | iPhone 표준 Web Push 공개키 |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | iPhone 표준 Web Push 비밀키 |
| `WEB_PUSH_SUBJECT` | `mailto:관리자이메일` 형식 |
| `PUSH_CRON_SECRET` | 충분히 긴 임의 문자열 |
| `PUSH_ENVIRONMENT` | 운영 함수는 `production`, 개발 함수는 `development` |

`FIREBASE_SERVICE_ACCOUNT_JSON`과 `WEB_PUSH_VAPID_PRIVATE_KEY`는 코드, GitHub, Vercel 클라이언트 환경변수에 등록하지 않습니다.

Firebase Console에서는 Cloud Messaging API와 FCM Registration API를 활성화해야 합니다.

## 개발/운영 분리

- 개발과 운영은 서로 다른 Firebase 프로젝트 및 Supabase 프로젝트 사용을 권장합니다.
- 개발 Vercel/로컬 환경은 `VITE_PUSH_ENVIRONMENT=development`
- Production은 `VITE_PUSH_ENVIRONMENT=production`
- Edge Function도 동일하게 `PUSH_ENVIRONMENT`를 맞춥니다.
- 구독 테이블은 환경별로 분리되며 운영 발송 함수는 운영 기기 Token만 조회합니다.
- Firebase/VAPID 값이 모두 등록된 뒤 `VITE_PUSH_ENABLED=true`로 배포해야 최초 알림 안내가 표시됩니다.

## Token 수명주기

- 사용자가 로그인하고 알림 권한이 이미 허용되어 있으면 현재 Token을 자동 갱신합니다.
- 같은 로그인 사용자·기기·채널·환경에는 구독 한 건만 유지합니다.
- 로그아웃하면 브라우저 구독을 해지하고 해당 기기 Token을 Supabase에서 삭제합니다.
- FCM 또는 Web Push가 `404/410`을 반환하면 만료 Token을 자동 비활성화합니다.

## 4. Edge Function

배포 대상:

- `supabase/functions/process-notifications`

이 함수는 FCM과 iPhone 표준 Web Push를 하나의 발송 큐에서 처리합니다.
`supabase/config.toml`에서 JWT 사전 검증을 끄되, 함수 내부에서 로그인 JWT 또는 `PUSH_CRON_SECRET`을 직접 검증합니다. 따라서 Cron 호출과 로그인 사용자의 즉시 발송 요청을 모두 안전하게 처리할 수 있습니다.

## 5. 예약 실행

Supabase Dashboard → Integrations → Cron에서 1분마다 `process-notifications` Edge Function을 호출하도록 설정합니다.

- Schedule: `* * * * *`
- Method: `POST`
- URL: `<SUPABASE_URL>/functions/v1/process-notifications`
- Header: `x-cron-secret: <PUSH_CRON_SECRET>`
- Authorization: Supabase가 제공하는 Edge Function 호출 인증 설정 사용

예약 함수는 Asia/Seoul 기준으로 다음 작업을 생성합니다.

- 매일 21:00 관리자 발주 확인
- 매일 22:00 스케줄이 있고 근로시간이 없는 직원
- 화요일 20:00 다음 주 휴무 신청
- 매일 10:00 직원별 급여일 D-1 및 당일

`event_key`, `job_id + subscription_id` 고유 제약으로 같은 이벤트와 같은 기기에 중복 발송되지 않습니다.

실패한 작업은 2분부터 최대 60분까지 지수형 간격으로 최대 5회 재시도합니다. 각 실패 원인은 `notification_error_logs`에 저장됩니다.

## 관리자 알림 관리

- `/notifications`에서 전체 직원 또는 특정 직원을 선택할 수 있습니다.
- 즉시 발송 및 예약 발송을 지원합니다.
- 전체 직원 테스트와 특정 직원 테스트를 지원합니다.
- 최근 100건의 성공, 실패, 읽음, 시도 횟수를 확인할 수 있습니다.
- 기존 작업을 새 이벤트로 복제해 재발송할 수 있습니다.

읽음 여부는 사용자가 알림을 눌러 앱이 열리고 Supabase 로그인 세션이 복원된 경우 기록됩니다. 운영체제 알림 센터에서 알림을 지우기만 한 경우에는 읽음으로 기록할 수 없습니다.

## 6. 실제 기기 테스트

### Android / Chrome

1. Production 앱 로그인
2. 알림 안내에서 `알림 허용`
3. 설정 → 알림 설정 → `테스트 알림 보내기`
4. 앱을 닫거나 백그라운드로 전환한 뒤 수신 확인

### iPhone

1. iOS 16.4 이상 Safari에서 Production 주소 열기
2. 공유 → 홈 화면에 추가
3. 홈 화면 아이콘으로 앱 실행
4. 알림 안내에서 `알림 허용`
5. 설정 → 알림 설정 → `테스트 알림 보내기`
6. 앱을 닫은 상태에서 수신 및 알림 클릭 이동 확인

iPhone Safari 탭에서는 알림 등록을 시도하지 않으며, 홈 화면에 설치된 standalone PWA에서만 등록합니다.
