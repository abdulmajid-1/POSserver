const counterMap = new Map();

export const generateInvoiceNumber = async (prefix = "INV") => {
  const date = new Date();

  const dateStr = `${date.getFullYear()}${String(
    date.getMonth() + 1
  ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  const key = `${prefix}-${dateStr}`;

  let count = (counterMap.get(key) || 0) + 1;

  counterMap.set(key, count);

  let invoiceNumber = `${key}-${String(count).padStart(4, "0")}`;

  // 🔥 SAFETY CHECK (prevents duplicates in DB)
  const exists = await mongoose.models.Sale.findOne({ invoiceNumber });

  if (exists) {
    count++;
    counterMap.set(key, count);

    invoiceNumber = `${key}-${String(count).padStart(4, "0")}`;
  }

  return invoiceNumber;
};

export const generateReturnNumber = () =>
  generateInvoiceNumber("RET");