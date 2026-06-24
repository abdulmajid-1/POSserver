import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from './models/Product.js';
import { DB_NAME } from './constants.js';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log('Connected');
    const products = await Product.find({ 'units.0': { $exists: true } }).limit(5);
    console.log(JSON.stringify(products, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
