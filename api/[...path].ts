export default async (req: any, res: any) => {
  try {
    const { default: app } = await import('../server');
    return app(req, res);
  } catch (err) {
    console.error('Vercel Initialization Error:', err);
    res.status(500).json({ error: 'Vercel Initialization Error: ' + String(err) });
  }
};
