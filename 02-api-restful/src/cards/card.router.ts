import { Router } from 'express';
import { validate } from '../http/validate.ts';
import type { CardService } from './card.service.ts';
import {
  cardIdParams,
  createCardBody,
  updateCardBody,
  validateCardBody,
  type CreateCardBody,
  type UpdateCardBody,
} from './card.schemas.ts';

/**
 * Rutas de /api/v1/credit-cards. Express 5 envía al middleware de errores
 * las promesas rechazadas de los handlers async: no hace falta try/catch.
 */
export function buildCardRouter(service: CardService): Router {
  const router = Router();
  const withId = validate('params', cardIdParams);

  router.get('/', async (_req, res) => {
    res.status(200).json(await service.list());
  });

  router.post('/validate', validate('body', validateCardBody), (req, res) => {
    res.status(200).json(service.validate(req.body));
  });

  router.get('/:id', withId, async (req, res) => {
    res.status(200).json(await service.get(req.params.id as string));
  });

  router.post('/', validate('body', createCardBody), async (req, res) => {
    const card = await service.create(req.body as CreateCardBody);
    res.status(201).location(`${req.baseUrl}/${card.id}`).json(card);
  });

  router.patch('/:id', withId, validate('body', updateCardBody), async (req, res) => {
    res.status(200).json(await service.update(req.params.id as string, req.body as UpdateCardBody));
  });

  router.delete('/:id', withId, async (req, res) => {
    await service.remove(req.params.id as string);
    res.status(204).end();
  });

  return router;
}
