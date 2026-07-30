import { prepaidRepository } from '@/repositories/prepaidRepository';

export const prepaidService = {
  listCustomers: () => prepaidRepository.findCustomers(),
  createCustomer: prepaidRepository.createCustomer,
  updateCustomer: prepaidRepository.updateCustomer,
  deleteCustomer: prepaidRepository.deleteCustomer,
  listTransactions: prepaidRepository.findTransactions,
  saveTransaction: prepaidRepository.saveTransaction,
  deleteTransaction: prepaidRepository.deleteTransaction,
};
