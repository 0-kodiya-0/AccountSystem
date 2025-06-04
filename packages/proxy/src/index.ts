import express, { Request, Response, NextFunction, Application, RequestHandler, ErrorRequestHandler } from 'express';
import { createProxyMiddleware as createHttpProxyMiddleware, Options } from 'http-proxy-middleware';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http, { Server } from 'http';
import cors from 'cors';
import { ProxyState, ProxyConfig, ServiceConfig, RouteConfig } from './types';

const state: ProxyState = {
    config: null,
    server: null,
    proxies: new Map()
};

// Logging utilities
function log(level: string, message: string, meta?: any): void {
    if (!state.config?.logging?.enabled) return;

    const logLevel = state.config.logging.level || 'info';
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };

    if (levels[level as keyof typeof levels] >= levels[logLevel]) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [PROXY]`;

        if (meta && Object.keys(meta).length > 0) {
            console.log(`${prefix} ${message}`, JSON.stringify(meta, null, 2));
        } else {
            console.log(`${prefix} ${message}`);
        }
    }
}

// Configuration utilities
function loadConfig(configPath: string): ProxyConfig {
    try {
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found: ${configPath}`);
        }

        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData) as ProxyConfig;

        validateConfig(config);
        log('info', `Configuration loaded from ${configPath}`);
        return config;
    } catch (error) {
        log('error', `Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

function validateConfig(config: ProxyConfig): void {
    if (!config.port || typeof config.port !== 'number') {
        throw new Error('Config must specify a valid port number');
    }

    if (!config.services || typeof config.services !== 'object') {
        throw new Error('Config must specify services');
    }

    // Validate services
    for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
        if (!serviceConfig.target) {
            throw new Error(`Service ${serviceName} must specify a target`);
        }

        try {
            new URL(serviceConfig.target);
        } catch {
            throw new Error(`Service ${serviceName} has invalid target URL: ${serviceConfig.target}`);
        }

        // Validate routes
        if (serviceConfig.routes) {
            for (const route of serviceConfig.routes) {
                if (!route.path) {
                    throw new Error(`Route in service ${serviceName} must specify a path`);
                }

                if (route.type === 'regex') {
                    try {
                        new RegExp(route.path);
                    } catch {
                        throw new Error(`Invalid regex pattern in service ${serviceName}: ${route.path}`);
                    }
                }
            }
        }
    }

    log('info', 'Configuration validation passed');
}

// Middleware utilities
function createRequestLogger(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        log('info', `${req.method} ${req.url}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        next();
    };
}

function createErrorHandler(): ErrorRequestHandler {
    return (err: any, req: Request, res: Response, next: NextFunction) => {
        log('error', `Proxy error: ${err.message}`, {
            url: req.url,
            method: req.method,
            stack: state.config?.logging?.level === 'debug' ? err.stack : undefined
        });

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Proxy server error',
                message: err.message,
                timestamp: new Date().toISOString()
            });
        }
    };
}

function create404Handler(): RequestHandler {
    return (req: Request, res: Response) => {
        log('warn', `Route not found: ${req.method} ${req.url}`);
        res.status(404).json({
            error: 'Route not found',
            method: req.method,
            url: req.url,
            timestamp: new Date().toISOString()
        });
    };
}

