import { emailMock, type MockEmailMessage } from '../../../mocks/email/EmailServiceMock';
import { EmailTemplate } from '../Email.types';

export interface EmailFilters {
  email?: string;
  template?: EmailTemplate;
  limit?: number;
  metadata?: {
    testId?: string;
    testName?: string;
    testSuite?: string;
    accountId?: string;
    userId?: string;
    emailFlow?: string;
    flowStep?: string;
    feature?: string;
    action?: string;
    tags?: string[];
    [key: string]: any;
  };
}

export interface TestSendEmailParams {
  to: string;
  template: EmailTemplate;
  variables: Record<string, string>;
  metadata?: MockEmailMessage['metadata'];
}

/**
 * Get email mock status and configuration
 */
export function getStatus() {
  return {
    enabled: emailMock.isEnabled(),
    config: emailMock.getConfig(),
    stats: emailMock.getStats(),
  };
}

/**
 * Get sent emails with filtering
 */
export function getSentEmails(filters: EmailFilters) {
  let emails = emailMock.getSentEmails();

  // Apply basic filters
  if (filters.email) {
    emails = emails.filter((msg) => msg.to === filters.email);
  }

  if (filters.template) {
    emails = emails.filter((msg) => msg.template === filters.template);
  }

  // Apply metadata filters if provided
  if (filters.metadata && Object.keys(filters.metadata).length > 0) {
    // Remove undefined values from metadata filter
    const metadataFilter = Object.fromEntries(
      Object.entries(filters.metadata).filter(([_, value]) => value !== undefined),
    );

    if (Object.keys(metadataFilter).length > 0) {
      emails = emailMock.getEmailsByMetadata(metadataFilter);
    }
  }

  // Apply limit
  if (filters.limit && filters.limit > 0) {
    emails = emails.slice(-filters.limit);
  }

  return {
    emails,
    count: emails.length,
    total: emailMock.getSentEmails().length,
    appliedFilters: filters,
  };
}

/**
 * Get latest email for specific address
 */
export function getLatestEmail(email: string, filters: { template?: EmailTemplate; metadata?: any }) {
  // Build metadata filter from query params
  const metadataFilter: any = {};
  if (filters.metadata) {
    Object.entries(filters.metadata).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        metadataFilter[key] = value;
      }
    });
  }

  let latestEmail: MockEmailMessage | null = null;

  if (Object.keys(metadataFilter).length > 0) {
    // Use metadata filtering
    const metadataEmails = emailMock.getEmailsByMetadata(metadataFilter).filter((msg) => msg.to === email);

    if (filters.template) {
      const templateEmails = metadataEmails.filter((msg) => msg.template === filters.template);
      latestEmail = templateEmails.length > 0 ? templateEmails[templateEmails.length - 1] : null;
    } else {
      latestEmail = metadataEmails.length > 0 ? metadataEmails[metadataEmails.length - 1] : null;
    }
  } else {
    // Legacy behavior
    latestEmail = emailMock.getLatestEmailForAddress(email);

    if (filters.template && latestEmail && latestEmail.template !== filters.template) {
      const templateEmails = emailMock.getEmailsByTemplate(filters.template).filter((msg) => msg.to === email);
      latestEmail = templateEmails.length > 0 ? templateEmails[templateEmails.length - 1] : null;
    }
  }

  return {
    email: latestEmail,
    found: !!latestEmail,
  };
}

/**
 * Clear emails with optional metadata filtering
 */
export function clearEmails(metadataFilter: Record<string, any>) {
  // Remove undefined values from filter
  const cleanFilter = Object.fromEntries(Object.entries(metadataFilter).filter(([_, value]) => value !== undefined));

  let clearedCount = 0;

  if (Object.keys(cleanFilter).length > 0) {
    // Clear by metadata filter
    clearedCount = emailMock.clearEmailsByMetadata(cleanFilter);
  } else {
    // Clear all emails
    const totalBefore = emailMock.getSentEmails().length;
    emailMock.clearSentEmails();
    clearedCount = totalBefore;
  }

  return {
    message:
      Object.keys(cleanFilter).length > 0
        ? `Cleared ${clearedCount} emails matching filter criteria`
        : 'All email history cleared successfully',
    cleared: true,
    clearedCount,
    filter: Object.keys(cleanFilter).length > 0 ? cleanFilter : 'all',
  };
}

/**
 * Clear all emails
 */
export function clearAllEmails() {
  const totalBefore = emailMock.getSentEmails().length;
  emailMock.clearSentEmails();

  return {
    message: 'All email history cleared successfully',
    cleared: true,
    clearedCount: totalBefore,
  };
}

/**
 * Test email sending
 */
export async function testSendEmail(params: TestSendEmailParams) {
  if (!emailMock.isEnabled()) {
    throw new Error('Email mock is not enabled');
  }

  // Send test email through the mock system with optional metadata
  await emailMock.sendEmail(params.to, `Test Email - ${params.template}`, params.template, params.variables, {
    metadata: params.metadata,
  });

  return {
    message: 'Test email sent successfully',
    to: params.to,
    template: params.template,
    metadata: params.metadata,
  };
}

