import axios from 'axios';

export interface VideoInfo {
  platform: 'douyin' | 'x';
  title: string;
  author: string;
  coverUrl: string;
  videoUrl: string;
  duration?: string;
}

/**
 * 检测 URL 属于哪个平台
 */
export function detectPlatform(url: string): 'douyin' | 'x' | null {
  if (/douyin\.com|iesdouyin\.com|v\.douyin/i.test(url)) {
    return 'douyin';
  }
  if (/x\.com|twitter\.com/i.test(url)) {
    return 'x';
  }
  return null;
}

/**
 * 获取重定向后的真实 URL
 */
export async function resolveRedirect(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      },
    });
    return response.request.res.responseUrl || response.config.url || url;
  } catch {
    return url;
  }
}

/**
 * 从文本中提取第一个 URL
 */
export function extractUrl(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/i;
  const match = text.match(urlRegex);
  return match ? match[1] : null;
}
