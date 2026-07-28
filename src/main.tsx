import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedDevDataIfNeeded } from '@/data/seed'

// 발주관리/공지사항(Supabase 이전 대상 아님)만 최초 1회 목데이터로 채웁니다.
// 직원관리/스케줄/근로시간/휴무신청/급여관리는 Supabase에서 관리합니다.
seedDevDataIfNeeded()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
