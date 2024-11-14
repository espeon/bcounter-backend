import { Router, routes } from "./router.ts";

const kv = await Deno.openKv();

const cors = {
  "content-type": "text/plain",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
};
Deno.serve(async (req: Request) => {
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
    } else {
      return new Response("Method not allowed", { status: 405 });
    }
  }

  const CACHE_KEY = ["bsky-stats.cache"];
  const LOCK_KEY = ["bsky-stats.lock"];
  
  try {
    let cache;
    while (true) {
      const lock = await kv.get(LOCK_KEY);
      
      if (!lock.value) {
        // Acquire lock with a short expiration (half a second)
        await kv.set(LOCK_KEY, { locked: true }, { expireIn: 500 });
        
        // Check cache and return if valid
        cache = await kv.get(CACHE_KEY);
        if (cache.value && new Date(cache.value.next_update_time).getTime() > Date.now()) {
          await kv.delete(LOCK_KEY);  // Release lock
          return Response.json(cache.value, { headers: cors });
        }
        
        // Cache is invalid, delete and fetch new data
        await kv.delete(CACHE_KEY);
        console.log("Invalidating cache " + JSON.stringify(cache.value));
        
        const res = await fetch("https://bsky-search.jazco.io/stats");
        const data = await res.json();
        
        const lastUpdateTime = cache.value?.last_update_time
          ? new Date(cache.value.last_update_time)
          : new Date(Date.now() - 60000);

        const timeSinceLast = new Date(data.updated_at).getTime() - lastUpdateTime.getTime();
        const usersChangeSinceLast = cache.value
          ? data.total_users - cache.value.total_users
          : 120;
        
        const usersGrowthRatePerSecond = timeSinceLast > 0
          ? usersChangeSinceLast / (timeSinceLast / 1000)
          : 2.34 * 60;

        const response = {
          total_users: data.total_users,
          total_posts: data.total_posts,
          total_follows: data.total_follows,
          total_likes: data.total_likes,
          users_growth_rate_per_second: usersGrowthRatePerSecond * 0.95,
          last_update_time: new Date(data.updated_at),
          next_update_time: new Date(Date.parse(data.updated_at) + 60000),
        };

        await kv.set(CACHE_KEY, response);
        await kv.delete(LOCK_KEY);  // Release lock after updating cache

        return Response.json(response, { headers: cors });
      } else {
        // If locked, wait for lock to release
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  } catch (error) {
    console.error("Error fetching stats:", error);
    await kv.delete(LOCK_KEY);  // Ensure lock is released on error
    return Response.json(
      { error: "Failed to fetch stats: " + error },
      { status: 500 }
    );
  }
});
