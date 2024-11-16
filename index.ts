import { Hono, Context, Next } from 'hono'
import { DailyDatum, Stats } from "./types/stats.ts";
import { Cache } from "./types/cache.ts";

const app = new Hono()
const kv = await Deno.openKv()

const CACHE_KEY = ["bsky-stats.cache"];
const DAILY_DATA_KEY = ["bsky-stats.daily_data"];
const CACHE_DURATION = 60000;

const corsHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
};

app.use('*', async (c: Context, next: Next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => c.header(key, value));
});

/**
 * Fetches statistical data from the specified endpoint.
 *
 * @returns {Promise<Stats>} A promise that resolves to the fetched statistical data.
 * @throws {Error} If the fetch operation fails or the response is not ok.
 */
async function fetchStatsData(): Promise<Stats> {
  const res = await fetch('https://bsky-search.jazco.io/stats');
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return await res.json() as Stats;
}

/**
 * Fetches and processes statistical data, returning a cache object with updated statistics.
 *
 * @param {Cache | null} [lastCache=null] - The previous cache object, or null if there is no previous cache.
 * @returns {Promise<Cache>} A promise that resolves to a cache object containing updated statistics.
 *
 * The function performs the following steps:
 * 1. Fetches the latest statistical data.
 * 2. Determines the last update time from the previous cache or defaults to a calculated time.
 * 3. Calculates the time elapsed since the last update.
 * 4. Computes the change in the number of users since the last update.
 * 5. Calculates the user growth rate per second.
 * 6. Returns a new cache object with updated statistics and calculated growth rate.
 */
async function fetchAndProcessStats(lastCache: Cache | null = null): Promise<Cache> {
  const data = await fetchStatsData();

  const lastUpdateTime = lastCache?.last_update_time
    ? new Date(lastCache.last_update_time)
    : new Date(Date.now() - CACHE_DURATION);

  const timeSinceLast = new Date(data.updated_at).getTime() - lastUpdateTime.getTime();
  const usersChangeSinceLast = lastCache ? data.total_users - lastCache.total_users : 120;
  const usersGrowthRatePerSecond =
    timeSinceLast > 0 ? usersChangeSinceLast / (timeSinceLast / 1000) : 2.34 * 60;

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

/**
 * Retrieves a cached value from the key-value store.
 *
 * @template T - The type of the cached value.
 * @param {string[]} key - The key used to retrieve the cached value.
 * @returns {Promise<T | null>} - A promise that resolves to the cached value if found, or null if not found.
 */
async function getCache<T>(key: string[]): Promise<T | null> {
  const cache = await kv.get<T>(key);
  return cache.value || null;
}

/**
 * Asynchronously sets a value in the cache.
 *
 * @template T - The type of the data to be cached.
 * @param {string[]} key - The key under which the data should be stored.
 * @param {T} data - The data to be cached.
 * @returns {Promise<void>} A promise that resolves when the data has been set in the cache.
 */
async function setCache<T>(key: string[], data: T): Promise<void> {
  await kv.set(key, data);
}

app.get('/', async (c: Context ) => {
  const cachedData = await getCache<Cache>(CACHE_KEY);

  if (cachedData && new Date(cachedData.next_update_time).getTime() > Date.now()) {
    return c.json(cachedData);
  }

  const response = await fetchAndProcessStats(cachedData);
  await setCache(CACHE_KEY, response);

  console.log('Cache updated:', response);
  return c.json(response);
});

app.get('/daily', async (c: Context ) => {
  const dailyData = await getCache<DailyDatum[]>(DAILY_DATA_KEY) || [];
  return c.json(dailyData);
});

/**
 * Filters and returns the daily data entries from the last seven days.
 *
 * @param data - An object containing the daily data entries.
 * @returns An array of daily data entries from the last seven days.
 */
function getLastSevenDaysData(data: Stats): DailyDatum[] {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  return data.daily_data.filter(d => {
    const entryDate = new Date(d.date);
    return entryDate >= sevenDaysAgo && entryDate <= now;
  });
}

Deno.cron("Fetch and Update Daily Data", "0 * * * *", async () => {
  try {
    const data = await fetchStatsData();
    const recentDailyData = getLastSevenDaysData(data);

    await setCache(DAILY_DATA_KEY, recentDailyData);
    console.log('Updated daily data cache');
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});

Deno.serve(app.fetch)