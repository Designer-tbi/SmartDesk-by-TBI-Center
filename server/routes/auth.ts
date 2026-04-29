import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { requireAuth } from '../middleware/auth.js';
import { seedDefaultRoles } from '../../db.js';
import { getMailerForCompany } from '../services/mailer.js';

/**
 * Derive sensible accounting defaults (currency, standard, language) from
 * the user's country ISO-2 code. Used both by the demo-signup endpoint and
 * by the `/api/auth/geolocate` endpoint so the UI can pre-fill everything
 * in one shot.
 */
function regionalDefaultsFromCountry(code: string | null | undefined) {
  const iso = (code || '').toUpperCase();
  // OHADA / CEMAC member states use XAF or XOF + OHADA standard.
  const OHADA_XAF = new Set(['CG', 'CM', 'GA', 'CF', 'TD', 'GQ', 'CONGO']);
  const OHADA_XOF = new Set(['CI', 'SN', 'BF', 'ML', 'BJ', 'TG', 'NE', 'GW']);
  // RDC (CD) is OHADA but uses Congolese Franc (CDF).
  const OHADA_CDF = new Set(['CD', 'RDC']);
  const EU_EURO = new Set(['FR', 'BE', 'DE', 'ES', 'IT', 'NL', 'LU', 'PT', 'AT', 'IE', 'FI', 'GR', 'EUROPE']);
  const EU_NON_EURO = new Set(['GB', 'UK', 'CH', 'SE', 'NO', 'DK', 'PL', 'CZ']);
  const FR_SPEAKING = new Set([
    'FR', 'BE', 'LU', 'MC', 'CH',
    'CG', 'CM', 'GA', 'CF', 'TD', 'GQ', 'CI', 'SN', 'BF', 'ML', 'BJ', 'TG',
    'NE', 'GN', 'MG', 'CD', 'DJ', 'KM', 'MA', 'DZ', 'TN', 'MU',
    'CONGO', 'AFRIQUE',
  ]);

  if (OHADA_XAF.has(iso)) return { currency: 'XAF', accountingStandard: 'OHADA', language: 'fr' };
  if (OHADA_XOF.has(iso)) return { currency: 'XOF', accountingStandard: 'OHADA', language: 'fr' };
  if (OHADA_CDF.has(iso)) return { currency: 'CDF', accountingStandard: 'OHADA', language: 'fr' };
  if (EU_EURO.has(iso))   return { currency: 'EUR', accountingStandard: 'FRANCE', language: FR_SPEAKING.has(iso) ? 'fr' : 'en' };
  if (EU_NON_EURO.has(iso)) return { currency: iso === 'GB' || iso === 'UK' ? 'GBP' : 'EUR', accountingStandard: 'FRANCE', language: FR_SPEAKING.has(iso) ? 'fr' : 'en' };
  if (iso === 'US' || iso === 'USA') return { currency: 'USD', accountingStandard: 'US_GAAP', language: 'en' };
  if (iso === 'CA') return { currency: 'CAD', accountingStandard: 'US_GAAP', language: 'en' };
  // Default: OHADA / XAF / French (the app's primary market).
  return { currency: 'XAF', accountingStandard: 'OHADA', language: FR_SPEAKING.has(iso) ? 'fr' : 'fr' };
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

export const authRouter = Router();

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userRes = await req.db.query('SELECT * FROM users WHERE id = $1', [req.user!.id]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (req.user!.companyId) {
      const companyRes = await req.db.query('SELECT * FROM companies WHERE id = $1', [req.user!.companyId]);
      const company = companyRes.rows[0];
      if (!company) {
        return res.status(401).json({ error: 'Company not found' });
      }
      req.user!.language = company.language || 'fr';
      req.user!.currency = company.currency || 'XAF';
      // Pull fresh regional info from the company so the SPA can adapt
      // tax-ID labels, phone placeholders, etc. without a re-login.
      req.user!.country = company.country || req.user!.country || 'FR';
      (req.user as any).state = company.state || (req.user as any).state || null;
      // Expose the company type so the UI can conditionally enable
      // demo-only features (DGID certification, expiry countdown…).
      (req.user as any).companyType = company.type || null;
      (req.user as any).onboardingCompleted = company.onboardingCompleted !== false;
      (req.user as any).hasFiscalizationKey = !!company.fiscalizationApiKey;
      (req.user as any).city = company.city || null;
    }
    // Return persisted user preferences so the SPA can rehydrate its UI
    // state (language, sidebar, ...) without touching localStorage.
    const prefs = user.preferences || {};
    res.json({
      ...req.user,
      preferences: prefs,
      language: prefs.language || req.user!.language || 'fr',
    });
  } catch (error) {
    next(error);
  }
});

