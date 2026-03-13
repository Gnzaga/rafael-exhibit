import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

const ALLOWED_RELATIONS = [
  'Son', 'Daughter', 'Son in Law', 'Daughter in Law',
  'Grandson', 'Granddaughter', 'Wife', 'Husband',
  'Brother', 'Sister', 'Nephew', 'Niece', 'Cousin', 'Friend'
];

// GET /api/user/profile
router.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, display_name, relation, is_admin FROM users WHERE id = ?')
    .get(req.session.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    relation: user.relation,
    is_admin: user.is_admin === 1,
  });
});

// PUT /api/user/profile
router.put('/profile', requireAuth, (req, res) => {
  const { display_name, relation } = req.body;

  // Validate display_name
  if (typeof display_name !== 'string' || display_name.trim().length === 0 || display_name.trim().length > 100) {
    return res.status(400).json({ error: 'display_name must be 1-100 characters' });
  }

  // Validate relation
  if (!ALLOWED_RELATIONS.includes(relation)) {
    return res.status(400).json({ error: `relation must be one of: ${ALLOWED_RELATIONS.join(', ')}` });
  }

  const trimmedName = display_name.trim();

  db.prepare(`
    UPDATE users SET display_name = ?, relation = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(trimmedName, relation, req.session.user.id);

  // Update session
  req.session.user.display_name = trimmedName;
  req.session.user.relation = relation;

  res.json({ ok: true, display_name: trimmedName, relation });
});

export default router;
