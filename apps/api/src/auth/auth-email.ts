import { createTransport } from "nodemailer";
import { Pool } from "pg";
import { decryptSecret } from "../common/secrets";

type AuthEmail = {
  to: string;
  subject: string;
  text: string;
};

export async function sendAuthEmail({ to, subject, text }: AuthEmail) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query(
    "SELECT smtp_host, smtp_port, smtp_user, smtp_pass_ciphertext, smtp_from FROM instance_settings WHERE id = true",
  );
  await pool.end();
  const settings = result.rows[0] as
    | {
        smtp_host: string | null;
        smtp_port: number | null;
        smtp_user: string | null;
        smtp_pass_ciphertext: string | null;
        smtp_from: string | null;
      }
    | undefined;
  const host = settings?.smtp_host;

  if (!host) {
    console.info(`[console email] to=${to} subject="${subject}"\n${text}`);
    return;
  }

  const transporter = createTransport({
    host,
    port: settings?.smtp_port ?? 587,
    auth: {
      user: settings?.smtp_user ?? undefined,
      pass: settings?.smtp_pass_ciphertext
        ? decryptSecret(settings.smtp_pass_ciphertext)
        : undefined,
    },
  });

  await transporter.sendMail({
    from: settings?.smtp_from ?? "noreply@spicytrack.local",
    to,
    subject,
    text,
  });
}
