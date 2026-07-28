import { orderRepository } from '@/repositories/orderRepository';
import type { OrderCategory } from '@/data/types';

export const ORDER_CATEGORIES: { key: OrderCategory; label: string }[] = [
  { key: 'meat', label: '육류' },
  { key: 'vegetable', label: '채소' },
  { key: 'liquor', label: '주류' },
  { key: 'supplies', label: '소모품' },
  { key: 'etc', label: '기타' },
];

export const orderService = {
  listByCategory(category: OrderCategory) {
    return orderRepository.findByCategory(category);
  },
};
