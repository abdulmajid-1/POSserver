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
    res.json({ success: true, count: customers.length, data: customers });
  } catch (error) { next(error); }
};

// Get single customer with history
export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const sales = await Sale.find({ 'customer.phone': customer.phone }).sort({ createdAt: -1 });
    const returns = await Return.find({ 'customer.phone': customer.phone }).sort({ createdAt: -1 });
    
    res.json({ success: true, data: customer, sales, returns });
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
