import { Router, Request, Response } from 'express';
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getTagsForEvent,
  getEventsForTag,
  assignTagToEvent,
  removeTagFromEvent,
  getEventsInDateRange,
} from '../db/queries/events';
import { getTagById } from '../db/queries/tags';
import { asyncHandler } from '../middleware/asyncHandler';
import { apiLimiter } from '../middleware/rateLimiter';
const router = Router();
router.use(apiLimiter);

// GET /api/events — list all events, optional ?tag_id= and ?start=/&end= filters
router.get('/', asyncHandler((req: Request, res: Response) => {
  const { tag_id, start, end } = req.query;

  if (tag_id) {
    const tag = getTagById(Number(tag_id));
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.json(getEventsForTag(tag.id));
    return;
  }

  if (start && end) {
    res.json(getEventsInDateRange(String(start), String(end)));
    return;
  }

  res.json(getAllEvents());
}));

// GET /api/events/:id — single event with its tags
router.get('/:id', asyncHandler((req: Request, res: Response) => {
  const event = getEventById(Number(req.params.id));
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  const tags = getTagsForEvent(event.id);
  res.json({ ...event, tags });
}));

// POST /api/events — create event, optional tag_ids array
router.post('/', asyncHandler((req: Request, res: Response) => {
  const { name, event_date, description, event_url, tag_ids } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required and must be a non-empty string' });
    return;
  }

  if (!event_date || typeof event_date !== 'string') {
    res.status(400).json({ error: 'event_date is required (ISO 8601 format)' });
    return;
  }

  const event = createEvent(name.trim(), event_date, description, event_url);

  if (Array.isArray(tag_ids)) {
    for (const tagId of tag_ids) {
      const tag = getTagById(Number(tagId));
      if (tag) {
        assignTagToEvent(event.id, tag.id);
      }
    }
  }

  const tags = getTagsForEvent(event.id);
  res.status(201).json({ ...event, tags });
}));

// PUT /api/events/:id — update event fields
router.put('/:id', asyncHandler((req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, description, event_date, event_url } = req.body;

  const updated = updateEvent(id, { name, description, event_date, event_url });
  if (!updated) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const tags = getTagsForEvent(updated.id);
  res.json({ ...updated, tags });
}));

// DELETE /api/events/:id
router.delete('/:id', asyncHandler((req: Request, res: Response) => {
  const deleted = deleteEvent(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json({ success: true });
}));

// POST /api/events/:id/tags — assign tag
router.post('/:id/tags', asyncHandler((req: Request, res: Response) => {
  const eventId = Number(req.params.id);
  const { tag_id } = req.body;

  const event = getEventById(eventId);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
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

  const assigned = assignTagToEvent(eventId, tag_id);
  if (!assigned) {
    res.status(409).json({ error: 'Tag already assigned to this event' });
    return;
  }

  res.status(201).json({ success: true });
}));

// DELETE /api/events/:id/tags/:tagId — remove tag
router.delete('/:id/tags/:tagId', asyncHandler((req: Request, res: Response) => {
  const eventId = Number(req.params.id);
  const tagId = Number(req.params.tagId);

  const removed = removeTagFromEvent(eventId, tagId);
  if (!removed) {
    res.status(404).json({ error: 'Tag assignment not found' });
    return;
  }

  res.json({ success: true });
}));

export default router;
