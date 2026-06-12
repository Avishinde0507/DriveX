const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { protect } = require('../middleware/authMiddleware');

// Create Order
router.post('/create-order', protect, async (req, res) => {
  try {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    
    console.log('Using Key ID:', key_id);
    if (!key_id || !key_secret) {
      throw new Error('Razorpay keys are missing in .env');
    }

    const razorpay = new Razorpay({ key_id, key_secret });

    const amount = Math.round(Number(req.body.amount) * 100);
    console.log('Creating Order for amount (paise):', amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    const options = {
      amount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: key_id
    });
  } catch (error) {
    console.error('Razorpay Order Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Verify Payment Signature
router.post('/verify-payment', protect, (req, res) => {
  try {
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", key_secret)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      return res.json({ valid: true, message: "Payment verified successfully" });
    } else {
      console.error('Invalid Signature:', { expectedSign, received: razorpay_signature });
      return res.status(400).json({ valid: false, message: "Invalid signature" });
    }
  } catch (error) {
    console.error('Razorpay Verification Error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/status', (req, res) => {
  res.json({ status: 'Payment service is up' });
});

module.exports = router;
