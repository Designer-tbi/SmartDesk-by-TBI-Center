import app from '../server';

export default (req: any, res: any) => {
  try {
    console.log('Vercel API Request:', req.method, req.url);
    return app(req, res);
  } catch (err) {
    console.error('Vercel Function Error:', err);
    res.status(500).json({ error: 'Vercel Function Error: ' + String(err) });
  }
};
