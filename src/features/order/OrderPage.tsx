import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { VendorCard } from '@/features/order/VendorCard';
import { vendorService } from '@/services/vendorService';
import { CheckCircle2, Circle, ClipboardCheck } from 'lucide-react';

type StatusFilter = 'all' | 'notOrdered' | 'ordered';

export function OrderPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const vendors = vendorService.list();

  const handleChanged = () => setRefreshKey((k) => k + 1);

  const matchesFilter = (ordered: boolean) => {
    if (filter === 'notOrdered') return !ordered;
    if (filter === 'ordered') return ordered;
    return true;
  };

  const quantityVendors = vendors.filter((v) => v.type === 'quantity' && matchesFilter(vendorService.isOrderedToday(v)));
  const fixedVendors = vendors.filter((v) => v.type === 'fixed' && matchesFilter(vendorService.isOrderedToday(v)));
  const orderedCount = vendors.filter((v) => vendorService.isOrderedToday(v)).length;
  const progress = vendors.length ? Math.round((orderedCount / vendors.length) * 100) : 0;

  return (
    <Layout title="발주관리">
      <div className="space-y-6" key={refreshKey}>
        {/* 오늘 발주 현황 */}
        <Card className="bg-gradient-to-br from-white to-brand-red-light/40">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-ink">오늘 발주 현황</h2>
              <p className="text-xs text-ink-soft mt-1">{orderedCount} / {vendors.length}개 거래처 완료</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-red text-white flex items-center justify-center"><ClipboardCheck size={20} /></div>
          </div>
          <div className="h-2 rounded-full bg-brand-beige-light overflow-hidden mb-5"><div className="h-full rounded-full bg-gradient-to-r from-brand-red to-[#52A8FF] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          <div className="space-y-2">
            {vendors.map((v) => {
              const ordered = vendorService.isOrderedToday(v);
              const label = v.type === 'fixed' && v.fixedOrder ? `${v.name} ${v.fixedOrder.itemName}` : v.name;
              return (
                <div key={v.id} className="flex items-center gap-2 text-sm">
                  <span className={ordered ? 'text-status-working' : 'text-ink-faint'}>{ordered ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
                  <span className={ordered ? 'text-ink-faint line-through' : 'text-ink font-medium'}>{label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 필터 */}
        <div className="flex gap-2">
          {(
            [
              { key: 'all', label: '전체' },
              { key: 'notOrdered', label: '미발주' },
              { key: 'ordered', label: '발주완료' },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border press-scale ${
                filter === f.key ? 'bg-brand-red text-white border-brand-red shadow-[0_5px_14px_-8px_rgba(0,122,255,.8)]' : 'bg-surface border-border text-ink-soft'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {quantityVendors.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-ink mb-3 px-1">품목 발주</h2>
            <div className="space-y-3">
              {quantityVendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} onChanged={handleChanged} />
              ))}
            </div>
          </section>
        )}

        {fixedVendors.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-ink mb-3 px-1">고정 발주</h2>
            <div className="space-y-3">
              {fixedVendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} onChanged={handleChanged} />
              ))}
            </div>
          </section>
        )}

        {quantityVendors.length === 0 && fixedVendors.length === 0 && (
          <EmptyState icon="📦" title="조건에 맞는 거래처가 없습니다" description="필터를 변경해보세요." />
        )}
      </div>
    </Layout>
  );
}
