const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY;
const PAKASIR_BASE_URL = 'https://api.pakasir.id/api/v1';

/**
 * Create payment request di PaKasir
 * @param {number} amount - Jumlah pembayaran (Rp)
 * @param {string} description - Deskripsi pembayaran
 * @param {string} orderId - Order ID
 * @returns {Promise<{qris: string, invoice_id: string, amount: number}>}
 */
async function createPayment(amount, description, orderId) {
  try {
    const payload = {
      reference_id: orderId || `ORD-${Date.now()}`,
      amount: amount,
      description: description,
      callback_url: process.env.WEBHOOK_CALLBACK_URL || 'http://localhost:5000/webhook/payment'
    };

    const response = await axios.post(
      `${PAKASIR_BASE_URL}/transactions`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${PAKASIR_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;

    return {
      success: true,
      invoice_id: data.data?.invoice_id,
      qris: data.data?.qr_string,
      amount: amount,
      reference_id: payload.reference_id,
      status: data.data?.status
    };
  } catch (error) {
    console.error('❌ PaKasir error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Check payment status
 * @param {string} invoiceId - Invoice ID dari PaKasir
 * @returns {Promise<{status: string, paid: boolean}>}
 */
async function checkPaymentStatus(invoiceId) {
  try {
    const response = await axios.get(
      `${PAKASIR_BASE_URL}/transactions/${invoiceId}`,
      {
        headers: {
          'Authorization': `Bearer ${PAKASIR_API_KEY}`
        }
      }
    );

    const data = response.data;

    return {
      success: true,
      status: data.data?.status,
      paid: data.data?.status === 'PAID'
    };
  } catch (error) {
    console.error('❌ PaKasir check error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate ticket number
 * @returns {string}
 */
function generateTicketNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `TKT-${dateStr}-${rand}`;
}

module.exports = {
  createPayment,
  checkPaymentStatus,
  generateTicketNumber
};
