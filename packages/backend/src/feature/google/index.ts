import express from 'express';
import tokenRoutes from './api/token';

// Create the main router for all Google API services
const router = express.Router({ mergeParams: true });

/**
 * These imports will be uncommented as each service is implemented
 */
router.use('/token', tokenRoutes);

export { router };