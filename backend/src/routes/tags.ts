import { Router, Request, Response } from 'express';
import { getAllTags, getTagById, getTagByName, createTag, deleteTag, getTagsForItem, assignTagToItem, removeTagFromItem, getItemsForTag } from '../db/queries/tags';
import { getItemById } from '../db/queries/items';
import { asyncHandler } from '../middleware/asyncHandler';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(apiLimiter);

// GET /api/tags
router.get('/', asyncHandler((_req: Request, res: Response) => {
  res.json(getAllTags());
}));

// GET /api/tags/:id
router.get('/:id', asyncHandler((req: Request, res: Response) => {
  const tag = getTagById(Number(req.params.id));
  if (!tag) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  res.json(tag);
}));

// GET /api/tags/:id/items
router.get('/:id/items', asyncHandler((req: Request, res: Response) => {
  const tag = getTagById(Number(req.params.id));
  if (!tag) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  res.json(getItemsForTag(tag.id));
}));

// POST /api/tags
router.post('/', asyncHandler((req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required and must be a non-empty string' });
    return;
  }

  const existing = getTagByName(name.trim());
  if (existing) {
    res.status(409).json({ error: 'Tag already exists', tag: existing });
    return;
  }

  const tag = createTag(name.trim());
  res.status(201).json(tag);
}));

// GET /api/tags/:id/usage — check how many items use this tag
router.get('/:id/usage', asyncHandler((req: Request, res: Response) => {
  const tag = getTagById(Number(req.params.id));
  if (!tag) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  const items = getItemsForTag(tag.id);
  res.json({ tag, itemCount: items.length, items: items.map((i: any) => ({ id: i.id, display_name: i.display_name })) });
}));

// DELETE /api/tags/:id
router.delete('/:id', asyncHandler((req: Request, res: Response) => {
  const deleted = deleteTag(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  res.json({ success: true });
}));

// GET /api/items/:id/tags
router.get('/items/:id/tags', asyncHandler((req: Request, res: Response) => {
  const item = getItemById(Number(req.params.id));
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json(getTagsForItem(item.id));
}));

// POST /api/items/:id/tags — assign tag to item
router.post('/items/:id/tags', asyncHandler((req: Request, res: Response) => {
  const itemId = Number(req.params.id);
  const { tag_id } = req.body;

  const item = getItemById(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  if (!tag_id || typeof tag_id !== 'number') {
    res.status(400).json({ error: 'tag_id is required and must be a number' });
    return;
  }

  const tag = getTagById(tag_id);
  if (!tag) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }

  const assigned = assignTagToItem(itemId, tag_id);
  if (!assigned) {
    res.status(409).json({ error: 'Tag already assigned to this item' });
    return;
  }

  res.status(201).json({ success: true });
}));

// DELETE /api/items/:id/tags/:tagId — remove tag from item
router.delete('/items/:id/tags/:tagId', asyncHandler((req: Request, res: Response) => {
  const itemId = Number(req.params.id);
  const tagId = Number(req.params.tagId);

  const removed = removeTagFromItem(itemId, tagId);
  if (!removed) {
    res.status(404).json({ error: 'Tag assignment not found' });
    return;
  }

  res.json({ success: true });
}));

export default router;
