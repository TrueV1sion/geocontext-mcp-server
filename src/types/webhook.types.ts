export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  active: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

export type WebhookEvent =
  | 'route.completed'
  | 'route.failed'
  | 'enrichment.completed'
  | 'enrichment.failed'
  | 'batch.completed'
  | 'batch.failed';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: Date;
  data: any;
  correlationId?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  lastAttempt?: Date;
  error?: string;
}

export interface JobRequest {
  id: string;
  type: 'route' | 'enrichment' | 'batch';
  data: any;
  webhookId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}
