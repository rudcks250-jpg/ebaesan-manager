import { prepaidRepository } from '@/repositories/prepaidRepository';

export const prepaidService = {
  list: () => prepaidRepository.findAll(),
  create: prepaidRepository.create,
  use: prepaidRepository.registerUsage,
  update: prepaidRepository.update,
  delete: prepaidRepository.delete,
  listUsages: prepaidRepository.findUsages,
};