/**
 * Get emails by template type
 */
export function getEmailsByTemplate(template: EmailTemplate, filters: { limit?: number; metadata?: any }) {
  let emails = emailMock.getEmailsByTemplate(template);

  // Apply metadata filters if provided
  if (filters.metadata) {
    const metadataFilter = Object.fromEntries(
      Object.entries(filters.metadata).filter(([_, value]) => value !== undefined && typeof value === 'string'),
    );

    if (Object.keys(metadataFilter).length > 0) {
      emails = emails.filter((email) => {
        if (!email.metadata) return false;

        for (const [key, value] of Object.entries(metadataFilter)) {
          if (email.metadata[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
  }

  if (filters.limit && filters.limit > 0) {
    emails = emails.slice(-filters.limit);
  }

  return {
    template,
    emails,
    count: emails.length,
    appliedFilters: filters,
  };
}

/**
 * Search emails by metadata criteria
 */
export function searchByMetadata(filter: Record<string, any>, limit?: number) {
  let emails = emailMock.getEmailsByMetadata(filter);

  if (limit && typeof limit === 'number' && limit > 0) {
    emails = emails.slice(-limit);
  }

  return {
    emails,
    count: emails.length,
    filter,
    limit: limit || 'none',
  };
}

/**
 * Get emails by test context
 */
export function getEmailsByTestContext(testId: string, limit?: number) {
  let emails = emailMock.getEmailsByTestContext(testId);

  if (limit && limit > 0) {
    emails = emails.slice(-limit);
  }

  return {
    testId,
    emails,
    count: emails.length,
  };
}

/**
 * Get emails by flow
 */
export function getEmailsByFlow(flowName: string, flowStep?: string, limit?: number) {
  let emails = emailMock.getEmailsByFlow(flowName, flowStep);

  if (limit && limit > 0) {
    emails = emails.slice(-limit);
  }

  return {
    flow: flowName,
    flowStep: flowStep || 'all',
    emails,
    count: emails.length,
  };
}

/**
 * Get available email templates
 */
export function getAvailableTemplates() {
  // Get all available email templates
  const templates = Object.values(EmailTemplate);

  // Get usage statistics for each template
  const stats = emailMock.getStats();

  const templateInfo = templates.map((template) => ({
    name: template,
    displayName: template.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    sentCount: stats.sentByTemplate[template] || 0,
    failedCount: stats.failedByTemplate[template] || 0,
  }));

  return {
    templates: templateInfo,
    totalTemplates: templates.length,
  };
}

/**
 * Get enhanced statistics with metadata breakdowns
 */
export function getEnhancedStats() {
  const stats = emailMock.getStats();

  return {
    ...stats,
    summary: {
      totalEmails: stats.totalSent + stats.totalFailed,
      successRate:
        stats.totalSent + stats.totalFailed > 0
          ? ((stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100).toFixed(2) + '%'
          : '0%',
      mostUsedTemplate: Object.entries(stats.sentByTemplate).sort(([, a], [, b]) => b - a)[0]?.[0] || 'none',
      mostActiveTestSuite: Object.entries(stats.byMetadata.byTestSuite).sort(([, a], [, b]) => b - a)[0]?.[0] || 'none',
      mostActiveFlow: Object.entries(stats.byMetadata.byEmailFlow).sort(([, a], [, b]) => b - a)[0]?.[0] || 'none',
    },
  };
}

/**
 * Get metadata insights
 */
export function getMetadataInsights() {
  const allEmails = emailMock.getSentEmails();
  const emailsWithMetadata = allEmails.filter((email) => email.metadata);

  return {
    totalEmails: allEmails.length,
    emailsWithMetadata: emailsWithMetadata.length,
    metadataUsageRate:
      allEmails.length > 0 ? ((emailsWithMetadata.length / allEmails.length) * 100).toFixed(2) + '%' : '0%',

    uniqueValues: {
      testSuites: [...new Set(emailsWithMetadata.map((e) => e.metadata?.testSuite).filter(Boolean))],
      emailFlows: [...new Set(emailsWithMetadata.map((e) => e.metadata?.emailFlow).filter(Boolean))],
      features: [...new Set(emailsWithMetadata.map((e) => e.metadata?.feature).filter(Boolean))],
      actions: [...new Set(emailsWithMetadata.map((e) => e.metadata?.action).filter(Boolean))],
      allTags: [...new Set(emailsWithMetadata.flatMap((e) => e.metadata?.tags || []))],
    },

    recentTestSuites: emailsWithMetadata
      .slice(-20)
      .map((e) => e.metadata?.testSuite)
      .filter(Boolean)
      .filter((suite, index, arr) => arr.indexOf(suite) === index)
      .slice(0, 5),

    recentFlows: emailsWithMetadata
      .slice(-20)
      .map((e) => e.metadata?.emailFlow)
      .filter(Boolean)
      .filter((flow, index, arr) => arr.indexOf(flow) === index)
      .slice(0, 5),
  };
}
