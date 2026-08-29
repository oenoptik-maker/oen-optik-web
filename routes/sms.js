const https = require('https');
const http = require('http');

const NETGSM_USERNAME = process.env.NETGSM_USERNAME || '';
const NETGSM_PASSWORD = process.env.NETGSM_PASSWORD || '';
const NETGSM_SENDER = process.env.NETGSM_SENDER || 'ONAY KODU';
const IS_TEST_MODE = !NETGSM_USERNAME || !NETGSM_PASSWORD;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sendSMS(phone, code) {
  if (IS_TEST_MODE) {
    console.log('========================================');
    console.log('TEST MODU - SMS GONDERILDI:');
    console.log('Telefon:', phone);
    console.log('Kod:', code);
    console.log('========================================');
    return Promise.resolve({ success: true, test: true });
  }

  return new Promise((resolve, reject) => {
    const message = `OEN Optik giris dogrulama kodunuz: ${code}. 5 dakika gecerlidir. Kimseyle paylasmayin.`;
    const encodedMessage = encodeURIComponent(message);
    
    const url = `https://api.netgsm.com.tr/sms/rest/v2/send-sms?usercode=${NETGSM_USERNAME}&password=${NETGSM_PASSWORD}&sender=${encodeURIComponent(NETGSM_SENDER)}&gsmno=${phone}&message=${encodedMessage}&msgheader=${encodeURIComponent(NETGSM_SENDER)}&datetime=`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true });
        } else {
          reject(new Error('SMS gonderilemedi: ' + data));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = { generateCode, sendSMS, IS_TEST_MODE };
