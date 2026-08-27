import { emailConfig } from "../config/email.config";
import { config } from "../config/env.config";
import { EmailAttachment, EmailTemplates } from "../templates/email.templates";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

class EmailService {
  private static instance: EmailService;

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Core method to send email
   */
  private async sendEmail(options: SendEmailOptions): Promise<void> {
    const transporter = emailConfig.getTransporter();

    const mailOptions = {
      from: `"${config.email.fromName}" <${config.email.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(
        `Email sent successfully to ${options.to} (Message ID: ${info.messageId})`
      );
    } catch (error) {
      console.error(`Failed to send email to ${options.to}:`, error);
      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Send welcome email to new users
   */
  public async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const { html, text, attachments } = EmailTemplates.welcome({
      name,
      email: to,
    });

    await this.sendEmail({
      to,
      subject: `Welcome to Devyro, ${name}`,
      html,
      text,
      attachments,
    });
  }

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(
    to: string,
    name: string,
    resetToken: string
  ): Promise<void> {
    const { html, text, attachments } = EmailTemplates.passwordReset({
      name,
      email: to,
      token: resetToken,
    });

    await this.sendEmail({
      to,
      subject: "Reset Your Password - Devyro",
      html,
      text,
      attachments,
    });
  }

  /**
   * Send password changed confirmation email
   */
  public async sendPasswordChangedEmail(
    to: string,
    name: string
  ): Promise<void> {
    const { html, text, attachments } = EmailTemplates.passwordChanged({
      name,
      email: to,
      date: new Date().toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    });

    await this.sendEmail({
      to,
      subject: "Your Password Has Been Changed - Devyro",
      html,
      text,
      attachments,
    });
  }

  /**
   * Send custom email (for future use cases)
   */
  public async sendCustomEmail(
    to: string,
    subject: string,
    html: string,
    text: string
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }
}

export const emailService = EmailService.getInstance();
