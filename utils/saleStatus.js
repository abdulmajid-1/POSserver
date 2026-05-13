export const calculateSaleStatus = (sale) => {
    const totalSold = sale.items.reduce(
        (sum, i) => sum + i.quantity,
        0
    );

    const totalReturned = sale.items.reduce(
        (sum, i) => sum + (i.returnedQuantity || 0),
        0
    );

    if (totalReturned === 0) return 'completed';
    if (totalReturned < totalSold) return 'partial_refund';
    return 'refunded';
};