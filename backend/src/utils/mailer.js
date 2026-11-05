/**
 * ─── BizManager Email Transporter ─────────────────────────────────────────────
 *
 * Handles sending OTP and security notification emails to business firm owners.
 * Automatically uses SMTP settings from environment variables if configured,
 * or gracefully falls back to console logging & test transporter in dev mode.
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
    console.log(`[Mailer] Configured SMTP transporter with host: ${host}`);
  } else if (user && pass && user.includes('@gmail.com')) {
    // Convenience for Gmail accounts with App Passwords
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
    console.log('[Mailer] Configured Gmail transporter');
  } else {
    // Fallback: Console transporter for development / when SMTP is not configured
    console.log('[Mailer] ⚠️ No SMTP credentials found in .env — using Console Transporter (OTPs will be logged to server console)');
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('\n==============================================================');
        console.log('📧 [MOCK EMAIL DISPATCHED]');
        console.log(`To:      ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Body:\n${mailOptions.text || mailOptions.html}`);
        console.log('==============================================================\n');
        return { messageId: `mock-${Date.now()}` };
      }
    };
  }

  return transporter;
}

/**
 * Send a 6-digit Password Reset OTP email
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {string} username - Firm owner's username
 */
async function sendPasswordResetOtp(toEmail, otp, username) {
  const mailer = getTransporter();
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || '"BizManager Security" <no-reply@bizmanager.app>';

  const subject = `Your Password Reset OTP: ${otp} - BizManager`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #1f2937; }
        .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }
        .header { background: #0f172a; padding: 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; margin-bottom: 16px; font-weight: 600; }
        .otp-box { background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 10px; padding: 18px; text-align: center; margin: 24px 0; }
        .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #15803d; font-family: monospace; }
        .expiry { font-size: 13px; color: #6b7280; margin-top: 8px; }
        .notice { font-size: 13px; color: #6b7280; line-height: 1.5; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
        .footer { background: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>BizManager Security</h1>
        </div>
        <div class="content">
          <div class="greeting">Hello ${username || 'Firm Owner'},</div>
          <p>We received a request to reset your password. Use the verification code below to authorize this request:</p>
          
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="expiry">Valid for 10 minutes</div>
          </div>
          
          <p>Enter this One-Time Password (OTP) on the password reset page, then create your new password.</p>
          
          <div class="notice">
            <strong>Security Alert:</strong> If you did not request a password reset, please ignore this email or check your account security. Never share this code with anyone.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} BizManager &middot; Automated Security System
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${username || 'Firm Owner'},

Your One-Time Password (OTP) for resetting your BizManager account password is:

  ${otp}

This code is valid for 10 minutes.

If you did not request this, please ignore this email.
`;

  try {
    const info = await mailer.sendMail({
      from,
      to: toEmail,
      subject,
      text,
      html
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] Failed to send email via SMTP:', err.message);
    // If SMTP fails, still log to console so admin / user is never locked out
    console.log(`\n🔑 [EMERGENCY CONSOLE FALLBACK] Password Reset OTP for ${toEmail}: ${otp}\n`);
    throw err;
  }
}

module.exports = {
  sendPasswordResetOtp,
  getTransporter
};
