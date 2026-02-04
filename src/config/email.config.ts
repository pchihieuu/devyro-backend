// import nodemailer, { Transporter } from "nodemailer";
// import { config } from "./env.config";

// class EmailConfig {
//   private static instance: EmailConfig;
//   private transporter: Transporter;

//   private constructor() {
//     this.transporter = nodemailer.createTransport({
//       host: config.email.host,
//       port: config.email.port,
//       secure: config.email.secure,
//       auth: {
//         user: config.email.user,
//         pass: config.email.password,
//       },
//     });

//     this.verifyConnection();
//   }

//   public static getInstance(): EmailConfig {
//     if (!EmailConfig.instance) {
//       EmailConfig.instance = new EmailConfig();
//     }
//     return EmailConfig.instance;
//   }

//   public getTransporter(): Transporter {
//     return this.transporter;
//   }

//   private async verifyConnection(): Promise<void> {
//     try {
//       await this.transporter.verify();
//       console.log("Email server is ready to send messages");
//     } catch (error) {
//       console.error("Email server connection failed:", error);
//     }
//   }
// }

// export const emailConfig = EmailConfig.getInstance();

// config/email.config.ts
import { Resend } from "resend";
import { config } from "./env.config";

class EmailConfig {
  private static instance: EmailConfig;
  private resend: Resend | null = null;
  private isConfigured: boolean = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): EmailConfig {
    if (!EmailConfig.instance) {
      EmailConfig.instance = new EmailConfig();
    }
    return EmailConfig.instance;
  }

  private initialize(): void {
    if (!config.email.resendApiKey) {
      console.warn(
        "⚠️  RESEND_API_KEY not configured. Email functionality will be disabled."
      );
      this.isConfigured = false;
      return;
    }

    try {
      this.resend = new Resend(config.email.resendApiKey);
      this.isConfigured = true;
      console.log("✓ Resend configured successfully");
    } catch (error) {
      console.error("✗ Resend configuration failed:", error);
      this.isConfigured = false;
    }
  }

  public async sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (!this.isConfigured || !this.resend) {
      console.warn(
        `⚠️  Email not sent to ${options.to} - Resend not configured`
      );
      return;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        console.error(`✗ Resend error:`, error);
        throw new Error(error.message || "Failed to send email");
      }

      console.log(`✓ Email sent to ${options.to} (ID: ${data?.id})`);
    } catch (error: any) {
      console.error(`✗ Failed to send email to ${options.to}:`, error);
      throw new Error(
        `Failed to send email: ${error.message || "Unknown error"}`
      );
    }
  }

  public isReady(): boolean {
    return this.isConfigured;
  }

  public getResend(): Resend | null {
    return this.resend;
  }
}

export const emailConfig = EmailConfig.getInstance();
