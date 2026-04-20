export interface User {
  id: number;
  username: string;
  email: string;
  profile_picture_url?: string;
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
  is_friend?: boolean;
}
