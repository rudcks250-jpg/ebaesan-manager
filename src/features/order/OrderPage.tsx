import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { VendorCard } from '@/features/order/VendorCard';
import { vendorService } from '@/services/vendorService';
import { ClipboardCheck } from 'lucide-react';

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
        {/* 오늘 발주 체크 요약 */}
        <Card padded={false} className="bg-gradient-to-br from-white to-brand-red-light/40 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-ink sm:text-lg">오늘 발주 체크</h2>
              <p className="mt-1 text-xs font-semibold text-ink-soft">{orderedCount} / {vendors.length}개 거래처 완료 · {progress}%</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red text-white"><ClipboardCheck size={20} /></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-beige-light"><div className="h-full rounded-full bg-gradient-to-r from-brand-red to-[#52A8FF] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
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
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {quantityVendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} onChanged={handleChanged} />
              ))}
            </div>
          </section>
        )}

        {fixedVendors.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-ink mb-3 px-1">고정 발주</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
