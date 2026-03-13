import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

const MAX_BODY_LENGTH = 2000;
const MIN_BODY_LENGTH = 1;

// GET /api/comments/:paintingId — Public
router.get('/:paintingId', (req, res) => {
  const { paintingId } = req.params;

  const comments = db.prepare(`
    SELECT
      c.id,
      c.painting_id,
      c.body,
      c.created_at,
      c.updated_at,
      u.id as user_id,
      u.display_name,
      u.relation
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.painting_id = ?
    ORDER BY c.created_at ASC
  `).all(paintingId);

  res.json(comments);
});

// POST /api/comments/:paintingId — Requires auth
router.post('/:paintingId', requireAuth, (req, res) => {
  const { paintingId } = req.params;
  const { body } = req.body;

  if (typeof body !== 'string' || body.trim().length < MIN_BODY_LENGTH || body.trim().length > MAX_BODY_LENGTH) {
    return res.status(400).json({
      error: `Comment must be between ${MIN_BODY_LENGTH} and ${MAX_BODY_LENGTH} characters`
    });
  }

  const trimmedBody = body.trim();
  const userId = req.session.user.id;

  const result = db.prepare(`
    INSERT INTO comments (painting_id, user_id, body)
    VALUES (?, ?, ?)
  `).run(paintingId, userId, trimmedBody);

  // Return the created comment with user info
  const comment = db.prepare(`
    SELECT
      c.id,
      c.painting_id,
      c.body,
      c.created_at,
      c.updated_at,
      u.id as user_id,
      u.display_name,
      u.relation
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(comment);
});

// PUT /api/comments/:id — Requires auth, must be comment author
router.put('/:id', requireAuth, (req, res) => {
  const commentId = parseInt(req.params.id, 10);
  const { body } = req.body;

  if (typeof body !== 'string' || body.trim().length < MIN_BODY_LENGTH || body.trim().length > MAX_BODY_LENGTH) {
    return res.status(400).json({
      error: `Comment must be between ${MIN_BODY_LENGTH} and ${MAX_BODY_LENGTH} characters`
    });
  }

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.session.user.id) {
    return res.status(403).json({ error: 'You can only edit your own comments' });
  }

  const trimmedBody = body.trim();

  db.prepare(`
    UPDATE comments SET body = ?, updated_at = datetime('now') WHERE id = ?
  `).run(trimmedBody, commentId);

  // Return the updated comment with user info
  const updated = db.prepare(`
    SELECT
      c.id,
      c.painting_id,
      c.body,
      c.created_at,
      c.updated_at,
      u.id as user_id,
      u.display_name,
      u.relation
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(commentId);

  res.json(updated);
});

// DELETE /api/comments/:id — Requires auth, must be author OR admin
router.delete('/:id', requireAuth, (req, res) => {
  const commentId = parseInt(req.params.id, 10);

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  const isAuthor = comment.user_id === req.session.user.id;
  const isAdmin = req.session.user.is_admin === true;

  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: 'You can only delete your own comments' });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

  res.json({ ok: true });
});

export default router;
