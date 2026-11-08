/**
 * Centralised SMTP transporter factory.
 *
 * Demo companies use the dedicated `demo@smart-desk.pro` mailbox (OVH /
 * `ssl0.ovh.net`). Production companies fall back to the original
 * `SMTP_*` env vars (TBI-center mailbox) so existing super-admin /
 * password-reset flows keep working untouched.
 */

import nodemailer from 'nodemailer';

type CompanyType = 'demo' | 'real' | 'production' | string | null | undefined;

export type MailerHandle = {
  transporter: ReturnType<typeof nodemailer.createTransport>;
  from: string;          // formatted as `"Display Name" <addr@domain>`
  fromAddress: string;   // bare e-mail used in headers
  isDemo: boolean;
};

export class MailConfigurationError extends Error {
  status = 503;
  code = 'SMTP_NOT_CONFIGURED';
  constructor(message = "Aucune messagerie n'est configurée. Renseignez le serveur SMTP, le compte et son mot de passe dans Paramètres > Entreprise.") {
    super(message);
    this.name = 'MailConfigurationError';
  }
}

/** Authentication mail has one verified platform sender, independent of tenant SMTP. */
export function getAuthMailer(): MailerHandle {
  const user = process.env.SMTP_AUTH_USER || 'connexion@smart-desk.pro';
  const pass = process.env.SMTP_AUTH_PASS;
  if (!pass || user.toLowerCase() !== 'connexion@smart-desk.pro') {
    throw new MailConfigurationError('Messagerie de connexion SmartDesk non configurée.');
  }
  const host = process.env.SMTP_AUTH_HOST || 'ssl0.ovh.net';
  const port = Number(process.env.SMTP_AUTH_PORT || 465);
  return {
    transporter: nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000,
    }),
    from: `"SmartDesk" <${user}>`, fromAddress: user, isDemo: false,
  };
}

type AuthMessage = { to: string; subject: string; text: string; html?: string };

/** Resend uses HTTPS, which works on Railway Hobby. SMTP remains a fallback. */
export async function sendAuthMail(message: AuthMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const { transporter, from } = getAuthMailer();
    await transporter.sendMail({ ...message, from });
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...message, from: 'SmartDesk <connexion@smart-desk.pro>' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend authentication email failed (HTTP ${response.status})`);
}

export async function checkAuthMailConfiguration(): Promise<void> {
  if (process.env.RESEND_API_KEY) return;
  await getAuthMailer().transporter.verify();
}

const DEMO_HOST = process.env.SMTP_DEMO_HOST || 'ssl0.ovh.net';
const DEMO_PORT = parseInt(process.env.SMTP_DEMO_PORT || '465', 10);
const DEMO_USER = process.env.SMTP_DEMO_USER || 'demo@smart-desk.pro';
const DEMO_PASS = process.env.SMTP_DEMO_PASS;

const PROD_HOST = process.env.SMTP_HOST || 'mail.tbi-center.fr';
const PROD_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const PROD_SECURE = process.env.SMTP_SECURE !== 'false';
const PROD_USER = process.env.SMTP_USER || 'demo@tbi-center.fr';
const PROD_PASS = process.env.SMTP_PASS;

export type CompanySmtpConfig = {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFromName?: string | null;
} | null;

/**
 * Build an SMTP transporter appropriate for the given company.
 *
 * If the company has configured its own SMTP credentials (Settings →
 * envoi de documents), those take priority so signature-request e-mails
 * go out from the company's own mailbox instead of the shared one.
 * Otherwise: `companyType === 'demo'` → OVH `demo@smart-desk.pro`;
 * anything else → the production / TBI-center mailbox.
 *
 * Pass an optional `displayName` (typically the sending company's name)
 * so the recipient sees `"Acme Corp" <demo@smart-desk.pro>` rather than
 * a raw mailbox — overridden by the company's own `smtpFromName` when set.
 */
export function getMailerForCompany(
  companyType: CompanyType,
  displayName?: string | null,
  customSmtp?: CompanySmtpConfig,
): MailerHandle {
  const customFields = [customSmtp?.smtpHost, customSmtp?.smtpUser, customSmtp?.smtpPass];
  if (customFields.some(Boolean) && !customFields.every(Boolean)) {
    throw new MailConfigurationError('La configuration SMTP est incomplète. Le serveur, le compte et le mot de passe sont obligatoires.');
  }
  if (customSmtp?.smtpHost && customSmtp?.smtpUser && customSmtp?.smtpPass) {
    const host = customSmtp.smtpHost;
    const port = customSmtp.smtpPort || 465;
    const secure = customSmtp.smtpSecure !== false;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: customSmtp.smtpUser, pass: customSmtp.smtpPass },
    });
    const fromAddress = customSmtp.smtpUser;
    const name = customSmtp.smtpFromName || displayName;
    const from = name ? `"${name}" <${fromAddress}>` : fromAddress;
    return { transporter, from, fromAddress, isDemo: false };
  }

  const isDemo = companyType === 'demo';
  const host = isDemo ? DEMO_HOST : PROD_HOST;
  const port = isDemo ? DEMO_PORT : PROD_PORT;
  const user = isDemo ? DEMO_USER : PROD_USER;
  const pass = isDemo ? DEMO_PASS : PROD_PASS;
  const secure = isDemo ? port === 465 : PROD_SECURE;

  if (!pass) {
    throw new MailConfigurationError();
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const fromAddress = user;
  const from = displayName ? `"${displayName}" <${fromAddress}>` : fromAddress;

  return { transporter, from, fromAddress, isDemo };
}
