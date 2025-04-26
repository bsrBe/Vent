const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

// Create transporter using environment variables
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: parseInt(process.env.EMAIL_PORT || '587'), // Default to 587 if not specified
//   secure: process.env.EMAIL_SECURE === 'true', // Use TLS if secure is true
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASSWORD,
//   },

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('Error configuring Nodemailer:', error);
  } else {
    console.log('Nodemailer is configured and ready to send emails');
  }
});

/**
 * Sends an email using the pre-configured transporter.
 * @param {object} options - Email options.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.subject - Email subject.
 * @param {string} options.text - Plain text body.
 * @param {string} options.html - HTML body.
 * @returns {Promise<void>}
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, // Sender address from env
      to,
      subject,
      text,
      html,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    // Depending on the application's needs, you might want to throw the error
    // or handle it differently (e.g., log to a monitoring service).
    throw new Error('Failed to send email');
  }
};

module.exports = { transporter, sendEmail };
