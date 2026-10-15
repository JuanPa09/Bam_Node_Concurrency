import express, { type Express } from 'express';
import { buildCardRouter } from './cards/card.router.ts';
import type { CardService } from './cards/card.service.ts';
import { errorHandler, notFoundHandler } from './http/error-handler.ts';

export interface AppDeps {
  cardService: CardService;
  /** Comprueba la base de datos para /health. Opcional en pruebas. */
  pingDatabase?: () => Promise<void>;
}

/** Construye la app sin abrir el puerto (así supertest la usa directamente). */
export function buildApp({ cardService, pingDatabase }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await pingDatabase?.();
      res.json({ status: 'ok', database: pingDatabase ? 'up' : 'not-configured' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  app.use('/api/v1/credit-cards', buildCardRouter(cardService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
