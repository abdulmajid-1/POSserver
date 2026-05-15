import { getNextSequence } from './counter.js';

export const generateInvoiceNumber = async () => {
  const seq = await getNextSequence('invoice');

  const date = new Date();
  const dateStr =
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');

  return `INV-${dateStr}-${String(seq).padStart(6, '0')}`;
};


export const generateReturnNumber = async () => {
  const seq = await getNextSequence('return');

  const date = new Date();
  const dateStr =
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');

  return `RET-${dateStr}-${String(seq).padStart(6, '0')}`;
};

export const generatePurchaseNumber = async () => {
  const seq = await getNextSequence('purchase');

  const date = new Date();
  const dateStr =
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');

  return `PUR-${dateStr}-${String(seq).padStart(6, '0')}`;
};