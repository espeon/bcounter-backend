export type Stats = {
    total_users: number;
    total_posts: number;
    total_follows: number;
    total_likes: number;
    follower_percentiles: FollowerPercentile[];
    updated_at: Date;
    daily_data: DailyDatum[];
}

export type DailyDatum = {
    date: Date;
    num_likes: number;
    num_likers: number;
    num_posters: number;
    num_posts: number;
    num_posts_with_images: number;
    num_images: number;
    num_images_with_alt_text: number;
    num_first_time_posters: number;
    num_follows: number;
    num_followers: number;
    num_blocks: number;
    num_blockers: number;
}

export type FollowerPercentile = {
    percentile: number;
    value: number;
}