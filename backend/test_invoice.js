import { createCustomer, createInvoice } from './src/modules/receivables/receivables.controller.js';
import pool from './src/config/db.js';

(async () => {
  try {
    // Get the tenant ID to mock an authenticated user
    const tenantRes = await pool.query('SELECT tenant_id FROM accounts LIMIT 1');
    const tenantId = tenantRes.rows[0].tenant_id;
    
    const user = { tenantId, userId: tenantId };

    // 1. Create a Customer
    const reqCustomer = {
      body: { name: 'Automated Test Client', email: 'test@auto.local', phone: '123', address: '123 Test St', customer_type: 'corporate' },
      user
    };
    
    let customerId;
    const resCustomer = {
      status: (code) => ({
        json: (data) => {
          if (code >= 400) throw new Error('Customer Error: ' + JSON.stringify(data));
          customerId = data.id;
          console.log('✅ Customer Created:', data.name);
        }
      })
    };

    await createCustomer(reqCustomer, resCustomer);

    // 2. Create the Invoice
    const reqInvoice = {
      body: {
        customer_id: customerId,
        invoice_number: 'TEST-' + Date.now(),
        date: new Date().toISOString(),
        due_date: new Date(Date.now() + 86400000 * 30).toISOString(),
        items: [{ description: 'Test Services', quantity: 2, unit_price: 2500 }],
        tax_rate: 0,
        notes: 'Automated test invoice'
      },
      user
    };

    const resInvoice = {
      status: (code) => ({
        json: (data) => {
          if (code >= 400) throw new Error('Invoice Error: ' + JSON.stringify(data));
          console.log('✅ Invoice Created successfully! Invoice ID:', data.id);
          console.log('✅ The accounting journal was updated automatically.');
        }
      })
    };

    await createInvoice(reqInvoice, resInvoice);
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
})();
