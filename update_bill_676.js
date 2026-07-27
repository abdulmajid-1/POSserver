import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://Umer:Umer1234@cluster0.z4fcnzo.mongodb.net';

async function updateBill676() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const salesCollection = db.collection('sales');

    // Find bill with invoice number containing 676
    const bill = await salesCollection.findOne({
      invoiceNumber: { $regex: '000676' }
    });

    if (!bill) {
      console.log('Bill 676 not found. Searching all bills with "676"...');
      const bills = await salesCollection.find({
        invoiceNumber: { $regex: '676' }
      }).toArray();
      
      if (bills.length === 0) {
        console.log('No bills found containing "676" in invoice number.');
      } else {
        console.log(`Found ${bills.length} bill(s):`);
        bills.forEach(b => {
          console.log(`  - ${b.invoiceNumber} | paymentMethod: ${b.paymentMethod}`);
        });
        
        // Update all matching bills to cash
        for (const b of bills) {
          await salesCollection.updateOne(
            { _id: b._id },
            { $set: { paymentMethod: 'cash' } }
          );
          console.log(`Updated ${b.invoiceNumber} paymentMethod → cash`);
        }
      }
    } else {
      console.log(`Found: ${bill.invoiceNumber} | current paymentMethod: ${bill.paymentMethod}`);
      await salesCollection.updateOne(
        { _id: bill._id },
        { $set: { paymentMethod: 'cash' } }
      );
      console.log(`Updated ${bill.invoiceNumber} paymentMethod → cash ✅`);
    }

    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

updateBill676();
