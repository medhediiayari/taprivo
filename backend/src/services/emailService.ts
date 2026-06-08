import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env.js";

// SMTP email sender. Config-driven: when SMTP_HOST is empty, emails are logged
// to the server console instead of sent — so the verification / reset flows are
// still testable locally without a provider.

let transporter: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!env.SMTP_HOST) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export function emailConfigured(): boolean {
  return Boolean(env.SMTP_HOST);
}

async function send(to: string, subject: string, text: string, html: string): Promise<void> {
  const tx = getTransport();
  if (!tx) {
    // Dev fallback: make the content visible in the logs.
    // eslint-disable-next-line no-console
    console.log(`\n[email:dev] to=${to} subject="${subject}"\n${text}\n`);
    return;
  }
  await tx.sendMail({ from: env.SMTP_FROM, to, subject, text, html });
}

export async function sendVerificationCode(to: string, code: string): Promise<void> {
  const subject = `${env.APP_NAME} — code de vérification`;
  const text = `Votre code de vérification ${env.APP_NAME} est : ${code}\nIl expire dans 15 minutes.`;
  const html = codeEmail("Vérifiez votre e-mail", "Voici votre code de vérification :", code);
  await send(to, subject, text, html);
}

export async function sendPasswordResetCode(to: string, code: string): Promise<void> {
  const subject = `${env.APP_NAME} — réinitialisation du mot de passe`;
  const text = `Votre code de réinitialisation ${env.APP_NAME} est : ${code}\nIl expire dans 15 minutes. Ignorez cet e-mail si vous n'êtes pas à l'origine de la demande.`;
  const html = codeEmail("Réinitialiser votre mot de passe", "Utilisez ce code pour définir un nouveau mot de passe :", code);
  await send(to, subject, text, html);
}

function codeEmail(title: string, intro: string, code: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#3A2118;background:#F7EFE3">
    <h1 style="font-size:20px;color:#1F3A2D;margin:0 0 8px">${title}</h1>
    <p style="color:#7A6A5E;margin:0 0 20px">${intro}</p>
    <div style="font-size:32px;letter-spacing:8px;font-weight:700;color:#B95035;background:#FFF9F0;border:1px solid #E8D8C6;border-radius:12px;padding:16px;text-align:center">${code}</div>
    <p style="color:#7A6A5E;font-size:13px;margin:20px 0 0">Ce code expire dans 15 minutes.</p>
  </div>`;
}
