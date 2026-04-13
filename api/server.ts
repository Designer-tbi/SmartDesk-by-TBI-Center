export default async (req: any, res: any) => {
  try {
    const { default: app } = await import('../server');
    const { db, seedDatabase } = await import('../db');
    
    // Ensure database is initialized and seeded (admin users created)
    // This is fast if already seeded
    await seedDatabase(db);
    
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Entry Point Error:', err);
    res.status(500).json({ 
      error: 'Vercel Entry Point Error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
