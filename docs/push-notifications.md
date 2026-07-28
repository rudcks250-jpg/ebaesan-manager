# Push Notification 운영 설정

코드에는 비밀키를 저장하지 않습니다. 아래 값이 등록되기 전에는 앱이 빌드되지만 알림 연결 버튼은 비활성화됩니다.

## 1. Supabase SQL

Supabase Dashboard → SQL Editor에서 다음 파일 전체를 실행합니다.

- `supabase/migrations/20260729000000_push_notifications.sql`

이 SQL은 공지사항, Push Token, 알림별 설정, 발송 작업, 발송 이력 및 중복 방지 테이블을 생성합니다.

## 2. Vercel 환경변수

Vercel Dashboard → Project → Settings → Environment Variables → Production에 등록합니다.

| 환경변수 | 설명 |
| --- | --- |
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

`FIREBASE_SERVICE_ACCOUNT_JSON`과 `WEB_PUSH_VAPID_PRIVATE_KEY`는 코드, GitHub, Vercel 클라이언트 환경변수에 등록하지 않습니다.

Firebase Console에서는 Cloud Messaging API와 FCM Registration API를 활성화해야 합니다.

## 4. Edge Function

배포 대상:

- `supabase/functions/process-notifications`

이 함수는 FCM과 iPhone 표준 Web Push를 하나의 발송 큐에서 처리합니다.

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
