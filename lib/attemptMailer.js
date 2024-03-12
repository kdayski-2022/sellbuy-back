const db = require('../database');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const attemptMailer = async () => {
  const EMAIL_HOST = process.env.EMAIL_HOST;
  const EMAIL_PORT = process.env.EMAIL_PORT;
  const EMAIL_AUTH_USER = process.env.EMAIL_AUTH_USER;
  const EMAIL_AUTH_PASS = process.env.EMAIL_AUTH_PASS;
  try {
    let transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: true,
      auth: {
        user: EMAIL_AUTH_USER,
        pass: EMAIL_AUTH_PASS,
      },
    });

    const pendingEmails = await db.models.EmailAttemts.findAll({
      where: {
        isSent: false,
      },
    });
    for (const email of pendingEmails) {
      const { id, to, subject, text, html } = email;

      await transporter.sendMail({
        from: '"TYMIO" <info@tymio.com>',
        to,
        subject,
        text,
        html,
      });

      await db.models.EmailAttemts.update({ isSent: true }, { where: { id } });
    }
  } catch (e) {
    console.log(e);
  }
};

attemptMailer();
