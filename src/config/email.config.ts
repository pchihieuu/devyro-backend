
import nodemailer, { Transporter } from "nodemailer";
import { config } from "./env.config";

class EmailConfig {
  private static instance: EmailConfig;
  private transporter: Transporter;

  private constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      // Không đặt các timeout này thì SMTP treo = sendMail treo vô thời hạn.
      connectionTimeout: config.timeouts.emailMs,
      greetingTimeout: config.timeouts.emailMs,
      socketTimeout: config.timeouts.emailMs,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });


    this.verifyConnection();
  }

  public static getInstance(): EmailConfig {
    if (!EmailConfig.instance) {
      EmailConfig.instance = new EmailConfig();
    }
    return EmailConfig.instance;
  }

  public getTransporter(): Transporter {
    return this.transporter;
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      console.log("Email server is ready to send messages");
    } catch (error) {
      console.error("Email server connection failed:", error);
    }
  }
}

export const emailConfig = EmailConfig.getInstance();