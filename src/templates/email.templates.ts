import path from "path";
import { config } from "../config/env.config";

export interface EmailTemplateData {
  name: string;
  email?: string;
  url?: string;
  token?: string;
  date?: string;
}

export interface EmailAttachment {
  filename: string;
  path: string;
  cid: string;
}

export interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

export class EmailAssets {
  public static readonly WELCOME_BANNER_CID = "welcome-banner";
  public static readonly PASSWORD_RESET_BANNER_CID = "password-reset-banner";
  public static readonly PASSWORD_CHANGE_BANNER_CID = "password-change-banner";

  public static readonly WELCOME_BANNER_PATH = path.join(
    __dirname,
    "../../docs/assets/email/welcome.png"
  );
  public static readonly PASSWORD_RESET_BANNER_PATH = path.join(
    __dirname,
    "../../docs/assets/email/password-reset.png"
  );
  public static readonly PASSWORD_CHANGE_BANNER_PATH = path.join(
    __dirname,
    "../../docs/assets/email/password-changed.png"
  );
}

export class EmailTemplates {
  private static readonly BRAND_COLOR = "#6d28d9";
  private static readonly SUCCESS_COLOR = "#059669";
  private static readonly WARNING_COLOR = "#d97706";
  private static readonly WARNING_BG = "#fffbeb";
  private static readonly DANGER_COLOR = "#dc2626";
  private static readonly DANGER_BG = "#fef2f2";
  private static readonly DANGER_BORDER = "#ef4444";
  private static readonly INFO_BG = "#f5f3ff";
  private static readonly SUCCESS_BG = "#ecfdf5";
  private static readonly TEXT_HEADING = "#1a1a1a";
  private static readonly TEXT_BODY = "#3f3f46";
  private static readonly TEXT_MUTED = "#9ca3af";
  private static readonly BORDER_COLOR = "#e5e7eb";
  private static readonly LINK_COLOR = "#2563eb";

  /**
   * One attachment definition per banner. Each template method picks the
   * single entry it needs (via `bannerAttachment`) instead of shipping
   * every banner with every email.
   */
  private static readonly BANNER_ATTACHMENTS: Record<string, EmailAttachment> =
    {
      welcome: {
        filename: "welcome-banner.png",
        path: EmailAssets.WELCOME_BANNER_PATH,
        cid: EmailAssets.WELCOME_BANNER_CID,
      },
      passwordReset: {
        filename: "password-reset-banner.png",
        path: EmailAssets.PASSWORD_RESET_BANNER_PATH,
        cid: EmailAssets.PASSWORD_RESET_BANNER_CID,
      },
      passwordChanged: {
        filename: "password-change-banner.png",
        path: EmailAssets.PASSWORD_CHANGE_BANNER_PATH,
        cid: EmailAssets.PASSWORD_CHANGE_BANNER_CID,
      },
    };

  /** Returns the single-item attachment list for a given banner key. */
  private static bannerAttachment(
    key: keyof typeof EmailTemplates.BANNER_ATTACHMENTS
  ): EmailAttachment[] {
    return [this.BANNER_ATTACHMENTS[key]];
  }

