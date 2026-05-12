const counterMap = new Map();

export const generateInvoiceNumber = (prefix = "INV") => {
  const date = new Date();

  const dateStr = `${date.getFullYear()}${String(
    date.getMonth() + 1
  ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  const key = `${prefix}-${dateStr}`;
  const count = (counterMap.get(key) || 0) + 1;

  counterMap.set(key, count);

  return `${prefix}-${dateStr}-${String(count).padStart(4, "0")}`;
};

export const generateReturnNumber = () =>
  generateInvoiceNumber("RET");