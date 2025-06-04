import { Server } from 'http';

export interface RouteConfig {
    path: string;
    type?: 'exact' | 'prefix' | 'regex';
    websocket?: boolean;
    headers?: Record<string, string>;
    target?: string;
}

export interface CookieConfig {
    pathRewrite?: Record<string, string>;
    domainRewrite?: boolean | Record<string, string>;
}

export interface ServiceConfig {
    target: string;
    pathPrefix?: string;
    websocket?: boolean;
    headers?: Record<string, string>;
    routes?: RouteConfig[];
    cookieConfig?: CookieConfig;
    cors?: {
        origin?: string | string[] | boolean;
        credentials?: boolean;
        methods?: string[];
    };
}

export interface SSLConfig {
    enabled: boolean;
    key?: string;
    cert?: string;
    ca?: string;
}

export interface LoggingConfig {
    enabled: boolean;
    level?: 'debug' | 'info' | 'warn' | 'error';
    requests?: boolean;
    responses?: boolean;
    errors?: boolean;
}

export interface ProxyConfig {
    port: number;
    ssl?: SSLConfig;
    logging?: LoggingConfig;
    services: Record<string, ServiceConfig>;
    defaultService?: string;
    cors?: {
        origin?: string | string[] | boolean;
        credentials?: boolean;
        methods?: string[];
    };
}

export interface ProxyState {
    config: ProxyConfig | null;
    server: Server | null;
    proxies: Map<string, any>;
}