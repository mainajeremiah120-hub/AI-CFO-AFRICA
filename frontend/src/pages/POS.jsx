import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function POS() {
  const navigate = useNavigate();
  const receiptRef = useRef();

  const [activeSession, setActiveSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [screen, setScreen] = useState('session'); // session | pos | receipt
  const [completedSale, setCompletedSale] = useState(null);

  // Session form
  const [sessionForm, setSessionForm] = useState({
    cashier_name: '', opening_cash: ''
  });

  // Payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'cash',
    mpesa_reference: '',
    amount_tendered: '',
    customer_name: '',
    customer_phone: '',
    discount_amount: 0,
    tax_rate: 16,
  });

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const company = JSON.parse(localStorage.getItem('company') || 'null');

  useEffect(() => {
    checkActiveSession();
    fetchProducts();
  }, []);

  const checkActiveSession = async () => {
    try {
      const res = await API.get('/pos/sessions/active');
      if (res.data) {
        setActiveSession(res.data);
        setScreen('pos');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await API.get('/inventory/products');
      setProducts(res.data);
    } catch (err) {
      setError('Failed to load products');
    }
  };

  const handleOpenSession = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/pos/sessions/open', {
        cashier_name: sessionForm.cashier_name || user?.name,
        opening_cash: Number(sessionForm.opening_cash) || 0
      });
      setActiveSession(res.data);
      setScreen('pos');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to open session');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!window.confirm('Close this POS session?')) return;
    setLoading(true);
    try {
      await API.put(`/pos/sessions/${activeSession.id}/close`, {
        closing_cash: cartTotal
      });
      setActiveSession(null);
      setCart([]);
      setScreen('session');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close session');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    if (Number(product.total_stock) <= 0) {
      setError(`${product.name} is out of stock`);
      setTimeout(() => setError(''), 3000);
      return;
    }
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.quantity >= Number(product.total_stock)) {
        setError(`Only ${product.total_stock} units available`);
        setTimeout(() => setError(''), 3000);
        return;
      }
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        unit_price: Number(product.selling_price),
        cost_price: Number(product.cost_price),
        quantity: 1,
        total: Number(product.selling_price),
        max_stock: Number(product.total_stock),
        discount: 0,
      }]);
    }
  };

  const updateCartQty = (product_id, qty) => {
    if (qty <= 0) {
      removeFromCart(product_id);
      return;
    }
    setCart(cart.map(item =>
      item.product_id === product_id
        ? { ...item, quantity: qty, total: qty * item.unit_price }
        : item
    ));
  };

  const removeFromCart = (product_id) => {
    setCart(cart.filter(item => item.product_id !== product_id));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountAmt = Number(paymentForm.discount_amount) || 0;
  const taxAmt = ((subtotal - discountAmt) * Number(paymentForm.tax_rate)) / 100;
  const cartTotal = subtotal - discountAmt + taxAmt;
  const changeAmt = Number(paymentForm.amount_tendered) - cartTotal;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError('Cart is empty');
      return;
    }
    setShowPayment(true);
    setPaymentForm(prev => ({ ...prev, amount_tendered: cartTotal.toFixed(2) }));
  };

  const handleCompleteSale = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/pos/sales', {
        session_id: activeSession.id,
        customer_name: paymentForm.customer_name,
        customer_phone: paymentForm.customer_phone,
        items: cart,
        payment_method: paymentForm.payment_method,
        mpesa_reference: paymentForm.mpesa_reference,
        amount_tendered: Number(paymentForm.amount_tendered),
        discount_amount: Number(paymentForm.discount_amount),
        tax_rate: Number(paymentForm.tax_rate),
      });
      setCompletedSale(res.data);
      setCart([]);
      setShowPayment(false);
      setScreen('receipt');
      setSuccess('Sale completed successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete sale');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  // ── SESSION SCREEN ────────────────────────────────────

  if (screen === 'session') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#fdf2f4' }}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4" style={{ backgroundColor: '#a31b32' }}>
              🛒
            </div>
            <h1 className="text-xl font-bold text-gray-800">Open POS Session</h1>
            <p className="text-sm text-gray-500 mt-1">{company?.name}</p>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

          <form onSubmit={handleOpenSession} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cashier Name</label>
              <input
                value={sessionForm.cashier_name}
                onChange={e => setSessionForm({ ...sessionForm, cashier_name: e.target.value })}
                placeholder={user?.name}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Cash (KES)</label>
              <input
                type="number"
                value={sessionForm.opening_cash}
                onChange={e => setSessionForm({ ...sessionForm, opening_cash: e.target.value })}
                placeholder="0"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-medium py-3 rounded-lg text-sm transition"
              style={{ backgroundColor: '#a31b32' }}
            >
              {loading ? 'Opening...' : 'Open Session & Start Selling'}
            </button>
          </form>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full mt-3 text-gray-500 text-sm py-2 hover:text-gray-700"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── RECEIPT SCREEN ────────────────────────────────────

  if (screen === 'receipt' && completedSale) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-6" ref={receiptRef}>

          {/* Receipt Header */}
          <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-4">
            <p className="text-lg font-bold text-gray-800">{company?.name}</p>
            <p className="text-xs text-gray-500">Official Receipt</p>
            <p className="text-xs text-gray-500 mt-1">ETR: {completedSale.etr_number}</p>
            <p className="text-xs text-gray-500">{new Date(completedSale.created_at).toLocaleString()}</p>
          </div>

          {/* Customer */}
          <div className="mb-4 text-xs text-gray-600">
            <p>Customer: {completedSale.customer_name}</p>
            {completedSale.customer_phone && <p>Phone: {completedSale.customer_phone}</p>}
            <p>Receipt #: {completedSale.receipt_number}</p>
          </div>

          {/* Items */}
          <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
            {completedSale.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-xs mb-1.5">
                <div>
                  <p className="font-medium text-gray-800">{item.product_name}</p>
                  <p className="text-gray-500">{item.quantity} x KES {Number(item.unit_price).toLocaleString()}</p>
                </div>
                <p className="font-medium text-gray-800">KES {Number(item.total).toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-gray-300 pt-3 space-y-1 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>KES {Number(completedSale.subtotal).toLocaleString()}</span>
            </div>
            {Number(completedSale.discount_amount) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>- KES {Number(completedSale.discount_amount).toLocaleString()}</span>
              </div>
            )}
            {Number(completedSale.tax_amount) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>VAT (16%)</span>
                <span>KES {Number(completedSale.tax_amount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-800 text-sm pt-1 border-t border-dashed border-gray-300">
              <span>TOTAL</span>
              <span>KES {Number(completedSale.total_amount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Payment ({completedSale.payment_method.toUpperCase()})</span>
              <span>KES {Number(completedSale.amount_tendered).toLocaleString()}</span>
            </div>
            {Number(completedSale.change_amount) > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Change</span>
                <span>KES {Number(completedSale.change_amount).toLocaleString()}</span>
              </div>
            )}
            {completedSale.mpesa_reference && (
              <div className="flex justify-between text-gray-500">
                <span>M-Pesa Ref</span>
                <span>{completedSale.mpesa_reference}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-4 pt-3 border-t border-dashed border-gray-300">
            <p className="text-xs text-gray-500">Thank you for your purchase!</p>
            <p className="text-xs text-gray-400 mt-1">Powered by AI CFO Africa</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4 w-full max-w-sm">
          <button
            onClick={handlePrint}
            className="flex-1 text-white font-medium py-2.5 rounded-lg text-sm"
            style={{ backgroundColor: '#a31b32' }}
          >
            🖨️ Print Receipt
          </button>
          <button
            onClick={() => setScreen('pos')}
            className="flex-1 bg-gray-100 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-200"
          >
            New Sale
          </button>
        </div>
      </div>
    );
  }

  // ── POS SCREEN ────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* POS Header */}
      <div className="text-white px-4 py-3 flex justify-between items-center" style={{ backgroundColor: '#a31b32' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-white opacity-70 hover:opacity-100 text-sm">
            ← Back
          </button>
          <span className="font-semibold">{company?.name} — POS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-70">Cashier: {activeSession?.cashier_name}</span>
          <button
            onClick={handleCloseSession}
            className="text-xs bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1.5 rounded-lg"
          >
            Close Session
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 border-b border-red-100">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm px-4 py-2 border-b border-green-100">{success}</div>}

      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Product Grid ── */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search products by name or SKU..."
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map(product => {
              const inCart = cart.find(i => i.product_id === product.id);
              const outOfStock = Number(product.total_stock) <= 0;
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={outOfStock}
                  className={`bg-white rounded-xl p-3 border text-left transition hover:shadow-md ${
                    outOfStock ? 'opacity-50 cursor-not-allowed border-gray-100' :
                    inCart ? 'border-primary-300 shadow-sm' : 'border-gray-100 hover:border-primary-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400 font-mono">{product.sku}</span>
                    {inCart && (
                      <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#a31b32' }}>
                        {inCart.quantity}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-tight mb-1">{product.name}</p>
                  <p className="text-base font-bold" style={{ color: '#a31b32' }}>
                    KES {Number(product.selling_price).toLocaleString()}
                  </p>
                  <p className={`text-xs mt-1 ${outOfStock ? 'text-red-500' : 'text-gray-400'}`}>
                    {outOfStock ? 'Out of stock' : `Stock: ${product.total_stock} ${product.unit}`}
                  </p>
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🔍</p>
              <p className="text-sm">No products found</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Cart ── */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">

          {/* Cart Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Cart ({cart.length})</h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700">
                Clear
              </button>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">🛒</p>
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1">Click products to add</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-gray-800 flex-1 pr-2">{item.product_name}</p>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-red-400 hover:text-red-600 text-lg font-bold leading-none"
                    >×</button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCartQty(item.product_id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-sm font-bold flex items-center justify-center hover:bg-gray-300"
                      >−</button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQty(item.product_id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full text-white text-sm font-bold flex items-center justify-center"
                        style={{ backgroundColor: '#a31b32' }}
                      >+</button>
                    </div>
                    <p className="text-sm font-bold text-gray-800">KES {Number(item.total).toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">@ KES {Number(item.unit_price).toLocaleString()} each</p>
                </div>
              ))
            )}
          </div>

          {/* Cart Totals */}
          {cart.length > 0 && (
            <div className="border-t border-gray-100 p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>KES {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-800 border-t border-gray-100 pt-2">
                <span>Total</span>
                <span>KES {cartTotal.toLocaleString()}</span>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full text-white font-medium py-3 rounded-xl text-sm mt-2"
                style={{ backgroundColor: '#a31b32' }}
              >
                Checkout — KES {cartTotal.toLocaleString()}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PAYMENT MODAL ── */}
      {showPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Complete Payment</h2>
              <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}

            <div className="space-y-4">

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="space-y-1 text-sm">
                  {cart.map(item => (
                    <div key={item.product_id} className="flex justify-between text-gray-600">
                      <span>{item.product_name} x{item.quantity}</span>
                      <span>KES {Number(item.total).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold text-gray-800">
                    <span>Total</span>
                    <span>KES {cartTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    value={paymentForm.customer_name}
                    onChange={e => setPaymentForm({ ...paymentForm, customer_name: e.target.value })}
                    placeholder="Walk-in Customer"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    value={paymentForm.customer_phone}
                    onChange={e => setPaymentForm({ ...paymentForm, customer_phone: e.target.value })}
                    placeholder="07XXXXXXXX"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {['cash', 'mpesa', 'card'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, payment_method: method })}
                      className={`py-2.5 rounded-lg text-sm font-medium transition ${
                        paymentForm.payment_method === method
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={paymentForm.payment_method === method ? { backgroundColor: '#a31b32' } : {}}
                    >
                      {method === 'cash' ? '💵 Cash' : method === 'mpesa' ? '📱 M-Pesa' : '💳 Card'}
                    </button>
                  ))}
                </div>
              </div>

              {/* M-Pesa Reference */}
              {paymentForm.payment_method === 'mpesa' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">M-Pesa Reference</label>
                  <input
                    value={paymentForm.mpesa_reference}
                    onChange={e => setPaymentForm({ ...paymentForm, mpesa_reference: e.target.value })}
                    placeholder="e.g. QJK8X2Y3P1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {/* Amount Tendered */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount Tendered</label>
                  <input
                    type="number"
                    value={paymentForm.amount_tendered}
                    onChange={e => setPaymentForm({ ...paymentForm, amount_tendered: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Discount (KES)</label>
                  <input
                    type="number"
                    value={paymentForm.discount_amount}
                    onChange={e => setPaymentForm({ ...paymentForm, discount_amount: e.target.value })}
                    min="0"
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Change */}
              {changeAmt > 0 && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex justify-between">
                  <span className="text-sm text-green-700 font-medium">Change to give:</span>
                  <span className="text-sm text-green-700 font-bold">KES {changeAmt.toLocaleString()}</span>
                </div>
              )}

              {/* Complete Button */}
              <button
                onClick={handleCompleteSale}
                disabled={loading}
                className="w-full text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Processing...' : `Complete Sale — KES ${cartTotal.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}