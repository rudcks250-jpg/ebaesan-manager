import { useEffect, useMemo, useState } from 'react';
import { BellRing, RefreshCw, Send, Users } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Input, Select, Textarea } from '@/components/common/Input';
import { useToast } from '@/components/common/Toast';
import { employeeService } from '@/services/employeeService';
import {
  notificationService,
  type NotificationHistoryItem,
} from '@/services/notificationService';
import { formatDateTimeKo } from '@/utils/date';
import type { Employee } from '@/data/types';

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const statusMeta: Record<NotificationHistoryItem['status'], { label: string; tone: BadgeTone }> = {
  pending: { label: '대기', tone: 'pending' },
  processing: { label: '발송 중', tone: 'leave' },
  sent: { label: '완료', tone: 'approved' },
  failed: { label: '실패/재시도', tone: 'rejected' },
};

export function NotificationAdminPage() {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [target, setTarget] = useState('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('/dashboard');
  const [scheduledFor, setScheduledFor] = useState(localDateTimeValue());
  const [busy, setBusy] = useState(false);

  const employeeName = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.name])),
    [employees],
  );

  const load = async () => {
    const [staff, items] = await Promise.all([
      employeeService.listActive(),
      notificationService.adminHistory(),
    ]);
    setEmployees(staff.filter((employee) => employee.role !== 'admin'));
    setHistory(items);
  };

  useEffect(() => {
    void load().catch(() => showToast('알림 관리 정보를 불러오지 못했습니다.', 'error'));
  }, [showToast]);

  const send = async (preset?: 'all-test' | 'employee-test') => {
    const allStaff = preset === 'all-test' || target === 'all';
    const selectedEmployee = target === 'all' ? undefined : target;
    if (preset === 'employee-test' && !selectedEmployee) {
      showToast('테스트할 직원을 선택해주세요.', 'error');
      return;
    }
    const sendTitle = preset ? '🔔 테스트 알림' : title.trim();
    const sendBody = preset ? '이배산 앱의 관리자 테스트 알림입니다.' : body.trim();
    if (!sendTitle || !sendBody) {
      showToast('제목과 내용을 입력해주세요.', 'error');
      return;
    }
    setBusy(true);
    try {
      const count = await notificationService.adminSend({
        title: sendTitle,
        body: sendBody,
        link: preset ? '/settings' : link,
        employeeId: allStaff ? undefined : selectedEmployee,
        allStaff,
        scheduledFor: preset ? new Date().toISOString() : new Date(scheduledFor).toISOString(),
        kind: preset ? 'test' : 'admin_message',
      });
      showToast(`${count}명의 알림 작업을 등록했습니다.`);
      if (!preset) {
        setTitle('');
        setBody('');
      }
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '알림 등록에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (jobId: string) => {
    setBusy(true);
    try {
      await notificationService.adminResend(jobId);
      showToast('알림을 재발송했습니다.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '재발송에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="알림 관리" showGreeting={false}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div><p className="font-bold text-ink">알림 발송</p><p className="mt-1 text-xs text-ink-soft">즉시 또는 예약 발송</p></div>
            <div className="icon-well bg-brand-red-light text-brand-red"><Send size={18} /></div>
          </div>
          <Select label="대상" value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="all">전체 직원</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </Select>
          <Input label="제목" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="알림 제목" />
          <Textarea label="내용" value={body} onChange={(event) => setBody(event.target.value)} placeholder="알림 내용" />
          <Input label="클릭 이동 경로" value={link} onChange={(event) => setLink(event.target.value)} placeholder="/dashboard" />
          <Input label="발송 시간" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
          <Button fullWidth onClick={() => void send()} disabled={busy}>알림 등록</Button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => void send('all-test')} disabled={busy}>
              <span className="inline-flex items-center gap-1.5"><Users size={14} /> 전체 테스트</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void send('employee-test')} disabled={busy || target === 'all'}>
              특정 직원 테스트
            </Button>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div><p className="font-bold text-ink">최근 발송 이력</p><p className="mt-1 text-xs text-ink-soft">최근 100건</p></div>
            <button onClick={() => void load()} className="icon-well bg-brand-beige-light text-ink-soft press-scale" aria-label="새로고침"><RefreshCw size={17} /></button>
          </div>
          <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {history.length === 0 && <p className="py-8 text-center text-sm text-ink-faint">발송 이력이 없습니다.</p>}
            {history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{item.title}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      대상: {item.recipientEmployeeId ? employeeName.get(item.recipientEmployeeId) ?? '직원' : '역할 전체'}
                    </p>
                  </div>
                  <Badge tone={statusMeta[item.status].tone}>{statusMeta[item.status].label}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-ink-soft">{item.body}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-faint">
                  <span>예약 {formatDateTimeKo(item.scheduledFor)}</span>
                  <span>성공 {item.sentCount}</span>
                  <span>실패 {item.failedCount}</span>
                  <span>읽음 {item.readCount}</span>
                  <span>시도 {item.attemptCount}</span>
                </div>
                {item.lastError && <p className="mt-2 rounded-lg bg-status-rejected-bg px-2 py-1.5 text-[11px] text-status-rejected">{item.lastError}</p>}
                <Button className="mt-3" size="sm" variant="secondary" onClick={() => void resend(item.id)} disabled={busy}>
                  <span className="inline-flex items-center gap-1.5"><BellRing size={14} /> 재발송</span>
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