authRouter.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    await req.db.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, req.user!.id]);
    
    const updatedUserRes = await req.db.query('SELECT id, email, role, name, "companyId" FROM users WHERE id = $1', [req.user!.id]);
    res.json(updatedUserRes.rows[0]);
  } catch (error) {
    next(error);
  }
});

authRouter.put('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    
    const userRes = await req.db.query('SELECT password FROM users WHERE id = $1', [req.user!.id]);
    const user = userRes.rows[0];
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
    }
    
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await req.db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, req.user!.id]);
    
    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password, demoMode } = req.body;
    console.log('Login attempt for email:', email, 'demoMode:', demoMode);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    console.log('Searching for user with email:', email);
    const userRes = await req.db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const user = userRes.rows[0];
    
    if (!user) {
      console.log('Login failed: User not found in database for email:', email);
      return res.status(401).json({ error: 'Identifiants incorrects. Utilisateur non trouvé.' });
    }

    console.log('Comparing password length:', password.length, 'with hash length:', user.password.length);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('isMatch result:', isMatch);
    if (!isMatch) {
      console.log('Login failed: Password mismatch for email:', email);
      
      // Provide a helpful hint depending on the email
      let hint = 'loub@ki2014D';
      if (email === 'demo@smartdesk.com') {
        hint = 'demo123';
      } else if (user.companyId && user.companyId.startsWith('demo-company-')) {
        hint = 'le code à 6 chiffres reçu par email';
      }
      
      return res.status(401).json({ error: `Mot de passe incorrect. Indice : utilisez ${hint}` });
    }

    let company: any = null;
    // Check if company is active (if not super admin)
    if (user.companyId && user.role !== 'super_admin') {
      const companyRes = await req.db.query(
        'SELECT status, type, country, state, language, currency, "firstLoginAt", "demoExpiresAt", "fiscalizationApiKey", "onboardingCompleted", city FROM companies WHERE id = $1',
        [user.companyId],
      );
      company = companyRes.rows[0];
      if (!company || company.status !== 'active') {
        console.log('Login failed: Company inactive');
        return res.status(403).json({ error: 'Compte entreprise inactif.' });
      }

      if (demoMode && company.type !== 'demo') {
        console.log('Login failed: Not a demo company');
        return res.status(403).json({ error: 'Cet utilisateur ne peut pas se connecter en mode démo.' });
      }

      // --- Demo lifecycle: 15-day countdown from first login ---
      if (company.type === 'demo') {
        const now = new Date();
        if (!company.firstLoginAt) {
          // First ever login: stamp the clock and compute the expiry.
          const expires = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
          await req.db.query(
            `UPDATE companies SET "firstLoginAt" = $1, "demoExpiresAt" = $2 WHERE id = $3`,
            [now.toISOString(), expires.toISOString(), user.companyId],
          );
          company.firstLoginAt = now.toISOString();
          company.demoExpiresAt = expires.toISOString();
        } else if (company.demoExpiresAt && new Date(company.demoExpiresAt) < now) {
          // Past the 15-day window: deactivate the company and refuse login.
          await req.db.query(
            `UPDATE companies SET status = 'inactive' WHERE id = $1`,
            [user.companyId],
          );
          console.log(`Demo ${user.companyId} expired, account deactivated.`);
          return res.status(403).json({
            error:
              'Votre période d\'essai de 15 jours est terminée. Contactez-nous pour activer votre abonnement.',
          });
        }
      }
    } else if (user.companyId && user.role === 'super_admin') {
      // Still fetch company info for super admin to get country/state
      const companyRes = await req.db.query('SELECT status, type, country, state, language, currency, "fiscalizationApiKey", "onboardingCompleted", city FROM companies WHERE id = $1', [user.companyId]);
      company = companyRes.rows[0];
    }

    const isDemo = company?.type === 'demo';
    console.log('Login successful for user:', user.id, 'isDemo:', isDemo);
    
    // Update lastLogin
    await req.db.query('UPDATE users SET "lastLogin" = $1 WHERE id = $2', [new Date().toISOString(), user.id]);

    // Generate token
    const token = jwt.sign(
      { 
        id: user.id, 
        companyId: user.companyId, 
        email: user.email, 
        role: user.role,
        name: user.name,
        country: company?.country || 'FR',
        state: company?.state || null,
        language: company?.language || 'fr',
        currency: company?.currency || 'XAF',
        isDemo
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // Create session in database
    try {
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await req.db.query(
        'INSERT INTO sessions (id, "companyId", "userId", token, "expiresAt", "createdAt", "lastActivity", "ipAddress", "userAgent") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          sessionId, 
          user.companyId, 
          user.id, 
          token, 
          expiresAt, 
          new Date().toISOString(), 
          new Date().toISOString(),
          req.ip,
          req.headers['user-agent'] || null
        ]
      );
    } catch (sessErr) {
      console.error('Failed to create session record:', sessErr);
      // Don't block login if session logging fails, but it's good to have
    }

    // Set the JWT as an HttpOnly cookie. The frontend never sees the token
    // directly, which makes the app immune to XSS token exfiltration.
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
      sameSite: 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24h
      path: '/',
    };
    res.cookie('smartdesk_session', token, cookieOptions);

    // Load persisted user preferences (language, sidebar state, ...).
    const prefs = user.preferences || {};

    res.json({
      user: {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        role: user.role,
        name: user.name,
        country: company?.country || 'FR',
        state: company?.state || null,
        city: company?.city || null,
        language: prefs.language || company?.language || 'fr',
        currency: company?.currency || 'XAF',
        companyType: company?.type || null,
        onboardingCompleted: company?.onboardingCompleted !== false,
        hasFiscalizationKey: !!company?.fiscalizationApiKey,
        isDemo,
        preferences: prefs,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
});

/**
 * Log out: invalidate the server session and clear the auth cookie.
 */
authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = (req as any).cookies?.smartdesk_session;
    if (token) {
      await req.db.query('DELETE FROM sessions WHERE token = $1', [token]).catch(() => {});
    }
    res.clearCookie('smartdesk_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
      sameSite: 'lax',
      path: '/',
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Persist user preferences (language, sidebar state, selected company, ...).
 * Replaces what was previously stored in browser localStorage.
 *
 * Body: { [key: string]: any } — shallow-merged into users.preferences.
 */
authRouter.put('/preferences', requireAuth, async (req, res, next) => {
  try {
    const patch = req.body || {};
    if (typeof patch !== 'object' || Array.isArray(patch)) {
      return res.status(400).json({ error: 'Preferences payload must be an object' });
    }
    // jsonb_set / || merge: shallow merge patch into existing preferences.
    const result = await req.db.query(
      `UPDATE users
       SET preferences = COALESCE(preferences, '{}'::jsonb) || $1::jsonb
       WHERE id = $2
       RETURNING preferences`,
      [JSON.stringify(patch), req.user!.id],
    );
    res.json({ preferences: result.rows[0]?.preferences || {} });
  } catch (error) {
    next(error);
  }
});

/**
 * Detect the visitor's country from their IP address so the onboarding form
 * can pre-fill the `country` field. No auth required.
 *
 * Resolution order:
 *   1. Edge-network headers (Vercel, Cloudflare) — zero-latency.
 *   2. Free IP-to-country API (ipapi.co) — fallback.
 *   3. 'FR' default.
 */
authRouter.get('/geolocate', async (req, res) => {
  const sendResponse = (country: string, source: string) => {
    const defaults = regionalDefaultsFromCountry(country);
    res.json({ country, source, ...defaults });
  };
  try {
    // 1. Edge headers.
    const vercelCountry = req.headers['x-vercel-ip-country'] as string | undefined;
    const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
    const edgeCountry = (vercelCountry || cfCountry || '').toUpperCase();
    if (edgeCountry && edgeCountry !== 'XX' && edgeCountry.length === 2) {
      return sendResponse(edgeCountry, 'edge');
    }

    // 2. Fallback: resolve via ip-api.com (free tier, no key).
    const fwd = (req.headers['x-forwarded-for'] as string | undefined) || '';
    const ip = fwd.split(',')[0].trim() || req.socket.remoteAddress || '';
    // Skip private / loopback ranges.
    const isPrivate = !ip
      || ip === '::1'
      || ip.startsWith('127.')
      || ip.startsWith('10.')
      || ip.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

    if (!isPrivate) {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 2500);
        // ip-api.com: free, no key, generous quota. HTTP is fine — this is a
        // server-to-server call with no sensitive data in transit.
        const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode,status`, {
          signal: ctrl.signal,
          headers: { 'User-Agent': 'SmartDesk/1.0' },
        });
        clearTimeout(timeout);
        if (r.ok) {
          const data = await r.json().catch(() => null) as { status?: string; countryCode?: string } | null;
          const code = (data?.countryCode || '').toUpperCase();
          if (data?.status === 'success' && /^[A-Z]{2}$/.test(code)) {
            return sendResponse(code, 'ip-api');
          }
        }
      } catch {
        /* network failure is non-fatal — fall through to default */
      }
    }

    return sendResponse('FR', 'default');
  } catch {
    return sendResponse('FR', 'error');
  }
});



authRouter.post('/send-demo-email', async (req, res, next) => {
  try {
    const { nom, prenom, email, telephone, code, companyName, country, state } = req.body;
    
    if (!email || !code || !nom || !prenom) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create a new demo company and user in the database
    const db = req.db;
    const companyId = `demo-company-${Date.now()}`;
    const userId = `demo-user-${Date.now()}`;
    
    try {
      await db.query('BEGIN');
      
      // Create company with regional accounting defaults derived from country.
      // The SFEC API key is intentionally NOT seeded here — the user will
      // configure it during the first-login onboarding wizard.
      const finalCompanyName = companyName ? `${companyName} (${country || 'Démo'})` : `Démo - ${prenom} ${nom}`;
      const defaults = regionalDefaultsFromCountry(country);
      await db.query(`
        INSERT INTO companies (id, name, type, status, country, state, language, currency, "accountingStandard", "onboardingCompleted", "createdAt")
        VALUES ($1, $2, 'demo', 'active', $3, $4, $5, $6, $7, FALSE, CURRENT_TIMESTAMP)
      `, [companyId, finalCompanyName, country || 'CG', state || null, defaults.language, defaults.currency, defaults.accountingStandard]);
      
      // Bind the RLS session to this new tenant so subsequent INSERTs into
      // the isolated tables (roles, ...) pass the WITH CHECK policy.
      await db.query(
        `SELECT set_config('app.current_company_id', $1, false)`,
        [companyId],
      );

      // Seed default roles for the new demo company
      await seedDefaultRoles(db, companyId);
      
      // Create user
      const hashedCode = bcrypt.hashSync(code, 10);
      await db.query(`
        INSERT INTO users (id, "companyId", email, password, role, name)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, companyId, email, hashedCode, `role_admin_${companyId}`, `${prenom} ${nom}`]);
      
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }

    // Demo signup → use the dedicated OVH demo mailbox
    // (`demo@smart-desk.pro`).
    const { transporter, from } = getMailerForCompany('demo', 'SmartDesk Demo');

    // 1. Email to the user with their code
    const userMailOptions = {
      from,
      to: email,
      subject: "Vos accès à la démo SmartDesk",
      text: `Bonjour ${prenom} ${nom},\n\nVoici vos identifiants pour accéder à la démo de SmartDesk :\n\nIdentifiant : ${email}\nMot de passe : ${code}\n\nPour vous connecter :\n1. Rendez-vous sur la page de connexion de l'application.\n2. Saisissez votre identifiant et votre mot de passe.\n3. Cliquez sur "Se connecter".\n\nÀ bientôt !`,
      html: `
        <p>Bonjour ${prenom} ${nom},</p>
        <p>Voici vos identifiants pour accéder à la démo de SmartDesk :</p>
        <ul>
          <li><strong>Identifiant :</strong> ${email}</li>
          <li><strong>Mot de passe :</strong> ${code}</li>
        </ul>
        <h3>Comment se connecter ?</h3>
        <ol>
          <li>Rendez-vous sur la page de connexion de l'application.</li>
          <li>Saisissez votre identifiant et votre mot de passe.</li>
          <li>Cliquez sur "Se connecter".</li>
        </ol>
        <p>À bientôt !</p>
      `
    };

    // 2. Email to eden@tbi-center.fr with the summary
    const adminMailOptions = {
      from,
      to: "eden@tbi-center.fr",
      subject: "Nouvelle inscription Démo SmartDesk",
      text: `Nouvelle inscription à la démo :\n\nNom : ${nom}\nPrénom : ${prenom}\nEmail : ${email}\nTéléphone : ${telephone}\nEntreprise : ${companyName || 'Non renseigné'}\nPays : ${country || 'Non renseigné'}\nÉtat : ${state || 'Non renseigné'}\nCode généré : ${code}\nEntreprise ID: ${companyId}`,
      html: `<h2>Nouvelle inscription à la démo</h2>
             <ul>
               <li><strong>Nom :</strong> ${nom}</li>
               <li><strong>Prénom :</strong> ${prenom}</li>
               <li><strong>Email :</strong> ${email}</li>
               <li><strong>Téléphone :</strong> ${telephone}</li>
               <li><strong>Entreprise :</strong> ${companyName || 'Non renseigné'}</li>
               <li><strong>Pays :</strong> ${country || 'Non renseigné'}</li>
               <li><strong>État :</strong> ${state || 'Non renseigné'}</li>
               <li><strong>Code généré :</strong> ${code}</li>
               <li><strong>Entreprise ID :</strong> ${companyId}</li>
             </ul>`
    };

    // Send both emails
    console.log('Attempting to send demo emails to:', email, 'and admin');
    try {
      await Promise.all([
        transporter.sendMail(userMailOptions),
        transporter.sendMail(adminMailOptions)
      ]);
      console.log('Demo emails sent successfully');
    } catch (mailError: any) {
      console.error('Nodemailer Error:', mailError);
      // We don't throw here so the user can still log in using the code displayed in the UI
    }

    res.status(200).json({ 
      success: true, 
      message: 'Compte créé avec succès',
      code: code // Return the code so the frontend can display it if email fails
    });
  } catch (error: any) {
    console.error('Error in send-demo-email route:', error);
    res.status(500).json({ error: error.message || 'Failed to create demo account' });
  }
});
