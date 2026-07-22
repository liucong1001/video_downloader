import axios from 'axios';
import { VideoInfo } from '../utils.js';

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

/**
 * 解析 X/Twitter 视频信息
 */
export async function parseX(inputUrl: string): Promise<VideoInfo | null> {
  try {
    // 1. 从 URL 中提取 tweet ID
    const tweetId = extractTweetId(inputUrl);
    if (!tweetId) {
      return null;
    }

    // 2. 使用 Twitter syndication API 获取推文信息
    const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=x`;
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': MOBILE_UA,
        Referer: 'https://platform.twitter.com/',
      },
      timeout: 10000,
    });

    const data = response.data;

    // 提取视频信息
    const videoInfo = extractVideoFromTweet(data);
    if (!videoInfo) {
      return null;
    }

    return {
      platform: 'x',
      title: data?.text || 'X 视频',
      author: data?.user?.name || '@用户',
      coverUrl: videoInfo.coverUrl,
      videoUrl: videoInfo.videoUrl,
      duration: videoInfo.duration,
    };
  } catch (error) {
    console.error('X 视频解析失败:', error);
    // 尝试备用方案
    return await parseXAlternate(inputUrl);
  }
}

/**
 * 从 URL 中提取 tweet ID
 */
function extractTweetId(url: string): string | null {
  // 匹配 x.com/用户/status/数字 或 twitter.com/用户/status/数字
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * 从推文数据中提取视频信息
 */
function extractVideoFromTweet(data: any): { videoUrl: string; coverUrl: string; duration?: string } | null {
  try {
    // 尝试从 mediaDetails 中获取
    const mediaDetails = data?.mediaDetails || data?.media?.mediaDetails;
    if (mediaDetails && Array.isArray(mediaDetails)) {
      for (const media of mediaDetails) {
        if (media.type === 'video' || media.media_info) {
          const variants = media?.media_info?.variants || [];
          // 选择最高比特率的 MP4
          const mp4Variants = variants
            .filter((v: any) => v.content_type === 'video/mp4' || v.type === 'video/mp4')
            .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

          if (mp4Variants.length > 0) {
            return {
              videoUrl: mp4Variants[0].src || mp4Variants[0].url,
              coverUrl: media?.media_url_https || media?.src || '',
              duration: media?.media_info?.duration_millis
                ? `${Math.floor(media.media_info.duration_millis / 1000)}s`
                : undefined,
            };
          }
        }
      }
    }

    // 尝试从 video 字段获取
    if (data?.video) {
      const variants = data.video.variants || [];
      const mp4Variants = variants
        .filter((v: any) => v.content_type === 'video/mp4')
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

      if (mp4Variants.length > 0) {
        return {
          videoUrl: mp4Variants[0].url,
          coverUrl: data.video.poster || data.video.cover || '',
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 备用解析方案
 */
async function parseXAlternate(url: string): Promise<VideoInfo | null> {
  try {
    // 使用第三方解析服务
    const tweetId = extractTweetId(url);
    if (!tweetId) return null;

    const apiUrl = `https://api.fxtwitter.com/status/${tweetId}`;
    const response = await axios.get(apiUrl, {
      headers: { 'User-Agent': MOBILE_UA },
      timeout: 10000,
    });

    const tweet = response.data?.tweet;
    if (!tweet) return null;

    const media = tweet?.media;
    let videoUrl = '';
    let coverUrl = '';

    if (media?.videos) {
      const videos = Object.values(media.videos) as any[];
      if (videos.length > 0) {
        const variants = videos[0]?.variants || [];
        const mp4 = variants
          .filter((v: any) => v.content_type === 'video/mp4')
          .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        if (mp4.length > 0) {
          videoUrl = mp4[0].url;
        }
        coverUrl = videos[0]?.poster || '';
      }
    }

    if (!videoUrl) return null;

    return {
      platform: 'x',
      title: tweet?.text || 'X 视频',
      author: tweet?.author?.name || tweet?.author?.screen_name || '@用户',
      coverUrl,
      videoUrl,
    };
  } catch {
    return null;
  }
}
