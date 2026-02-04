// import { config } from "../config/env.config";

// export interface EmailTemplateData {
//   name: string;
//   email?: string;
//   url?: string;
//   token?: string;
//   date?: string;
// }

// export class EmailTemplates {
//   private static readonly BRAND_COLOR = "#667eea";
//   private static readonly SUCCESS_COLOR = "#10b981";
//   private static readonly WARNING_COLOR = "#ffc107";
//   private static readonly DANGER_COLOR = "#ef4444";

//   /**
//    * Base HTML template wrapper
//    */
//   private static baseTemplate(
//     content: string,
//     headerBg: string = this.BRAND_COLOR
//   ): string {
//     return `
//       <!DOCTYPE html>
//       <html>
//         <head>
//           <meta charset="utf-8">
//           <meta name="viewport" content="width=device-width, initial-scale=1.0">
//           <style>
//             body {
//               font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
//               line-height: 1.6;
//               color: #333;
//               max-width: 600px;
//               margin: 0 auto;
//               padding: 20px;
//               background-color: #f5f5f5;
//             }
//             .container {
//               background-color: #ffffff;
//               border-radius: 10px;
//               overflow: hidden;
//               box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
//             }
//             .header {
//               background: ${headerBg};
//               color: white;
//               padding: 40px 30px;
//               text-align: center;
//             }
//             .header h1 {
//               margin: 0;
//               font-size: 28px;
//               font-weight: 600;
//             }
//             .content {
//               padding: 40px 30px;
//             }
//             .content h2 {
//               color: #333;
//               font-size: 24px;
//               margin-top: 0;
//               margin-bottom: 20px;
//             }
//             .content p {
//               margin: 15px 0;
//               color: #555;
//             }
//             .button {
//               display: inline-block;
//               padding: 14px 32px;
//               background: ${this.BRAND_COLOR};
//               color: white;
//               text-decoration: none;
//               border-radius: 6px;
//               margin: 25px 0;
//               font-weight: 600;
//               text-align: center;
//             }
//             .button:hover {
//               background: #5568d3;
//             }
//             .info-box {
//               background: #f8f9fa;
//               border-left: 4px solid ${this.BRAND_COLOR};
//               padding: 20px;
//               margin: 25px 0;
//               border-radius: 4px;
//             }
//             .warning-box {
//               background: #fff3cd;
//               border-left: 4px solid ${this.WARNING_COLOR};
//               padding: 20px;
//               margin: 25px 0;
//               border-radius: 4px;
//             }
//             .success-box {
//               background: #d1fae5;
//               border-left: 4px solid ${this.SUCCESS_COLOR};
//               padding: 20px;
//               margin: 25px 0;
//               border-radius: 4px;
//             }
//             .danger-box {
//               background: #fee2e2;
//               border-left: 4px solid ${this.DANGER_COLOR};
//               padding: 20px;
//               margin: 25px 0;
//               border-radius: 4px;
//             }
//             .footer {
//               background: #f8f9fa;
//               padding: 30px;
//               text-align: center;
//               color: #666;
//               font-size: 14px;
//               border-top: 1px solid #e9ecef;
//             }
//             .footer p {
//               margin: 8px 0;
//             }
//             ul {
//               padding-left: 20px;
//             }
//             ul li {
//               margin: 10px 0;
//               color: #555;
//             }
//             .token-display {
//               background: white;
//               border: 2px dashed ${this.BRAND_COLOR};
//               padding: 20px;
//               margin: 20px 0;
//               text-align: center;
//               font-family: monospace;
//               font-size: 16px;
//               word-break: break-all;
//               border-radius: 4px;
//             }
//             @media only screen and (max-width: 600px) {
//               body {
//                 padding: 10px;
//               }
//               .header {
//                 padding: 30px 20px;
//               }
//               .content {
//                 padding: 30px 20px;
//               }
//               .button {
//                 display: block;
//                 padding: 12px 20px;
//               }
//             }
//           </style>
//         </head>
//         <body>
//           <div class="container">
//             ${content}
//           </div>
//         </body>
//       </html>
//     `;
//   }

//   /**
//    * Welcome email template
//    */
//   public static welcome(data: EmailTemplateData): {
//     html: string;
//     text: string;
//   } {
//     const content = `
//       <div class="header">
//         <h1>🎉 Welcome to JobPortal!</h1>
//       </div>
//       <div class="content">
//         <h2>Hello ${data.name},</h2>
//         <p>Thank you for joining JobPortal! We're thrilled to have you as part of our community.</p>

//         <p>Your account has been successfully created and you're ready to start your journey with us.</p>

//         <div class="info-box">
//           <p><strong>What you can do now:</strong></p>
//           <ul>
//             <li>Browse thousands of job opportunities</li>
//             <li>Create and customize your profile</li>
//             <li>Upload your resume and portfolio</li>
//             <li>Apply to jobs with one click</li>
//             <li>Save jobs for later review</li>
//             <li>Track your application status</li>
//           </ul>
//         </div>

