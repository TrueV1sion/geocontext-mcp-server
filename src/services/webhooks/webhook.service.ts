import axios, { AxiosInstance } from 'axios';
import { createHmac } from 'crypto';
import logger from '../logger.service.js';
import config from '../../config/config.service.js';
import {
  Webhook,
  WebhookEvent,
  WebhookPayload,
  WebhookDelivery,
} from '../../types/webhook.types.js';
import { generateId } from '../../utils/helpers.js';

class WebhookService {
  private static instance: WebhookService;
  private webhooks: Map<string, Webhook>;
  private deliveries: Map<string, WebhookDelivery>;
  private httpClient: AxiosInstance;

  private constructor() {
    this.webhooks = new Map();
    this.deliveries = new Map();

    this.httpClient = axios.create({
      timeout: config.getTimeout('defaultHttp'),
      headers: {
        'User-Agent': 'GeoContext-MCP-Server/1.0',
        'Content-Type': 'application/json',
      },
    });

    logger.info('Webhook service initialized');
  }

  public static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Register a new webhook
   */
  public registerWebhook(
    url: string,
    events: WebhookEvent[],
    secret?: string
  ): Webhook {
    const webhook: Webhook = {
      id: generateId('webhook'),
      url,
      events,
      secret,
      active: true,
      createdAt: new Date(),
    };

    this.webhooks.set(webhook.id, webhook);
    logger.info(`Webhook registered: ${webhook.id}`, { url, events });

    return webhook;
  }

  /**
   * Unregister a webhook
   */
  public unregisterWebhook(webhookId: string): boolean {
    const deleted = this.webhooks.delete(webhookId);
    if (deleted) {
      logger.info(`Webhook unregistered: ${webhookId}`);
    }
    return deleted;
  }

  /**
   * Get webhook by ID
   */
  public getWebhook(webhookId: string): Webhook | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * List all webhooks
   */
  public listWebhooks(): Webhook[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Trigger webhook for an event
   */
  public async triggerEvent(
    event: WebhookEvent,
    data: any,
    correlationId?: string
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date(),
      data,
      correlationId,
    };

    // Find all webhooks subscribed to this event
    const subscribedWebhooks = Array.from(this.webhooks.values()).filter(
      webhook => webhook.active && webhook.events.includes(event)
    );

    logger.info(`Triggering event ${event} for ${subscribedWebhooks.length} webhooks`);

    // Deliver to all subscribed webhooks
    await Promise.all(
      subscribedWebhooks.map(webhook => this.deliverWebhook(webhook, payload))
    );
  }

  /**
   * Deliver webhook payload
   */
  private async deliverWebhook(
    webhook: Webhook,
    payload: WebhookPayload
  ): Promise<void> {
    const delivery: WebhookDelivery = {
      id: generateId('delivery'),
      webhookId: webhook.id,
      payload,
      status: 'pending',
      attempts: 0,
    };

    this.deliveries.set(delivery.id, delivery);

    // Attempt delivery with retries
    await this.attemptDelivery(webhook, delivery);
  }

  /**
   * Attempt webhook delivery with retries
   */
  private async attemptDelivery(
    webhook: Webhook,
    delivery: WebhookDelivery,
    maxAttempts: number = 3
  ): Promise<void> {
    while (delivery.attempts < maxAttempts) {
      delivery.attempts++;
      delivery.lastAttempt = new Date();

      try {
        const headers: Record<string, string> = {
          'X-Webhook-Event': delivery.payload.event,
          'X-Webhook-Delivery': delivery.id,
        };

        // Add signature if secret is configured
        if (webhook.secret) {
          const signature = this.generateSignature(
            JSON.stringify(delivery.payload),
            webhook.secret
          );
          headers['X-Webhook-Signature'] = signature;
        }

        await this.httpClient.post(webhook.url, delivery.payload, { headers });

        delivery.status = 'success';
        webhook.lastTriggered = new Date();

        logger.info(`Webhook delivered successfully: ${delivery.id}`, {
          webhookId: webhook.id,
          event: delivery.payload.event,
        });

        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        delivery.error = errorMessage;

        logger.error(`Webhook delivery attempt ${delivery.attempts} failed: ${delivery.id}`, {
          webhookId: webhook.id,
          error: errorMessage,
        });

        // Exponential backoff before retry
        if (delivery.attempts < maxAttempts) {
          const backoffMs = Math.pow(2, delivery.attempts) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    delivery.status = 'failed';
    logger.error(`Webhook delivery failed after ${maxAttempts} attempts: ${delivery.id}`);
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Get delivery history for a webhook
   */
  public getDeliveries(webhookId: string, limit: number = 50): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => {
        const aTime = a.lastAttempt || new Date(0);
        const bTime = b.lastAttempt || new Date(0);
        return bTime.getTime() - aTime.getTime();
      })
      .slice(0, limit);
  }

  /**
   * Get webhook statistics
   */
  public getStats(): {
    totalWebhooks: number;
    activeWebhooks: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
  } {
    const totalWebhooks = this.webhooks.size;
    const activeWebhooks = Array.from(this.webhooks.values()).filter(
      w => w.active
    ).length;

    const deliveriesArray = Array.from(this.deliveries.values());
    const totalDeliveries = deliveriesArray.length;
    const successfulDeliveries = deliveriesArray.filter(
      d => d.status === 'success'
    ).length;
    const failedDeliveries = deliveriesArray.filter(
      d => d.status === 'failed'
    ).length;

    return {
      totalWebhooks,
      activeWebhooks,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
    };
  }
}

export default WebhookService.getInstance();
