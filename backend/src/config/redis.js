import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on("error", (error) => {
  console.error("Redis Error:", error);
});

await redisClient.connect();

console.log("Redis Connected");

export default redisClient;