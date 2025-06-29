import express from 'express';
import * as InternalHealthController from './Health.internal.controller';

export const internalHealthRouter = express.Router();

/**
 * @route GET /health
 * @desc Get complete internal system health status
 * @access Internal
 * @query details - Include detailed information (default: true)
 */
internalHealthRouter.get('/', InternalHealthController.getInternalSystemHealth);

/**
 * @route GET /health/ping
 * @desc Simple health check for load balancers
 * @access Internal
 */
internalHealthRouter.get('/ping', InternalHealthController.getInternalHealthPing);

/**
 * @route GET /health/api
 * @desc Get internal API specific health status
 * @access Internal
 */
internalHealthRouter.get('/api', InternalHealthController.getInternalApiHealth);

/**
 * @route GET /health/uptime
 * @desc Get internal server uptime
 * @access Internal
 */
internalHealthRouter.get('/uptime', InternalHealthController.getInternalUptime);

/**
 * @route GET /health/summary
 * @desc Get internal health summary (minimal response)
 * @access Internal
 */
internalHealthRouter.get('/summary', InternalHealthController.getInternalHealthSummary);

/**
 * @route GET /health/checkers
 * @desc Get available internal health checkers
 * @access Internal
 */
internalHealthRouter.get('/checkers', InternalHealthController.getInternalHealthCheckers);
