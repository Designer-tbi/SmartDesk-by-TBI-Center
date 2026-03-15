import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import { requireAuth } from '../middleware/auth.js';

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
    }
    res.json(req.user);
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
    const userRes = await req.db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    
    if (!user) {
      console.log('Login failed: User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Comparing password:', password, 'with hash:', user.password);
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    console.log('isMatch:', isMatch);
    if (!isMatch) {
      console.log('Login failed: Password mismatch');
      
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
    if (user.companyId) {
      const companyRes = await req.db.query('SELECT status, type, country, state FROM companies WHERE id = $1', [user.companyId]);
      company = companyRes.rows[0];
      if (!company || company.status !== 'active') {
        console.log('Login failed: Company inactive');
        return res.status(403).json({ error: 'Company account is inactive' });
      }
      
      if (demoMode && company.type !== 'demo') {
        console.log('Login failed: Not a demo company');
        return res.status(403).json({ error: 'Invalid login mode for this account' });
      }
      
      if (!demoMode && company.type === 'demo') {
        console.log('Login failed: Demo company in production mode');
        return res.status(403).json({ error: 'Invalid login mode for this account' });
      }
    }

    console.log('Login successful for user:', user.id);
    
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
        state: company?.state || null
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        role: user.role,
        name: user.name,
        country: company?.country || 'FR',
        state: company?.state || null
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
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
    
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      // Create company
      const finalCompanyName = companyName ? `${companyName} (${country || 'Démo'})` : `Démo - ${prenom} ${nom}`;
      await client.query(`
        INSERT INTO companies (id, name, type, status, country, state, "createdAt")
        VALUES ($1, $2, 'demo', 'active', $3, $4, CURRENT_TIMESTAMP)
      `, [companyId, finalCompanyName, country || 'FR', state || null]);
      
      // Create user
      const hashedCode = bcrypt.hashSync(code, 10);
      await client.query(`
        INSERT INTO users (id, "companyId", email, password, role, name)
        VALUES ($1, $2, $3, $4, 'admin', $5)
      `, [userId, companyId, email, hashedCode, `${prenom} ${nom}`]);
      
      // Seed some initial data for this demo company
      const contactId = `contact-${Date.now()}`;
      await client.query(`
        INSERT INTO contacts (id, "companyId", name, email, phone, company, status, "lastContact")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [contactId, companyId, `${prenom} ${nom}`, email, telephone || '0123456789', companyName || 'Entreprise Fictive', 'lead', new Date().toISOString()]);
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Use provided SMTP credentials
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "mail.tbi-center.fr",
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false', // true by default for 465
      auth: {
        user: process.env.SMTP_USER || "demo@tbi-center.fr",
        pass: process.env.SMTP_PASS || "loub@ki2014D",
      },
    });

    // 1. Email to the user with their code
    const userMailOptions = {
      from: '"SmartDesk Demo" <demo@tbi-center.fr>',
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
      from: '"SmartDesk Demo" <demo@tbi-center.fr>',
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
    await Promise.all([
      transporter.sendMail(userMailOptions),
      transporter.sendMail(adminMailOptions)
    ]);

    res.status(200).json({ success: true, message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Error sending demo email:', error);
    res.status(500).json({ error: 'Failed to send emails' });
  }
});
