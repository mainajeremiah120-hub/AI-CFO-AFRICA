import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import './src/config/db.js';
import accountingRoutes from './src/modules/accounting/accounting.routes.js';
import authRoutes from './src/modules/auth/auth.routes.js';
import receivablesRoutes from './src/modules/receivables/receivables.routes.js';
import payablesRoutes from './src/modules/payables/payables.routes.js';
import inventoryRoutes from './src/modules/inventory/inventory.routes.js';
import payrollRoutes from './src/modules/payroll/payroll.routes.js';
import procurementRoutes from './src/modules/procurement/procurement.routes.js';
import bankingRoutes from './src/modules/banking/banking.routes.js'
import analyticsRoutes from './src/modules/analytics/analytics.routes.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/receivables', receivablesRoutes);
app.use('/api/payables', payablesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/analytics', analyticsRoutes);

import { protect } from './src/middleware/auth.js';


app.get('/api/me', protect, (req, res) => {
  res.json({ message: 'Protected route works', user: req.user });
});

app.get('/', (req, res) => {
  res.json({ message: 'AI CFO Africa API is running 🚀' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));