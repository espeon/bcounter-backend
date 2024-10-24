const kv = await Deno.openKv();

const cors = {
  "content-type": "text/plain",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 200,
      headers: cors,
    });
  }

  try {
    let cache = await kv.get(["bsky-stats.cache"]);

    if (cache.value) {
      if (new Date(cache.value.next_update_time).getTime() > Date.now()) {
        return Response.json(cache.value, { headers: cors });
      } else {
        await kv.delete(["bsky-stats.cache"]);
      }
    }

    const res = await fetch("https://bsky-search.jazco.io/stats");
    const data = await res.json();

    // Handle cases where cache value may be undefined
    const lastUpdateTime = cache.value?.last_update_time
      ? new Date(cache.value.last_update_time)
      : new Date(Date.now() - 60000); // Fallback to 1 minute ago if no cache
    
    const timeSinceLast = new Date(data.updated_at) - lastUpdateTime;
    const usersChangeSinceLast = cache.value
      ? data.total_users - cache.value.total_users
      : 120; // Default value if no cache, assuming a change of 120 users

    // Ensure users_growth_rate_per_second is never null by handling edge cases
    const usersGrowthRatePerSecond = timeSinceLast > 0
      ? usersChangeSinceLast / (timeSinceLast / 1000)
      : 2.34 * 60; // Default to 2.34 per second if no meaningful time has passed

    console.log(lastUpdateTime, timeSinceLast, usersGrowthRatePerSecond)

    const response = {
      total_users: data.total_users,
      total_posts: data.total_posts,
      total_follows: data.total_follows,
      total_likes: data.total_likes,
      // undershoot growth rate a tiny bit
      users_growth_rate_per_second: usersGrowthRatePerSecond * .95,
      last_update_time: new Date(data.updated_at),
      next_update_time: new Date(Date.parse(data.updated_at) + 60000),
    };

    await kv.set(["bsky-stats.cache"], response);

    return Response.json(response, { headers: cors });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return Response.json(
      { error: 'Failed to fetch stats: ' + error },
      { status: 500 }
    );
  }
});
