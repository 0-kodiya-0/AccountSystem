import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware to track parent URL across route layers
 * This should be added at each route layer to build up the parent path
 *
 * @param pathSegment - The path segment for this route layer (e.g., '/oauth', '/api')
 */
export const trackParentUrl = (pathSegment: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Clean the path segment
    const cleanSegment = pathSegment.startsWith('/') ? pathSegment : '/' + pathSegment;

    // Initialize or append to parentUrl
    if (!req.parentUrl) {
      req.parentUrl = cleanSegment;
    } else {
      // Append this segment to existing parent URL
      req.parentUrl = req.parentUrl + cleanSegment;
    }

    logger.info(`Parent URL updated: ${req.parentUrl} (added: ${cleanSegment})`);
    next();
  };
};

/**
 * Alternative: Auto-tracking middleware that doesn't require manual path specification
 * This automatically builds the parent URL based on the route mounting
 */
export const autoTrackParentUrl = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get the base URL (what's been matched so far)
    const baseUrl = req.baseUrl || '';

    // Set parent URL to the base URL
    req.parentUrl = baseUrl;

    logger.info(`Auto-tracked parent URL: ${req.parentUrl}`);
    next();
  };
};
