const db = require('../database');
const nodemailer = require('nodemailer');

const attemptMailer = async () => {
  const EMAIL_HOST = 'smtp.zoho.com';
  const EMAIL_PORT = 465;
  const EMAIL_AUTH_USER = 'info@tymio.com';
  const EMAIL_AUTH_PASS = 'Hssi7890';
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