//         <p style="text-align: center;">
//           <a href="${config.frontendUrl}/jobs" class="button">Explore Jobs Now</a>
//         </p>

//         <p>If you have any questions or need assistance, our support team is always here to help.</p>

//         <p>Best regards,<br>The JobPortal Team</p>
//       </div>
//       <div class="footer">
//         <p>This email was sent to <strong>${data.email}</strong></p>
//         <p>If you didn't create this account, please ignore this email.</p>
//         <p>&copy; ${new Date().getFullYear()} JobPortal. All rights reserved.</p>
//       </div>
//     `;

//     const text = `
// Welcome to JobPortal!

// Hello ${data.name},

// Thank you for joining JobPortal! We're thrilled to have you as part of our community.

// Your account has been successfully created and you're ready to start your journey with us.

// What you can do now:
// - Browse thousands of job opportunities
// - Create and customize your profile
// - Upload your resume and portfolio
// - Apply to jobs with one click
// - Save jobs for later review
// - Track your application status

// Get started: ${config.frontendUrl}/jobs

// If you have any questions or need assistance, our support team is always here to help.

// Best regards,
// The JobPortal Team

// ---
// This email was sent to ${data.email}
// If you didn't create this account, please ignore this email.
// © ${new Date().getFullYear()} JobPortal. All rights reserved.
//     `;

//     return {
//       html: this.baseTemplate(content),
//       text: text.trim(),
//     };
//   }

//   /**
//    * Password reset email template
//    */
//   public static passwordReset(data: EmailTemplateData): {
//     html: string;
//     text: string;
//   } {
//     const resetUrl = `${config.frontendUrl}/reset-password?token=${data.token}`;

//     const content = `
//       <div class="header">
//         <h1>🔐 Password Reset Request</h1>
//       </div>
//       <div class="content">
//         <h2>Hello ${data.name},</h2>
//         <p>We received a request to reset your password for your JobPortal account.</p>

//         <p>Click the button below to create a new password:</p>

//         <p style="text-align: center;">
//           <a href="${resetUrl}" class="button">Reset Your Password</a>
//         </p>

//         <p>Or copy and paste this link into your browser:</p>
//         <div class="token-display">${resetUrl}</div>

//         <div class="warning-box">
//           <p><strong>⚠️ Important Security Information:</strong></p>
//           <ul>
//             <li>This link will <strong>expire in 1 hour</strong></li>
//             <li>The link can only be used <strong>once</strong></li>
//             <li>If you didn't request this reset, please ignore this email</li>
//             <li>Your password will remain unchanged until you create a new one</li>
//           </ul>
//         </div>

//         <p>For your security, this link will automatically expire after one use or one hour, whichever comes first.</p>

//         <div class="info-box">
//           <p><strong>Need help?</strong></p>
//           <p>If you're having trouble resetting your password or didn't request this change, please contact our support team immediately.</p>
//         </div>

//         <p>Best regards,<br>The JobPortal Security Team</p>
//       </div>
//       <div class="footer">
//         <p>This email was sent to <strong>${data.email}</strong></p>
//         <p>If you didn't request a password reset, you can safely ignore this email.</p>
//         <p>&copy; ${new Date().getFullYear()} JobPortal. All rights reserved.</p>
//       </div>
//     `;

//     const text = `
// Password Reset Request

// Hello ${data.name},

// We received a request to reset your password for your JobPortal account.

// Reset your password by visiting this link:
// ${resetUrl}

// ⚠️ Important Security Information:
// - This link will expire in 1 hour
// - The link can only be used once
// - If you didn't request this reset, please ignore this email
// - Your password will remain unchanged until you create a new one

// For your security, this link will automatically expire after one use or one hour, whichever comes first.

// Need help?
// If you're having trouble resetting your password or didn't request this change, please contact our support team immediately.

// Best regards,
// The JobPortal Security Team

// ---
// This email was sent to ${data.email}
// If you didn't request a password reset, you can safely ignore this email.
// © ${new Date().getFullYear()} JobPortal. All rights reserved.
//     `;

//     return {
//       html: this.baseTemplate(content),
//       text: text.trim(),
//     };
//   }

//   /**
//    * Password changed confirmation email template
//    */
//   public static passwordChanged(data: EmailTemplateData): {
//     html: string;
//     text: string;
//   } {
//     const content = `
//       <div class="header" style="background: ${this.SUCCESS_COLOR};">
//         <h1>✓ Password Changed Successfully</h1>
//       </div>
//       <div class="content">
//         <h2>Hello ${data.name},</h2>

