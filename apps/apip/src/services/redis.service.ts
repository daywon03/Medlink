import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Redis Service - Pub/Sub pour communication inter-gateway
 * Permet aux gateways WebSocket séparés de communiquer entre eux
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private publisher: Redis;
  private subscriber: Redis;

  constructor() {
    const redisConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    // Publisher instance
    this.publisher = new Redis(redisConfig);

    // Subscriber instance (doit être séparé du publisher)
    this.subscriber = new Redis(redisConfig);

    this.publisher.on("connect", () => {
      this.logger.log("✅ Redis Publisher connected");
    });

    this.subscriber.on("connect", () => {
      this.logger.log("✅ Redis Subscriber connected");
    });

    this.publisher.on("error", (err) => {
      this.logger.error("❌ Redis Publisher error:", err);
    });

    this.subscriber.on("error", (err) => {
      this.logger.error("❌ Redis Subscriber error:", err);
    });
  }

  /**
   * Publier un message dans un channel Redis
   */
  async publish(channel: string, message: any): Promise<void> {
    try {
      const payload =
        typeof message === "string" ? message : JSON.stringify(message);
      await this.publisher.publish(channel, payload);
      this.logger.debug(
        `📡 Published to ${channel}: ${payload.substring(0, 100)}...`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * S'abonner à un channel Redis
   */
  async subscribe(
    channel: string,
    callback: (message: any) => void,
  ): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.logger.log(`👂 Subscribed to Redis channel: ${channel}`);

      this.subscriber.on("message", (ch, msg) => {
        if (ch === channel) {
          try {
            const parsed = JSON.parse(msg);
            callback(parsed);
          } catch {
            // Si ce n'est pas du JSON, retourner le message brut
            callback(msg);
          }
        }
      });
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Se désabonner d'un channel
   */
  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
    this.logger.log(`🔕 Unsubscribed from Redis channel: ${channel}`);
  }

  /**
   * Cleanup lors de la destruction du module
   */
  async onModuleDestroy() {
    this.logger.log("🔌 Disconnecting Redis clients...");
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}
