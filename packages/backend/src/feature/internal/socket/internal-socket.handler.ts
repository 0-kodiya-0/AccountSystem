import { Server, Socket } from 'socket.io';

export interface InternalSocketData {
    serviceId: string;
    serviceName: string;
    certificate?: {
        fingerprint: string;
        subject: any;
    };
}

export interface InternalSocket extends Socket {
    data: InternalSocketData;
}

export class InternalNotificationHandler {
    private io: Server;
    private internalNamespace;
    
    constructor(io: Server) {
        this.io = io;
        this.internalNamespace = this.io.of('/internal-notifications');
        this.init();
    }
    
    private init(): void {
        // Authentication middleware for internal Socket.IO connections
        this.internalNamespace.use((socket, next) => {
            try {
                // Extract service identification from handshake
                const serviceId = socket.handshake.auth.serviceId || socket.handshake.query.serviceId;
                const serviceName = socket.handshake.auth.serviceName || socket.handshake.query.serviceName;
                
                if (!serviceId || !serviceName) {
                    return next(new Error('Internal service identification required'));
                }
                
                // Store service info in socket data
                const internalSocket = socket as InternalSocket;
                internalSocket.data = {
                    serviceId,
                    serviceName
                };
                
                console.log(`Internal service connected to notifications: ${serviceName} (${serviceId})`);
                next();
                
            } catch {
                next(new Error('Internal authentication error'));
            }
        });
        
        // Connection event
        this.internalNamespace.on('connection', (socket) => {
            this.handleInternalConnection(socket as InternalSocket);
        });
    }
    
    private handleInternalConnection(socket: InternalSocket): void {
        const { serviceId, serviceName } = socket.data;
        
        console.log(`Internal notification socket connected: ${socket.id} for service ${serviceName}`);
        
        // Join service-specific room
        socket.join(`service-${serviceId}`);
        
        // Listen for subscription requests
        socket.on('subscribe-account', (data: { accountId: string }) => {
            if (!data.accountId) {
                socket.emit('error', { message: 'Account ID is required' });
                return;
            }
            
            // Join account-specific room for notifications
            socket.join(`account-${data.accountId}`);
            socket.emit('subscribed', { accountId: data.accountId, serviceId });
            
            console.log(`Service ${serviceName} subscribed to notifications for account ${data.accountId}`);
        });
        
        // Listen for unsubscription requests
        socket.on('unsubscribe-account', (data: { accountId: string }) => {
            if (!data.accountId) {
                socket.emit('error', { message: 'Account ID is required' });
                return;
            }
            
            socket.leave(`account-${data.accountId}`);
            socket.emit('unsubscribed', { accountId: data.accountId, serviceId });
            
            console.log(`Service ${serviceName} unsubscribed from notifications for account ${data.accountId}`);
        });
        
        // Listen for bulk subscription requests
        socket.on('subscribe-accounts', (data: { accountIds: string[] }) => {
            if (!Array.isArray(data.accountIds)) {
                socket.emit('error', { message: 'Account IDs array is required' });
                return;
            }
            
            data.accountIds.forEach(accountId => {
                socket.join(`account-${accountId}`);
            });
            
            socket.emit('bulk-subscribed', { 
                accountIds: data.accountIds, 
                serviceId,
                count: data.accountIds.length 
            });
            
            console.log(`Service ${serviceName} subscribed to ${data.accountIds.length} account notifications`);
        });
        
        // Health check
        socket.on('ping', () => {
            socket.emit('pong', { 
                serviceId, 
                serviceName, 
                timestamp: new Date().toISOString() 
            });
        });
        
        // Disconnect event
        socket.on('disconnect', (reason) => {
            console.log(`Internal notification socket disconnected: ${socket.id} (${serviceName}) - ${reason}`);
        });
    }
    
    /**
     * Emit notification to internal services subscribed to an account
     */
    public emitToInternalServices(accountId: string, event: string, data: any): void {
        this.internalNamespace.to(`account-${accountId}`).emit(event, {
            accountId,
            timestamp: new Date().toISOString(),
            ...data
        });
    }
    
    /**
     * Emit notification to a specific internal service
     */
    public emitToService(serviceId: string, event: string, data: any): void {
        this.internalNamespace.to(`service-${serviceId}`).emit(event, {
            timestamp: new Date().toISOString(),
            ...data
        });
    }
    
    /**
     * Broadcast notification to all internal services
     */
    public broadcastToInternalServices(event: string, data: any): void {
        this.internalNamespace.emit(event, {
            timestamp: new Date().toISOString(),
            ...data
        });
    }
}

export default InternalNotificationHandler;