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

const DEMO_HOST = process.env.SMTP_DEMO_HOST || 'ssl0.ovh.net';
const DEMO_PORT = parseInt(process.env.SMTP_DEMO_PORT || '465', 10);
const DEMO_USER = process.env.SMTP_DEMO_USER || 'demo@smart-desk.pro';
const DEMO_PASS = process.env.SMTP_DEMO_PASS || 'loub@ki2014D';

const PROD_HOST = process.env.SMTP_HOST || 'mail.tbi-center.fr';
const PROD_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const PROD_SECURE = process.env.SMTP_SECURE !== 'false';
const PROD_USER = process.env.SMTP_USER || 'demo@tbi-center.fr';
const PROD_PASS = process.env.SMTP_PASS || 'loub@ki2014D';

/**
 * Build an SMTP transporter appropriate for the given company.
 * `companyType === 'demo'` → OVH `demo@smart-desk.pro`.
 * Anything else            → the production / TBI-center mailbox.
 *
 * Pass an optional `displayName` (typically the sending company's name)
 * so the recipient sees `"Acme Corp" <demo@smart-desk.pro>` rather than
 * a raw mailbox.
 */
export function getMailerForCompany(
  companyType: CompanyType,
  displayName?: string | null,
): MailerHandle {
  const isDemo = companyType === 'demo';
  const host = isDemo ? DEMO_HOST : PROD_HOST;
  const port = isDemo ? DEMO_PORT : PROD_PORT;
  const user = isDemo ? DEMO_USER : PROD_USER;
  const pass = isDemo ? DEMO_PASS : PROD_PASS;
  const secure = isDemo ? port === 465 : PROD_SECURE;

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
