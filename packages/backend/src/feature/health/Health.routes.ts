import express from 'express';
import * as HealthController from './Health.controller';

export const healthRouter = express.Router();

/**
 * @route GET /health
 * @desc Get complete system health status
 * @access Public
 * @query details - Include detailed information (default: true)
 */
healthRouter.get('/', HealthController.getSystemHealth);

/**
 * @route GET /health/ping
 * @desc Simple health check for load balancers
 * @access Public
 */
healthRouter.get('/ping', HealthController.getSimpleHealth);

/**
 * @route GET /health/uptime
 * @desc Get system uptime
 * @access Public
 */
healthRouter.get('/uptime', HealthController.getUptime);

/**
 * @route GET /health/checkers
 * @desc Get available health checkers
 * @access Public
 */
healthRouter.get('/checkers', HealthController.getAvailableCheckers);

/**
 * @route GET /health/:component
 * @desc Get health status for a specific component
 * @access Public
 * @param component - Component name (database, email, socket_io, etc.)
 */
healthRouter.get('/:component', HealthController.getComponentHealth);
