import { Router, routes } from "./router/router.ts";

const kv = await globalThis.Deno.openKv();
const CACHE_KEY = ["bsky-stats.cache"];
const CACHE_DURATION = 60000; // 1 minute in milliseconds

const cors = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
};

async function fetchAndProcessStats(lastCache: any = null) {
  const res = await fetch("https://bsky-search.jazco.io/stats");
  const data = await res.json();

  const lastUpdateTime = lastCache?.last_update_time
    ? new Date(lastCache.last_update_time)
    : new Date(Date.now() - CACHE_DURATION);

  const timeSinceLast =
    new Date(data.updated_at).getTime() - lastUpdateTime.getTime();
  const usersChangeSinceLast = lastCache
    ? data.total_users - lastCache.total_users
    : 120;

  const usersGrowthRatePerSecond =
    timeSinceLast > 0
      ? usersChangeSinceLast / (timeSinceLast / 1000)
      : 2.34 * 60;

  return {
    total_users: data.total_users,
    total_posts: data.total_posts,
    total_follows: data.total_follows,
    total_likes: data.total_likes,
    users_growth_rate_per_second: usersGrowthRatePerSecond * 0.95,
    last_update_time: new Date(data.updated_at),
    next_update_time: new Date(Date.now() + CACHE_DURATION),
  };
}

globalThis.Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: cors });
  }

  const host = req.headers.get("host")!;
  const path = req.url.split(host)[1];

  if (path !== "/") {
    const router = new Router();
    router.registerRoutes(routes);

    if (req.method === "GET") {
      return router.get(req.url, req);
    } else if (req.method === "POST") {
      return router.post(req.url, req);
    }
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const cache = await kv.get(CACHE_KEY);

    // Return cached data if it's still valid
    if (
      cache.value &&
      new Date(cache.value.next_update_time).getTime() > Date.now()
    ) {
      return Response.json(cache.value, { headers: cors });
    }

    // Fetch new data and update cache
    const response = await fetchAndProcessStats(cache.value);
    await kv.set(CACHE_KEY, response);

    console.log("Cache updated:", response);

    return Response.json(response, { headers: cors });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return Response.json(
      { error: "Failed to fetch stats: " + error },
      { status: 500, headers: cors },
    );
  }
});
