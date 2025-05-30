import { Request } from 'express';
import { Auth } from 'googleapis';

// Pagination parameters for list requests
export interface PaginationParams {
    pageToken?: string;
    maxResults?: number;
}

// Base response for list requests
export interface GoogleListResponse<T> {
    items: T[];
    nextPageToken?: string;
}

// Permission information to help client handle permission errors
export interface GooglePermissionInfo {
    permissionUrl: string;
}

// Extended Request interface with Google auth and permission info
export interface GoogleApiRequest extends Request {
    googleAuth?: Auth.OAuth2Client;
    googlePermissionInfo?: GooglePermissionInfo;
    params: {
        accountId: string;
        [key: string]: string;
    };
}