  private static baseTemplate(options: {
    bannerCid?: string;
    heading: string;
    body: string;
  }): string {
    const {
      bannerCid = EmailAssets.WELCOME_BANNER_CID,
      heading,
      body,
    } = options;

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Devyro</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: #f4f4f5;
              font-family: Arial, Helvetica, sans-serif;
              color: ${this.TEXT_BODY};
            }
            .email-outer {
              width: 100%;
              background-color: #f4f4f5;
              padding: 40px 16px;
            }
            .email-wrapper {
              max-width: 760px;
              margin: 0 auto;
              background-color: #ffffff;
              border: 1px solid ${this.BORDER_COLOR};
            }
            /* ==== Top banner image ==== */
            .banner {
              width: 100%;
              line-height: 0;
            }
            .banner img {
              width: 100%;
              height: auto;
              display: block;
            }
            /* ==== Content block ==== */
            .content {
              padding: 48px 56px 8px;
            }
            .content h1.heading {
              font-family: 'Times New Roman', Times, Georgia, serif;
              font-size: 38px;
              line-height: 1.25;
              font-weight: 700;
              color: ${this.TEXT_HEADING};
              margin: 0 0 28px;
            }
            .content p {
              font-family: "Inter", sans-serif;
              font-size: 18px;
              line-height: 1.8;
              color: ${this.TEXT_BODY};
              margin: 0 0 22px;
            }
            .content a {
              color: ${this.LINK_COLOR};
              text-decoration: underline;
            }
            .content ul {
              font-family: "Inter", sans-serif;
              padding-left: 22px;
              margin: 0 0 22px;
            }
            .content ul li {
              font-size: 17px;
              line-height: 1.8;
              color: ${this.TEXT_BODY};
              margin: 10px 0;
            }
            .button {
              display: inline-block;
              padding: 16px 40px;
              background: ${this.BRAND_COLOR};
              color: #ffffff !important;
              text-decoration: none !important;
              border-radius: 6px;
              font-family: "Inter", sans-serif;
              font-weight: bold;
              font-size: 17px;
            }
            .button-wrap {
              text-align: center;
              margin: 8px 0 32px;
            }
            .box {
              padding: 22px 24px;
              margin: 0 0 28px;
              border-radius: 6px;
              border: 1px solid transparent;
              text-align: left;
              font-family: "Inter", sans-serif;
            }
            .box-title {
              font-weight: bold;
              font-size: 16px;
              margin: 0 0 10px;
            }
            .box p, .box ul li { font-size: 16px; margin: 6px 0; }
            .box ul { margin: 10px 0 0; padding-left: 20px; }
            .info-box { background: ${this.INFO_BG};}
            .info-box .box-title { color: ${this.BRAND_COLOR}; }
            .warning-box { background: ${this.WARNING_BG}; }
            .warning-box .box-title { color: ${this.WARNING_COLOR}; }
            .success-box { background: ${this.SUCCESS_BG}; }
            .success-box .box-title { color: ${this.SUCCESS_COLOR}; }
            .danger-box { background: ${this.DANGER_BG};}
            .danger-box .box-title { color: ${this.DANGER_COLOR}; }
            .token-display {
              background: #f9fafb;
              border: 1.5px dashed #ddd6fe;
              padding: 16px;
              margin: 0 0 28px;
              text-align: center;
              font-family: "Inter", sans-serif;
              font-size: 14px;
              color: ${this.BRAND_COLOR};
              word-break: break-all;
              border-radius: 6px;
            }
          </style>
        </head>
        <body>
          <div class="email-outer">
            <div class="email-wrapper">
              <div class="banner">
                <img src="cid:${bannerCid}" alt="Devyro" />
              </div>
              <div class="content">
                <h1 class="heading">${heading}</h1>
                ${body}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Welcome email — sent right after registration.
   */
  public static welcome(data: EmailTemplateData): EmailTemplateResult {
    const body = `
      <p>Welcome aboard! We're thrilled to have you join the Devyro community. Your account has been created successfully and you're all set to start your job search journey.</p>

      <p>Most welcome emails spend their time telling you how great the company is. We think so too — but what matters more is helping you find the right job, fast.</p>

      <div class="button-wrap">
        <a href="${config.frontendUrl}/jobs" class="button">Explore Jobs Now</a>
      </div>

      <p>If you have any questions, our support team is always happy to help.<br>Best regards,<br>The Devyro Team</p>
    `;

    const html = this.baseTemplate({
      bannerCid: EmailAssets.WELCOME_BANNER_CID,
      heading: `Hello, ${data.name}`,
      body,
    });

    const text = `
Hello, ${data.name}

Welcome aboard! We're thrilled to have you join the Devyro community. Your account has been created successfully and you're all set to start your job search journey.

Most welcome emails spend their time telling you how great the company is. We think so too — but what matters more is helping you find the right job, fast.

Get started: ${config.frontendUrl}/jobs

If you have any questions, our support team is always happy to help.
Best regards,
The Devyro Team`;

    return {
      subject: "Welcome to Devyro!",
      html,
      text: text.trim(),
      attachments: this.bannerAttachment("welcome"),
    };
  }

