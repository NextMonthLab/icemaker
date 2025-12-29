import type { Request, Response, NextFunction } from 'express';
import { getClientIp } from './rateLimit';
import { logSecurityEvent } from './securityLogger';

export interface RequestLimits {
  maxBodySize?: number;
  maxTextLength?: number;
  requiredContentType?: string | string[];
}

const DEFAULT_LIMITS = {
  chat: { maxBodySize: 10 * 1024, maxTextLength: 5000 }, // 10KB body, 5000 chars
  analytics: { maxBodySize: 5 * 1024, maxTextLength: 1000, maxMetadataDepth: 3 }, // 5KB body, 1000 chars
  preview: { maxBodySize: 50 * 1024, maxTextLength: 10000 }, // 50KB body, 10000 chars
  admin: { maxBodySize: 2 * 1024, maxReasonLength: 500 }, // 2KB body, 500 char reason
};

export function validateRequestBody(limits: RequestLimits = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    
    // Check content-type if required
    if (limits.requiredContentType) {
      const contentType = req.headers['content-type'] || '';
      const allowedTypes = Array.isArray(limits.requiredContentType) 
        ? limits.requiredContentType 
        : [limits.requiredContentType];
      
      const isValid = allowedTypes.some(type => contentType.includes(type));
      if (!isValid) {
        logSecurityEvent({
          type: 'validation_error',
          endpoint: req.path,
          statusCode: 415,
          ip,
          reason: `Invalid content-type: ${contentType}`,
        });
        return res.status(415).json({ 
          message: 'Unsupported Media Type',
          expected: allowedTypes,
        });
      }
    }
    
    // Check body size
    if (limits.maxBodySize && req.body) {
      const bodySize = JSON.stringify(req.body).length;
      if (bodySize > limits.maxBodySize) {
        logSecurityEvent({
          type: 'validation_error',
          endpoint: req.path,
          statusCode: 413,
          ip,
          reason: `Body too large: ${bodySize} > ${limits.maxBodySize}`,
        });
        return res.status(413).json({ 
          message: 'Request body too large',
          maxSize: limits.maxBodySize,
        });
      }
    }
    
    next();
  };
}

export function validateTextLength(fieldName: string, maxLength: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body?.[fieldName];
    if (typeof value === 'string' && value.length > maxLength) {
      const ip = getClientIp(req);
      logSecurityEvent({
        type: 'validation_error',
        endpoint: req.path,
        statusCode: 400,
        ip,
        reason: `${fieldName} too long: ${value.length} > ${maxLength}`,
      });
      return res.status(400).json({ 
        message: `${fieldName} exceeds maximum length`,
        maxLength,
        actualLength: value.length,
      });
    }
    next();
  };
}

// Preset validators
export const chatRequestValidator = validateRequestBody({
  maxBodySize: DEFAULT_LIMITS.chat.maxBodySize,
  requiredContentType: 'application/json',
});

export const analyticsRequestValidator = validateRequestBody({
  maxBodySize: DEFAULT_LIMITS.analytics.maxBodySize,
  requiredContentType: 'application/json',
});

export const previewRequestValidator = validateRequestBody({
  maxBodySize: DEFAULT_LIMITS.preview.maxBodySize,
  requiredContentType: 'application/json',
});

export const chatMessageValidator = validateTextLength('message', DEFAULT_LIMITS.chat.maxTextLength);
export const analyticsPayloadValidator = validateTextLength('payload', DEFAULT_LIMITS.analytics.maxTextLength);

// Admin request validator with reason length check
export const adminRequestValidator = validateRequestBody({
  maxBodySize: DEFAULT_LIMITS.admin.maxBodySize,
  requiredContentType: 'application/json',
});

export const adminReasonValidator = validateTextLength('reason', DEFAULT_LIMITS.admin.maxReasonLength);

// Analytics metadata depth validator
export function validateMetadataDepth(maxDepth: number = 3) {
  return (req: Request, res: Response, next: NextFunction) => {
    const metadata = req.body?.metadata;
    if (metadata && typeof metadata === 'object') {
      const depth = getObjectDepth(metadata);
      if (depth > maxDepth) {
        const ip = getClientIp(req);
        logSecurityEvent({
          type: 'validation_error',
          endpoint: req.path,
          statusCode: 400,
          ip,
          reason: `Metadata too deeply nested: depth ${depth} > max ${maxDepth}`,
        });
        return res.status(400).json({
          message: 'Metadata object too deeply nested',
          maxDepth,
          actualDepth: depth,
        });
      }
    }
    next();
  };
}

function getObjectDepth(obj: unknown, currentDepth: number = 0): number {
  if (typeof obj !== 'object' || obj === null || currentDepth > 10) {
    return currentDepth;
  }
  
  let maxChildDepth = currentDepth;
  for (const value of Object.values(obj)) {
    const childDepth = getObjectDepth(value, currentDepth + 1);
    if (childDepth > maxChildDepth) {
      maxChildDepth = childDepth;
    }
  }
  return maxChildDepth;
}

export const analyticsMetadataValidator = validateMetadataDepth(DEFAULT_LIMITS.analytics.maxMetadataDepth);

// Analytics type field validator (event type name)
export const analyticsTypeValidator = validateTextLength('type', 100);

// Validate all string values in metadata don't exceed max length
export function validateMetadataStringLengths(maxLength: number = DEFAULT_LIMITS.analytics.maxTextLength) {
  return (req: Request, res: Response, next: NextFunction) => {
    const metadata = req.body?.metadata;
    if (metadata && typeof metadata === 'object') {
      const tooLongField = findOversizedString(metadata, maxLength);
      if (tooLongField) {
        const ip = getClientIp(req);
        logSecurityEvent({
          type: 'validation_error',
          endpoint: req.path,
          statusCode: 400,
          ip,
          reason: `Metadata field too long: ${tooLongField.path} (${tooLongField.length} > ${maxLength})`,
        });
        return res.status(400).json({
          message: 'Metadata string value too long',
          field: tooLongField.path,
          maxLength,
          actualLength: tooLongField.length,
        });
      }
    }
    next();
  };
}

function findOversizedString(obj: unknown, maxLength: number, path: string = ''): { path: string; length: number } | null {
  if (typeof obj === 'string') {
    if (obj.length > maxLength) {
      return { path: path || 'value', length: obj.length };
    }
    return null;
  }
  
  if (typeof obj !== 'object' || obj === null) {
    return null;
  }
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    const result = findOversizedString(value, maxLength, currentPath);
    if (result) return result;
  }
  
  return null;
}

export const analyticsMetadataStringValidator = validateMetadataStringLengths(DEFAULT_LIMITS.analytics.maxTextLength);
