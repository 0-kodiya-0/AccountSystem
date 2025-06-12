import express from 'express';
import tokenRoutes from './services/token/token.route';

// Create the main router for all Google API services
const authenticatedNotNeedRouter = express.Router({ mergeParams: true });

/**
 * These imports will be uncommented as each service is implemented
 */
authenticatedNotNeedRouter.use('/token', tokenRoutes);

export { authenticatedNotNeedRouter };