// Proxy utilities
function createProxyMiddleware(serviceName: string, serviceConfig: ServiceConfig, route?: RouteConfig): any {
    const target = route?.target || serviceConfig.target;
    const headers = { ...serviceConfig.headers, ...route?.headers };

    const proxyOptions: Options = {
        target,
        changeOrigin: true,
        ws: route?.websocket ?? serviceConfig.websocket ?? false,

        on: {
            proxyReq: (proxyReq, req, res) => {
                // Add custom headers
                Object.entries(headers || {}).forEach(([key, value]) => {
                    proxyReq.setHeader(key, value);
                });

                // Add forwarded headers
                if (req.headers.host) {
                    proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
                }
                if (!req.headers['x-forwarded-proto']) {
                    const protocol = (req as any).protocol || 'http';
                    proxyReq.setHeader('X-Forwarded-Proto', protocol);
                }

                log('debug', `Proxying request to ${target}`, {
                    service: serviceName,
                    originalUrl: req.url,
                    method: req.method
                });
            },

            proxyRes: (proxyRes, req, res) => {
                // Handle cookie rewriting
                if (serviceConfig.cookieConfig && proxyRes.headers['set-cookie']) {
                    const cookieConfig = serviceConfig.cookieConfig;
                    const cookies = proxyRes.headers['set-cookie'].map(cookie => {
                        let modifiedCookie = cookie;

                        // Path rewriting
                        if (cookieConfig.pathRewrite) {
                            Object.entries(cookieConfig.pathRewrite).forEach(([from, to]) => {
                                const regex = new RegExp(`; Path=${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
                                modifiedCookie = modifiedCookie.replace(regex, `; Path=${to}`);
                            });
                        }

                        // Domain rewriting
                        if (cookieConfig.domainRewrite) {
                            if (typeof cookieConfig.domainRewrite === 'object') {
                                Object.entries(cookieConfig.domainRewrite).forEach(([from, to]) => {
                                    const regex = new RegExp(`; Domain=${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
                                    modifiedCookie = modifiedCookie.replace(regex, `; Domain=${to}`);
                                });
                            } else if (cookieConfig.domainRewrite === true) {
                                modifiedCookie = modifiedCookie.replace(/; Domain=[^;]+/i, '');
                            }
                        }

                        return modifiedCookie;
                    });
                    proxyRes.headers['set-cookie'] = cookies;
                }

                if (state.config?.logging?.responses) {
                    log('debug', `Response from ${serviceName}`, {
                        statusCode: proxyRes.statusCode,
                        contentType: proxyRes.headers['content-type']
                    });
                }
            },

            proxyReqWs: (proxyReq, req, socket, options, head) => {
                log('debug', `WebSocket request to ${serviceName}`, {
                    url: req.url
                });

                if (req.headers.host) {
                    proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
                }
            },

            error: (err, req, res) => {
                log('error', `Proxy error for ${serviceName}: ${err.message}`, {
                    url: req.url,
                    target,
                    method: req.method
                });

                if (res && 'writeHead' in res && 'headersSent' in res && typeof res.writeHead === 'function' && !res.headersSent) {
                    res.writeHead(500);
                    res.end(`Proxy error: ${err.message}`);
                }
            }
        }
    };

    return createHttpProxyMiddleware(proxyOptions);
}

function setupRouteForService(app: Application, serviceName: string, serviceConfig: ServiceConfig, route: RouteConfig): void {
    const fullPath = serviceConfig.pathPrefix
        ? path.posix.join(serviceConfig.pathPrefix, route.path)
        : route.path;

    const proxy = createProxyMiddleware(serviceName, serviceConfig, route);
    state.proxies.set(`${serviceName}-${route.path}`, proxy);

    switch (route.type) {
        case 'exact':
            app.use(fullPath, proxy);
            log('info', `  → Exact route: ${fullPath}`);
            break;
        case 'regex':
            app.use((req, res, next) => {
                const regex = new RegExp(route.path);
                if (regex.test(req.path)) {
                    proxy(req, res, next);
                } else {
                    next();
                }
            });
            log('info', `  → Regex route: ${route.path}`);
            break;
        case 'prefix':
        default:
            app.use(fullPath, proxy);
            log('info', `  → Prefix route: ${fullPath}/*`);
            break;
    }
}

function setupServiceRoutes(app: Application, serviceName: string, serviceConfig: ServiceConfig): void {
    log('info', `Setting up routes for service: ${serviceName}`);

    // Setup specific routes first
    if (serviceConfig.routes) {
        for (const route of serviceConfig.routes) {
            setupRouteForService(app, serviceName, serviceConfig, route);
        }
    }

    // Setup general service route
    if (serviceConfig.pathPrefix) {
        const proxy = createProxyMiddleware(serviceName, serviceConfig);
        state.proxies.set(serviceName, proxy);
        app.use(serviceConfig.pathPrefix, proxy);
        log('info', `  → Service route: ${serviceConfig.pathPrefix}/*`);
    }
}

function setupRoutes(app: Application): void {
    if (!state.config) {
        throw new Error('Configuration not loaded');
    }

    // Clear existing proxies
    state.proxies.clear();

    // Setup global CORS if configured
    if (state.config.cors) {
        app.use(cors(state.config.cors));
        log('info', 'Global CORS configured');
    }

    // Sort services by specificity (more specific routes first)
    const sortedServices = Object.entries(state.config.services).sort(([, a], [, b]) => {
        const aSpecificity = (a.pathPrefix?.length || 0) + (a.routes?.length || 0);
        const bSpecificity = (b.pathPrefix?.length || 0) + (b.routes?.length || 0);
        return bSpecificity - aSpecificity;
    });

    // Setup service routes
    for (const [serviceName, serviceConfig] of sortedServices) {
        setupServiceRoutes(app, serviceName, serviceConfig);
    }

    // Setup default route handler
    if (state.config.defaultService) {
        const defaultServiceConfig = state.config.services[state.config.defaultService];
        if (defaultServiceConfig) {
            const defaultProxy = createProxyMiddleware(state.config.defaultService, defaultServiceConfig);
            app.use('/', defaultProxy);
            log('info', `Default route setup for service: ${state.config.defaultService}`);
        }
    } else {
        // 404 handler
        app.use(create404Handler());
    }
}

// Server utilities
function createServer(app: express.Application): Server {
    if (!state.config) {
        throw new Error('Configuration not loaded');
    }

    if (state.config.ssl?.enabled) {
        // HTTPS server
        const sslOptions: https.ServerOptions = {};

        if (state.config.ssl.key && state.config.ssl.cert) {
            try {
                sslOptions.key = fs.readFileSync(state.config.ssl.key);
                sslOptions.cert = fs.readFileSync(state.config.ssl.cert);

                if (state.config.ssl.ca) {
                    sslOptions.ca = fs.readFileSync(state.config.ssl.ca);
                }

                log('info', 'SSL certificates loaded successfully');
            } catch (error) {
                log('error', `Failed to load SSL certificates: ${error instanceof Error ? error.message : 'Unknown error'}`);
                throw error;
            }
        } else {
            throw new Error('SSL enabled but key/cert files not specified');
        }

        return https.createServer(sslOptions, app);
    } else {
        return http.createServer(app);
    }
}

function setupWebSocketUpgrade(server: Server): void {
    server.on('upgrade', (req, socket, head) => {
        const pathname = req.url ? req.url.split('?')[0] : '';
        log('debug', `WebSocket upgrade request for path: ${pathname}`);

        if (!state.config) return;

        // Find matching proxy for WebSocket upgrade
        let handled = false;
        for (const [serviceName, serviceConfig] of Object.entries(state.config.services)) {
            if (serviceConfig.websocket ||
                serviceConfig.routes?.some(route => route.websocket && pathname.startsWith(route.path))) {

                const proxy = state.proxies.get(serviceName);
                if (proxy && proxy.upgrade) {
                    log('debug', `Upgrading WebSocket connection for service: ${serviceName}`);
                    proxy.upgrade(req, socket, head);
                    handled = true;
                    break;
                }
            }
        }

        if (!handled) {
            log('warn', `No WebSocket handler for path: ${pathname}`);
            socket.destroy();
        }
    });
}

function createApp(): express.Application {
    const app = express();

    // Setup basic middleware
    app.use(createRequestLogger());
    app.use(createErrorHandler());

    return app;
}

// Main functions
export async function startProxy(configPath: string = 'proxy-config.json'): Promise<void> {
    try {
        const resolvedConfigPath = path.resolve(configPath);

        // Load configuration
        state.config = loadConfig(resolvedConfigPath);

        // Create Express app
        const app = createApp();

        // Setup routes
        setupRoutes(app);

        // Create server
        state.server = createServer(app);

        // Setup WebSocket upgrade handling
        setupWebSocketUpgrade(state.server);

        // Start listening
        await new Promise<void>((resolve, reject) => {
            state.server!.listen(state.config!.port, () => {
                const protocol = state.config?.ssl?.enabled ? 'https' : 'http';
                log('info', `🚀 Microservices Proxy Server running at ${protocol}://localhost:${state.config!.port}`);

                // Log service configurations
                Object.entries(state.config!.services).forEach(([name, config]) => {
                    log('info', `   📡 ${name}: ${config.pathPrefix || '/'} → ${config.target}`);
                });

                resolve();
            });

            state.server!.on('error', (error) => {
                log('error', `Server error: ${error.message}`);
                reject(error);
            });
        });

    } catch (error) {
        log('error', `Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

export async function stopProxy(): Promise<void> {
    log('info', 'Stopping proxy server...');

    if (state.server) {
        await new Promise<void>((resolve) => {
            state.server!.close(() => {
                log('info', 'Proxy server stopped');
                resolve();
            });
        });
        state.server = null;
    }

    // Clear state
    state.config = null;
    state.proxies.clear();
}

// CLI functionality
async function main() {
    const configPath = process.argv[2] || 'proxy-config.json';

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        await stopProxy();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully...');
        await stopProxy();
        process.exit(0);
    });

    try {
        await startProxy(configPath);
    } catch (error) {
        console.error('Failed to start proxy server:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}