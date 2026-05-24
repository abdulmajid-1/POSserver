import { Customer } from '../models/Customer.js';
import { Sale } from '../models/Sale.js';
import { Return } from '../models/Return.js';

// Get all customers
export const getCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await Customer.find(query).sort({ name: 1 });

    // Live compute and update stats for each customer to guarantee 100% correctness
    const updatedCustomers = await Promise.all(
      customers.map(async (c) => {
        const saleMatchConditions = [{ 'customer._id': c._id }];
        if (c.phone && c.phone.trim() !== '') {
          saleMatchConditions.push({ 'customer.phone': c.phone.trim() });
        }
        const queryObj = { $or: saleMatchConditions };

        const [sales, returns] = await Promise.all([
          Sale.find(queryObj),
          Return.find(queryObj)
        ]);

        const totalPurchases = sales.length;
        const totalSpent = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        const totalReturns = returns.length;
        const totalRefunded = returns.reduce((sum, r) => sum + (Number(r.totalRefund) || 0), 0);

        // Keep the database document in sync
        await Customer.findByIdAndUpdate(c._id, {
          totalPurchases,
          totalSpent,
          totalReturns,
          totalRefunded
        });

        const obj = c.toObject();
        obj.totalPurchases = totalPurchases;
        obj.totalSpent = totalSpent;
        obj.totalReturns = totalReturns;
        obj.totalRefunded = totalRefunded;

        return obj;
      })
    );

    res.json({ success: true, count: updatedCustomers.length, data: updatedCustomers });
  } catch (error) { next(error); }
};

// Get single customer with history
export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    // Build a robust match query:
    // Match by customer._id OR non-empty phone to find old/new history securely
    // while completely avoiding walk-in/empty-phone sales collisions.
    const saleMatchConditions = [];
    saleMatchConditions.push({ 'customer._id': customer._id });
    if (customer.phone && customer.phone.trim() !== '') {
      saleMatchConditions.push({ 'customer.phone': customer.phone.trim() });
    }

    const queryObj = { $or: saleMatchConditions };
    const sales = await Sale.find(queryObj).sort({ createdAt: -1 });
    const returns = await Return.find(queryObj).sort({ createdAt: -1 });

    // Compute live stats from actual fetched records (never trust stale stored values)
    const totalPurchases = sales.length;
    const totalSpent = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const totalReturns = returns.length;
    const totalRefunded = returns.reduce((sum, r) => sum + (Number(r.totalRefund) || 0), 0);

    // Keep the Customer document in sync
    await Customer.findByIdAndUpdate(customer._id, {
      totalPurchases,
      totalSpent,
      totalReturns,
      totalRefunded,
    });

    // Send back fresh computed stats alongside the records
    const data = customer.toObject();
    data.totalPurchases = totalPurchases;
    data.totalSpent = totalSpent;
    data.totalReturns = totalReturns;
    data.totalRefunded = totalRefunded;

    res.json({ success: true, data, sales, returns });
  } catch (error) { next(error); }
};

// Create customer
export const createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json({ success: true, data: customer });
  } catch (error) { next(error); }
};

// Update customer
export const updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (error) { next(error); }
};

// Delete customer (Soft delete)
export const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, message: 'Customer removed' });
  } catch (error) { next(error); }
};
