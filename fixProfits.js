import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Sale } from './models/Sale.js';
import { Product } from './models/Product.js';
import { Return } from './models/Return.js';

dotenv.config();

const run = async () => {
  try {
    // You can also hardcode your MongoDB URI here if process.env.MONGODB_URI doesn't work locally
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const sales = await Sale.find({});
    console.log(`Found ${sales.length} sales. Recalculating profits...`);

    for (const sale of sales) {
      let totalProfit = 0;

      for (const item of sale.items) {
        let purchasePrice = 0;
        if (item.product) {
          const product = await Product.findById(item.product);
          if (product) {
            purchasePrice = product.purchasePrice;
          }
        } else if (item.purchasePrice) {
           purchasePrice = item.purchasePrice;
        }
        
        const conversionFactor = item.conversionFactor || 1;
        const baseQty = parseFloat((item.quantity / conversionFactor).toFixed(4));
        
        // Item profit using existing totalPrice
        const itemProfit = item.totalPrice - (purchasePrice * baseQty);
        item.profit = itemProfit;
        
        totalProfit += itemProfit;
      }
      
      const discountAmount = sale.discount || 0;
      sale.totalProfit = totalProfit - discountAmount;
      
      await sale.save();
      console.log(`Updated Sale ${sale.invoiceNumber} - New Total Profit: ${sale.totalProfit}`);
    }

    const returns = await Return.find({});
    console.log(`Found ${returns.length} returns. Recalculating refunded profits...`);

    for (const ret of returns) {
      const originalSale = await Sale.findById(ret.originalSale);
      if (!originalSale) continue;
      
      let totalRefundedProfit = 0;
      
      for (const item of ret.items) {
        const saleItem = originalSale.items.find(si => si.product?.toString() === item.product?.toString() || si.productName === item.productName);
        if (saleItem && saleItem.quantity > 0) {
          const profitPerItem = (saleItem.profit || 0) / saleItem.quantity;
          const refundedProfit = profitPerItem * item.returnQuantity;
          item.refundedProfit = refundedProfit;
          totalRefundedProfit += refundedProfit;
        }
      }
      
      ret.totalRefundedProfit = totalRefundedProfit;
      await ret.save();
      console.log(`Updated Return ${ret.returnNumber} - Refunded Profit: ${ret.totalRefundedProfit}`);
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

run();