//         <div class="success-box">
//           <p><strong>Your password has been successfully changed.</strong></p>
//           <p><strong>Date:</strong> ${data.date || new Date().toLocaleString()}</p>
//         </div>

//         <p>This is a confirmation that the password for your account <strong>${data.email}</strong> has been changed.</p>

//         <p>If you made this change, no further action is required. You can now log in with your new password.</p>

//         <div class="danger-box">
//           <p><strong>⚠️ Didn't make this change?</strong></p>
//           <p>If you did not change your password, your account may be compromised. Please take the following actions immediately:</p>
//           <ul>
//             <li>Reset your password right away</li>
//             <li>Review your recent account activity</li>
//             <li>Contact our support team at <strong>support@jobportal.com</strong></li>
//           </ul>
//         </div>

//         <div class="info-box">
//           <p><strong>Security Tips:</strong></p>
//           <ul>
//             <li>Use a strong, unique password</li>
//             <li>Don't share your password with anyone</li>
//             <li>Enable two-factor authentication if available</li>
//             <li>Regularly update your password</li>
//           </ul>
//         </div>

//         <p>Best regards,<br>The JobPortal Security Team</p>
//       </div>
//       <div class="footer">
//         <p>This email was sent to <strong>${data.email}</strong></p>
//         <p>For security reasons, this notification cannot be disabled.</p>
//         <p>&copy; ${new Date().getFullYear()} JobPortal. All rights reserved.</p>
//       </div>
//     `;

//     const text = `
// Password Changed Successfully

// Hello ${data.name},

// ✓ Your password has been successfully changed.

// Date: ${data.date || new Date().toLocaleString()}

// This is a confirmation that the password for your account ${data.email} has been changed.

// If you made this change, no further action is required. You can now log in with your new password.

// ⚠️ Didn't make this change?
// If you did not change your password, your account may be compromised. Please take the following actions immediately:
// - Reset your password right away
// - Review your recent account activity
// - Contact our support team at support@jobportal.com

// Security Tips:
// - Use a strong, unique password
// - Don't share your password with anyone
// - Enable two-factor authentication if available
// - Regularly update your password

// Best regards,
// The JobPortal Security Team

// ---
// This email was sent to ${data.email}
// For security reasons, this notification cannot be disabled.
// © ${new Date().getFullYear()} JobPortal. All rights reserved.
//     `;

//     return {
//       html: this.baseTemplate(content, this.SUCCESS_COLOR),
//       text: text.trim(),
//     };
//   }
// }

// templates/email.templates.ts
export interface EmailTemplateData {
  name: string;
  email: string;
}

export interface PasswordResetData extends EmailTemplateData {
  token: string;
  resetUrl?: string;
}

export interface PasswordChangedData extends EmailTemplateData {
  date: string;
}

export interface EmailContent {
  html: string;
  text: string;
}

