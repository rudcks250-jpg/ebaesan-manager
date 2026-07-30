import { prepaidRepository } from '@/repositories/prepaidRepository';

export const prepaidService = {
  listCustomers: () => prepaidRepository.findCustomers(),
  createCustomer: prepaidRepository.createCustomer,
  createOrAddDeposit: prepaidRepository.createOrAddDeposit,
  updateCustomer: prepaidRepository.updateCustomer,
  deleteCustomer: prepaidRepository.deleteCustomer,
  listTransactions: prepaidRepository.findTransactions,
  saveTransaction: prepaidRepository.saveTransaction,
  deleteTransaction: prepaidRepository.deleteTransaction,
};
