import './config/env.config';
import { getPort, getFrontendUrl, getProxyUrl } from './config/env.config';

import { createServer } from 'http';
import cors from 'cors';
import express, { Request, Response } from 'express';
import passport from 'passport';
import cookieParser from 'cookie-parser';

import setupPassport from './config/passport';
import db from './config/db';
import { authenticateSession, validateAccountAccess, validateTokenAccess } from './services/session';
import socketConfig from './config/socket.config';
import { applyErrorHandlers } from './utils/response';

import { router as oauthRoutes } from './feature/oauth';
import { authenticatedNeedRouter as authNeedAccountRouter, authenticationNotNeedRouter as authNotNeedAccountRouter } from './feature/account';
import { router as googleRoutes } from './feature/google';
import environmentRoutes from './feature/environment';
import { authNotRequiredRouter as localAuthNotRequiredRouter, authRequiredRouter as localAuthRequiredRouter } from './feature/local_auth';
import notificationRoutes, { NotificationSocketHandler } from './feature/notifications';
import { chatRoutes, ChatSocketHandler } from './feature/chat';

const app = express();
// Create HTTP server using the Express app
const httpServer = createServer(app);

app.set('trust proxy', true);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: [
        getFrontendUrl(),
        getProxyUrl()
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Initialize Passport
app.use(passport.initialize());
setupPassport();

// Initialize Socket.IO with the HTTP server
const io = socketConfig.initializeSocketIO(httpServer);
// Initialize socket handlers
new ChatSocketHandler(io);
new NotificationSocketHandler(io);

// Initialize database connections and models
db.initializeDB().then(() => {
    console.log('Database connections established and models initialized');
}).catch(err => {
    console.error('Database initialization error:', err);
    process.exit(1);
});

// Logging middleware
app.use((req, res, next) => {
    console.log(`[BACKEND] ${req.method} ${req.url}`);
    next();
});

// Routes - Using API paths that match the proxy configuration
app.use('/oauth', oauthRoutes);
app.use('/account', authNotNeedAccountRouter);

// Local auth routes (no authentication needed)
app.use('/auth', localAuthNotRequiredRouter);

// Routes that need authentication
app.use("/:accountId", authenticateSession, validateAccountAccess, validateTokenAccess);

app.use('/:accountId/account', authNeedAccountRouter);
app.use('/:accountId/google', googleRoutes);
app.use('/:accountId/chat', chatRoutes);
app.use('/:accountId/environments', environmentRoutes);
app.use('/:accountId/notifications', notificationRoutes);
app.use('/:accountId/auth', localAuthRequiredRouter);

applyErrorHandlers(app);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
});

// IMPORTANT: Use httpServer.listen instead of app.listen to support Socket.IO
const PORT = getPort();
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO is listening on the same port`);
});