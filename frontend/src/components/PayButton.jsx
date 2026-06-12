import React, { useState } from 'react';

/**
 * PayButton — Razorpay Standard Checkout integration
 *
 * Props:
 *   amount      — number, in rupees (e.g. 499 for ₹499). Default: 499
 *   label       — string, button label. Default: 'Support This Project'
 *   accentColor — hex string, button color. Defaults to the ISS cyan.
 *
 * Flow:
 *   1. POST /api/payment/order  → get Razorpay order_id (backend only)
 *   2. Open Razorpay checkout modal (uses public KEY_ID from Vite env)
 *   3. On success → POST /api/payment/verify → server-side HMAC check
 */
const PayButton = ({ amount = 499, label = 'Support This Project', accentColor = '#00d4ff' }) => {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  // VITE_RAZORPAY_KEY_ID is the PUBLIC key — safe to expose in the browser
  const KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

  const handlePay = async () => {
    if (!KEY_ID) {
      console.error('[PayButton] VITE_RAZORPAY_KEY_ID is not set in frontend/.env');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      // ── STEP 1: Create order on backend ──────────────────────
      const baseUrl = import.meta.env.MODE === 'production' ? '' : 'http://localhost:5000';
      const orderRes = await fetch(`${baseUrl}/api/payment/order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || 'Could not create order.');
      }

      const { orderId, amount: paise, currency } = await orderRes.json();

      // ── STEP 2: Open Razorpay checkout modal ─────────────────
      const options = {
        key:      KEY_ID,   // Public key only — KEY_SECRET stays on server
        amount:   paise,    // In paise
        currency,
        order_id: orderId,

        name:        'Space Station Tracker',
        description: 'Support the real-time orbital tracking project',
        image:       '/favicon.svg',

        // Explicitly enable all payment methods including UPI
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay via UPI',
                instruments: [
                  { method: 'upi' },
                ],
              },
              other: {
                name: 'Other Payment Modes',
                instruments: [
                  { method: 'card' },
                  { method: 'netbanking' },
                  { method: 'wallet' },
                ],
              },
            },
            sequence: ['block.upi', 'block.other'],
            preferences: { show_default_blocks: false },
          },
        },

        theme: { color: accentColor },

        // ── SUCCESS HANDLER ────────────────────────────────────
        // Never trust this alone — verify signature on backend
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${baseUrl}/api/payment/verify`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
              }),
            });

            const result = await verifyRes.json();

            if (!verifyRes.ok || !result.success) {
              throw new Error(result.error || 'Signature verification failed.');
            }

            console.log('[PayButton] ✅ Payment verified:', result.paymentId);
            setStatus('success');

          } catch (verifyErr) {
            console.error('[PayButton] Verify error:', verifyErr.message);
            setStatus('error');
            setErrorMsg('Payment received but verification failed. Contact support.');
          }
        },

        modal: {
          ondismiss: () => {
            // User closed the popup without paying
            console.log('[PayButton] Modal dismissed by user.');
            setStatus('idle');
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', (response) => {
        console.error('[PayButton] Payment failed:', response.error);
        setStatus('error');
        setErrorMsg(response.error?.description || 'Payment failed. Please try again.');
      });

      rzp.open();

    } catch (err) {
      console.error('[PayButton] Error:', err.message);
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  };

  // ── Success state ────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 1.2rem',
        background: 'rgba(16, 185, 129, 0.15)',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        borderRadius: '0.5rem',
        color: '#10b981',
        fontSize: '0.875rem',
        fontWeight: 600,
      }}>
        ✅ Payment Successful!
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <button
        id="pay-btn"
        onClick={handlePay}
        disabled={status === 'loading'}
        style={{
          background: status === 'loading'
            ? 'rgba(255,255,255,0.05)'
            : `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
          border: `1px solid ${status === 'loading' ? 'var(--panel-border)' : accentColor + '88'}`,
          color: status === 'loading' ? 'var(--text-secondary)' : accentColor,
          padding: '0.6rem 1.2rem',
          borderRadius: '0.5rem',
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
        }}
        onMouseOver={(e) => {
          if (status !== 'loading') {
            e.currentTarget.style.background = `${accentColor}33`;
            e.currentTarget.style.borderColor = accentColor;
          }
        }}
        onMouseOut={(e) => {
          if (status !== 'loading') {
            e.currentTarget.style.background = `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`;
            e.currentTarget.style.borderColor = `${accentColor}88`;
          }
        }}
        title={`Pay ₹${amount} via Razorpay`}
      >
        {status === 'loading' ? (
          <>⏳ Processing…</>
        ) : (
          <>💳 {label} — ₹{amount}</>
        )}
      </button>

      {/* Inline error message */}
      {status === 'error' && errorMsg && (
        <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', maxWidth: '220px', textAlign: 'center' }}>
          ⚠ {errorMsg}
        </span>
      )}
    </div>
  );
};

export default PayButton;
