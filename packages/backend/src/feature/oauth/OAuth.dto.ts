import { Request } from "express";
import { OAuthProviders } from "../account/Account.types";
import { OAuthState, SignInState, SignUpState } from "./OAuth.types";

export type StateDetails = OAuthState | SignInState | SignUpState | null;

export interface RequestWithState extends Request {
  query: {
    state?: string;
    redirectUrl?: string;
  };
  stateDetails?: StateDetails;
}

export interface RequestWithProvider extends Request {
  params: {
    provider?: string;
  };
}

// Type-safe request interfaces
export interface SignInRequest extends Request {
  query: {
    state?: string;
    error?: string;
    redirectUrl?: string;
  };
  params: {
    provider?: OAuthProviders;
  };
}

export interface SignUpRequest extends Request {
  query: {
    state?: string;
    error?: string;
    redirectUrl?: string;
  };
  params: {
    provider?: OAuthProviders;
  };
}

export interface SignUpDetailsAddRequest extends Request {
  query: {
    state?: string;
    redirectUrl?: string;
  };
  params: {
    details?: string;
  };
  stateDetails?: StateDetails;
}

export interface OAuthCallBackRequest extends Request {
  query: {
    state?: string;
    redirectUrl?: string;
  };
  params: {
    provider?: OAuthProviders;
  };
}

export interface AuthRequest extends Request {
  query: {
    state?: string;
    redirectUrl?: string;
  };
}
