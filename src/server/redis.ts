import { createClient, type RedisClientType } from "redis";
import { getServerEnv } from "@/lib/env";

let client: RedisClientType | undefined;

export async function getRedis(): Promise<RedisClientType> {
  client ??= createClient({ url: getServerEnv().REDIS_URL });
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}
