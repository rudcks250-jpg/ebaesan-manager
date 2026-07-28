import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { vendorService } from '@/services/vendorService';
import { useToast } from '@/components/common/Toast';
import type { Vendor } from '@/data/types';

interface VendorEditModalProps {
  vendor: Vendor;
  onClose: () => void;
  onSaved: () => void;
}

export function VendorEditModal({ vendor, onClose, onSaved }: VendorEditModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(vendor.name);
  const [contactName, setContactName] = useState(vendor.contactName);
  const [phone, setPhone] = useState(vendor.phone);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim() || !contactName.trim() || !phone.trim()) {
      setError('거래처명, 담당자명, 전화번호를 모두 입력해주세요.');
      return;
    }
    vendorService.updateContact(vendor.id, name.trim(), contactName.trim(), phone.trim());
    showToast('거래처 정보가 수정되었습니다.');
    onSaved();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="거래처 정보 수정"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>취소</Button>
          <Button fullWidth onClick={handleSave}>저장</Button>
        </div>
      }
    >
      <Input label="거래처명" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 식자재" />
      <Input label="담당자명" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="예: 홍길동" />
      <Input label="전화번호" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" error={error} />
    </Modal>
  );
}
