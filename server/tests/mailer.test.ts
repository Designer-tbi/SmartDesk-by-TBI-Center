import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMailerForCompany, MailConfigurationError } from '../services/mailer.js';

test('reports a clear configuration error when SMTP is absent', () => {
  assert.throws(() => getMailerForCompany('real', 'Test', null), (error: any) => {
    assert.ok(error instanceof MailConfigurationError);
    assert.equal(error.status, 503);
    assert.equal(error.code, 'SMTP_NOT_CONFIGURED');
    return true;
  });
});

test('rejects partial custom SMTP settings instead of silently falling back', () => {
  assert.throws(() => getMailerForCompany('real', 'Test', { smtpHost: 'smtp.example.com', smtpUser: 'test@example.com' }), MailConfigurationError);
});

test('accepts a complete company SMTP configuration', () => {
  const mailer = getMailerForCompany('real', 'Test', {
    smtpHost: 'smtp.example.com', smtpPort: 587, smtpSecure: false,
    smtpUser: 'test@example.com', smtpPass: 'secret', smtpFromName: 'Entreprise Test',
  });
  assert.equal(mailer.fromAddress, 'test@example.com');
  assert.match(mailer.from, /Entreprise Test/);
});
