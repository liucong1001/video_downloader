import axios from 'axios';
import { VideoInfo, resolveRedirect, extractUrl } from '../utils.js';

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * 解析抖音视频信息
 */
export async function parseDouyin(inputUrl: string): Promise<VideoInfo | null> {
  try {
    // 1. 从分享文本中提取URL
    const url = extractUrl(inputUrl) || inputUrl;

    // 2. 获取重定向后的真实URL
    const realUrl = await resolveRedirect(url);

    // 3. 从真实URL中提取视频ID
    const videoId = extractVideoId(realUrl);
    if (!videoId) {
      console.error('无法从URL中提取视频ID:', realUrl);
      return null;
    }

    // 4. 通过 iesdouyin 分享页面获取视频详情（_ROUTER_DATA）
    return await parseFromSharePage(videoId);
  } catch (error) {
    console.error('抖音视频解析失败:', error);
    return null;
  }
}

/**
 * 从 URL 中提取抖音视频 ID
 */
function extractVideoId(url: string): string | null {
  // 匹配 /video/数字 格式
  const match = url.match(/\/video\/(\d+)/);
  if (match) return match[1];

  // 匹配 /note/数字 格式
  const noteMatch = url.match(/\/note\/(\d+)/);
  if (noteMatch) return noteMatch[1];

  return null;
}

/**
 * 从 iesdouyin 分享页面的 _ROUTER_DATA 中解析视频信息
 */
async function parseFromSharePage(videoId: string): Promise<VideoInfo | null> {
  const shareUrl = `https://www.iesdouyin.com/share/video/${videoId}/`;

  const response = await axios.get(shareUrl, {
    headers: {
      'User-Agent': MOBILE_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    timeout: 15000,
  });

  const html = response.data;

  // 提取 _ROUTER_DATA
  const routerDataMatch = html.match(
    /window\._ROUTER_DATA\s*=\s*({[\s\S]*?})\s*<\/script>/
  );
  if (!routerDataMatch) {
    console.error('未找到 _ROUTER_DATA');
    return null;
  }

  let routerData: any;
  try {
    const decoded = decodeURIComponent(routerDataMatch[1]);
    routerData = JSON.parse(decoded);
  } catch (e) {
    console.error('_ROUTER_DATA 解析失败:', e);
    return null;
  }

  // 从 loaderData 中找到包含视频信息的 page key
  const loaderData = routerData?.loaderData;
  if (!loaderData) {
    console.error('未找到 loaderData');
    return null;
  }

  const pageKey = Object.keys(loaderData).find((k) => k.includes('page'));
  if (!pageKey) {
    console.error('未找到 page data');
    return null;
  }

  const pageData = loaderData[pageKey];
  const videoInfoRes = pageData?.videoInfoRes;
  if (!videoInfoRes?.item_list || videoInfoRes.item_list.length === 0) {
    console.error('未找到视频信息');
    return null;
  }

  const item = videoInfoRes.item_list[0];
  const video = item?.video;
  if (!video) {
    console.error('未找到 video 对象');
    return null;
  }

  // 获取播放地址（有水印）
  let videoUrl = video.play_addr?.url_list?.[0] || '';

  // 去除水印：将 playwm 替换为 play
  if (videoUrl) {
    videoUrl = videoUrl
      .replace(/playwm/gi, 'play')
      .replace(/&watermark=1/gi, '');
  }

  // 获取封面 - 优先 big_thumbs，其次 cover（保留原始签名 URL）
  let coverUrl = '';
  if (video.big_thumbs && video.big_thumbs.length > 0) {
    coverUrl = video.big_thumbs[0]?.img_url || '';
  }
  if (!coverUrl) {
    // 直接使用原始签名 URL，不做域名转换（签名 URL 有效期通常足够长）
    coverUrl = video.cover?.url_list?.[0] || '';
  }

  // 获取时长
  const duration = video.duration
    ? `${Math.floor(video.duration / 1000)}s`
    : undefined;

  return {
    platform: 'douyin',
    title: item?.desc || '抖音视频',
    author: item?.author?.nickname || '未知作者',
    coverUrl,
    videoUrl,
    duration,
  };
}
