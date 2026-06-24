import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

export const sendWelcomeEmail = async ({ name, email, password, companyName, role }) => {
  const loginUrl = `${process.env.FRONTEND_URL}/login`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#fdf2f4;font-family:Arial,sans-serif;">
      
      <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f9d0d6;">
        
        <!-- Header -->
        <div style="background-color:#a31b32;padding:40px 40px 32px;text-align:center;">
          <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:16px;">
            <span style="color:white;font-size:18px;font-weight:bold;">AI CFO Africa</span>
          </div>
          <h1 style="color:white;margin:0;font-size:24px;font-weight:700;">Welcome Aboard! 🎉</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Your account has been created successfully</p>
        </div>

        <!-- Body -->
        <div style="padding:40px;">
          <p style="color:#6b1525;font-size:16px;font-weight:600;margin:0 0 8px;">Dear ${name},</p>
          <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:0 0 24px;">
            Welcome to <strong style="color:#a31b32;">${companyName}</strong> on AI CFO Africa — Africa's first AI-powered financial management platform. We are excited to have you on board and look forward to helping your organization make smarter financial decisions.
          </p>

          <!-- Credentials Box -->
          <div style="background:#fdf2f4;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #f9d0d6;">
            <p style="color:#a31b32;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.5px;">Your Login Credentials</p>
            
            <div style="margin-bottom:12px;">
              <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">Company</p>
              <p style="color:#1f2937;font-size:14px;font-weight:600;margin:0;">${companyName}</p>
            </div>
            
            <div style="margin-bottom:12px;">
              <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">Email Address</p>
              <p style="color:#1f2937;font-size:14px;font-weight:600;margin:0;">${email}</p>
            </div>
            
            <div style="margin-bottom:12px;">
              <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">Password</p>
              <p style="color:#1f2937;font-size:14px;font-weight:600;margin:0;">${password}</p>
            </div>

            <div>
              <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">Role Assigned</p>
              <span style="display:inline-block;background:#a31b32;color:white;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;text-transform:capitalize;">${role}</span>
            </div>
          </div>

          <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:0 0 24px;">
            Please keep your credentials safe. We recommend changing your password after your first login. If you have any questions or need assistance, do not hesitate to reach out to your system administrator.
          </p>

          <!-- Login Button -->
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${loginUrl}" style="display:inline-block;background-color:#a31b32;color:white;font-size:14px;font-weight:600;padding:14px 40px;border-radius:10px;text-decoration:none;">
              Login to Your Account →
            </a>
          </div>

          <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:0;">
            Warm regards,<br/>
            <strong style="color:#a31b32;">The AI CFO Africa Team</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#fdf2f4;padding:24px 40px;text-align:center;border-top:1px solid #f9d0d6;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            © 2025 AI CFO Africa. All rights reserved.<br/>
            Africa's Financial Operating System
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"AI CFO Africa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Welcome to AI CFO Africa — Your Account is Ready 🎉`,
    html,
  });
};

export const sendUserUpdateEmail = async ({ name, email, changes, companyName }) => {
  const changeLines = changes.map(c => `
    <div style="margin-bottom:10px;">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 2px;">${c.label}</p>
      <p style="color:#1f2937;font-size:14px;font-weight:600;margin:0;">${c.value}</p>
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background-color:#fdf2f4;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f9d0d6;">
        <div style="background-color:#a31b32;padding:32px 40px;text-align:center;">
          <span style="color:white;font-size:18px;font-weight:bold;">AI CFO Africa</span>
          <h1 style="color:white;margin:12px 0 0;font-size:22px;">Your Account Has Been Updated</h1>
        </div>
        <div style="padding:40px;">
          <p style="color:#6b1525;font-size:16px;font-weight:600;margin:0 0 8px;">Dear ${name},</p>
          <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:0 0 24px;">
            Your account on <strong style="color:#a31b32;">${companyName}</strong> has been updated by an administrator. Here are the changes made to your account:
          </p>
          <div style="background:#fdf2f4;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #f9d0d6;">
            <p style="color:#a31b32;font-size:13px;font-weight:700;margin:0 0 16px;text-transform:uppercase;">Account Changes</p>
            ${changeLines}
          </div>
          <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:0;">
            If you have any questions, please contact your system administrator.<br/><br/>
            Warm regards,<br/>
            <strong style="color:#a31b32;">The AI CFO Africa Team</strong>
          </p>
        </div>
        <div style="background:#fdf2f4;padding:20px 40px;text-align:center;border-top:1px solid #f9d0d6;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">© 2025 AI CFO Africa. All rights reserved.</p>
        </div>
      </div>
    </body></html>
  `;

  await transporter.sendMail({
    from: `"AI CFO Africa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your AI CFO Africa Account Has Been Updated`,
    html,
  });
};

export default transporter;