export class EmailTemplates {
  /**
   * Welcome email template
   */
  static welcome(data: EmailTemplateData): EmailContent {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 48px 40px 32px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Welcome to JobPortal! 🎉</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 24px; font-size: 18px; line-height: 1.6; color: #1a1a1a;">
                        Hi <strong>${data.name}</strong>,
                      </p>
                      
                      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.8; color: #4a5568;">
                        Thank you for joining JobPortal! We're excited to have you on board. 
                        Your account has been successfully created and you're ready to explore thousands of job opportunities.
                      </p>
                      
                      <div style="margin: 32px 0; padding: 24px; background-color: #f7fafc; border-radius: 8px; border-left: 4px solid #667eea;">
                        <h3 style="margin: 0 0 12px; font-size: 18px; color: #2d3748;">What's next?</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #4a5568;">
                          <li>Complete your profile</li>
                          <li>Upload your resume</li>
                          <li>Start applying for jobs</li>
                          <li>Set up job alerts</li>
                        </ul>
                      </div>
                      
                      <p style="margin: 24px 0 0; font-size: 16px; line-height: 1.8; color: #4a5568;">
                        If you have any questions, feel free to reach out to our support team.
                      </p>
                      
                      <p style="margin: 24px 0 0; font-size: 16px; line-height: 1.8; color: #4a5568;">
                        Best regards,<br>
                        <strong>The JobPortal Team</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 32px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; text-align: center;">
                      <p style="margin: 0; font-size: 14px; color: #718096;">
                        This is an automated email. Please do not reply.
                      </p>
                      <p style="margin: 12px 0 0; font-size: 13px; color: #a0aec0;">
                        © ${new Date().getFullYear()} JobPortal. All rights reserved.
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Hi ${data.name},

Thank you for joining JobPortal! We're excited to have you on board.

Your account has been successfully created and you're ready to explore thousands of job opportunities.

What's next?
- Complete your profile
- Upload your resume
- Start applying for jobs
- Set up job alerts

If you have any questions, feel free to reach out to our support team.

Best regards,
The JobPortal Team

This is an automated email. Please do not reply.
© ${new Date().getFullYear()} JobPortal. All rights reserved.
    `.trim();

    return { html, text };
  }

  /**
   * Password reset email template
   */
  static passwordReset(data: PasswordResetData): EmailContent {
    const resetUrl =
      data.resetUrl ||
      `${process.env.FRONTEND_URL}/reset-password?token=${data.token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 48px 40px 32px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Reset Your Password 🔐</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 24px; font-size: 18px; line-height: 1.6; color: #1a1a1a;">
                        Hi <strong>${data.name}</strong>,
                      </p>
                      
                      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.8; color: #4a5568;">
                        We received a request to reset your password for your JobPortal account. 
                        Click the button below to create a new password:
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" style="margin: 32px 0;">
                        <tr>
                          <td style="text-align: center;">
                            <a href="${resetUrl}" 
                               style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0; font-size: 14px; line-height: 1.6; color: #718096;">
                        Or copy and paste this link into your browser:
                      </p>
                      
                      <p style="margin: 0 0 24px; padding: 12px; background-color: #f7fafc; border-radius: 6px; font-size: 13px; line-height: 1.6; color: #667eea; word-break: break-all; font-family: monospace;">
                        ${resetUrl}
                      </p>
                      
                      <div style="margin: 32px 0; padding: 20px; background-color: #fff5f5; border-left: 4px solid #fc8181; border-radius: 8px;">
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #742a2a;">
                          <strong>⚠️ Security Notice:</strong> This link will expire in <strong>1 hour</strong>. 
                          If you didn't request this reset, please ignore this email and your password will remain unchanged.
                        </p>
                      </div>
                      
                      <p style="margin: 24px 0 0; font-size: 16px; line-height: 1.8; color: #4a5568;">
                        Best regards,<br>
                        <strong>The JobPortal Team</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 32px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; text-align: center;">
                      <p style="margin: 0; font-size: 14px; color: #718096;">
                        This is an automated email. Please do not reply.
                      </p>
                      <p style="margin: 12px 0 0; font-size: 13px; color: #a0aec0;">
                        © ${new Date().getFullYear()} JobPortal. All rights reserved.
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Hi ${data.name},

We received a request to reset your password for your JobPortal account.

Click the link below to create a new password:
${resetUrl}

⚠️ Security Notice: This link will expire in 1 hour.
If you didn't request this reset, please ignore this email and your password will remain unchanged.

Best regards,
The JobPortal Team

This is an automated email. Please do not reply.
© ${new Date().getFullYear()} JobPortal. All rights reserved.
    `.trim();

    return { html, text };
  }

  /**
   * Password changed confirmation email template
   */
  static passwordChanged(data: PasswordChangedData): EmailContent {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 48px 40px 32px; text-align: center; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Password Changed Successfully ✓</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 24px; font-size: 18px; line-height: 1.6; color: #1a1a1a;">
                        Hi <strong>${data.name}</strong>,
                      </p>
                      
                      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.8; color: #4a5568;">
                        This is to confirm that your password has been successfully changed on:
                      </p>
                      
                      <div style="margin: 24px 0; padding: 20px; background-color: #f0fff4; border-left: 4px solid #48bb78; border-radius: 8px;">
                        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #22543d;">
                          <strong>Date & Time:</strong> ${data.date}
                        </p>
                      </div>
                      
                      <p style="margin: 24px 0; font-size: 16px; line-height: 1.8; color: #4a5568;">
                        For your security, you have been logged out of all devices. Please log in again with your new password.
                      </p>
                      
                      <div style="margin: 32px 0; padding: 20px; background-color: #fff5f5; border-left: 4px solid #fc8181; border-radius: 8px;">
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #742a2a;">
                          <strong>⚠️ Didn't make this change?</strong><br>
                          If you didn't change your password, please contact our support team immediately to secure your account.
                        </p>
                      </div>
                      
                      <p style="margin: 24px 0 0; font-size: 16px; line-height: 1.8; color: #4a5568;">
                        Best regards,<br>
                        <strong>The JobPortal Team</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 32px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; text-align: center;">
                      <p style="margin: 0; font-size: 14px; color: #718096;">
                        This is an automated email. Please do not reply.
                      </p>
                      <p style="margin: 12px 0 0; font-size: 13px; color: #a0aec0;">
                        © ${new Date().getFullYear()} JobPortal. All rights reserved.
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Hi ${data.name},

This is to confirm that your password has been successfully changed on:
${data.date}

For your security, you have been logged out of all devices. Please log in again with your new password.

⚠️ Didn't make this change?
If you didn't change your password, please contact our support team immediately to secure your account.

Best regards,
The JobPortal Team

This is an automated email. Please do not reply.
© ${new Date().getFullYear()} JobPortal. All rights reserved.
    `.trim();

    return { html, text };
  }
}