  /**
   * Password reset email — sent for the "forgot password" flow.
   */
  public static passwordReset(data: EmailTemplateData): EmailTemplateResult {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${data.token}`;

    const body = `
      <p>We received a request to reset the password for your Devyro account. Click the button below to set a new one.</p>

      <div class="button-wrap">
        <a href="${resetUrl}" class="button">Reset Your Password</a>
      </div>

      <p style="font-size: 14px; color: ${this.TEXT_MUTED};">Or copy and paste this link into your browser:</p>
      <div class="token-display">${resetUrl}</div>

      <div class="box warning-box">
        <p class="box-title">Important security information</p>
        <ul>
          <li>This link will <strong>expire in 1 hour</strong></li>
          <li>The link can only be used <strong>once</strong></li>
          <li>If you didn't request this, you can safely ignore this email</li>
          <li>Your password stays the same until you set a new one</li>
        </ul>
      </div>

      <p>If you're having trouble or didn't request this change, please contact our support team right away.<br>Best regards,<br>The Devyro Security Team</p>
    `;

    const html = this.baseTemplate({
      bannerCid: EmailAssets.PASSWORD_RESET_BANNER_CID,
      heading: `Hello, ${data.name}`,
      body,
    });

    const text = `
Hello, ${data.name}!

We received a request to reset the password for your Devyro account.

Reset your password using this link:
${resetUrl}

Important security information:
- This link will expire in 1 hour
- The link can only be used once
- If you didn't request this, you can safely ignore this email
- Your password stays the same until you set a new one

If you're having trouble or didn't request this change, please contact our support team right away.
Best regards,
The Devyro Security Team`;

    return {
      subject: "Reset Your Password",
      html,
      text: text.trim(),
      attachments: this.bannerAttachment("passwordReset"),
    };
  }

  /**
   * Password changed confirmation email.
   */
  public static passwordChanged(data: EmailTemplateData): EmailTemplateResult {
    const body = `
      <div class="box success-box">
        <p class="box-title">Your password has been changed successfully</p>
        <p><strong>Date:</strong> ${data.date || new Date().toLocaleString()}</p>
      </div>

      <p>This confirms that the password for your account <strong>${data.email}</strong> has been changed. If you made this change, no further action is needed — you can log in with your new password right away.</p>

      <div class="box danger-box">
        <p class="box-title">Didn't make this change?</p>
        <p>Your account may have been compromised. Please act immediately:</p>
        <ul>
          <li>Reset your password right away</li>
          <li>Review your recent account activity</li>
          <li>Contact our support team at <strong>support@Devyro.com</strong></li>
        </ul>
      </div>

      <div class="box info-box">
        <p class="box-title">Security tips</p>
        <ul>
          <li>Use a strong, unique password</li>
          <li>Never share your password with anyone</li>
          <li>Enable two-factor authentication if available</li>
        </ul>
      </div>

      <p>Best regards,<br>The Devyro Security Team</p>
    `;

    const html = this.baseTemplate({
      bannerCid: EmailAssets.PASSWORD_CHANGE_BANNER_CID,
      heading: `All Set, ${data.name}`,
      body,
    });

    const text = `
All set, ${data.name}

Your password has been changed successfully.
Date: ${data.date || new Date().toLocaleString()}

This confirms that the password for your account ${data.email} has been changed. If you made this change, no further action is needed.

Didn't make this change?
Your account may have been compromised. Please act immediately:
- Reset your password right away
- Review your recent account activity
- Contact our support team at support@Devyro.com

Security tips:
- Use a strong, unique password
- Never share your password with anyone
- Enable two-factor authentication if available

Best regards,
The Devyro Security Team `;

    return {
      subject: "Password Changed Successfully",
      html,
      text: text.trim(),
      attachments: this.bannerAttachment("passwordChanged"),
    };
  }
}
