export interface VideoInfo {
  platform: 'douyin' | 'x';
  title: string;
  author: string;
  coverUrl: string;
  videoUrl: string;
  duration?: string;
}

/**
 * 解析视频链接
 */
export async function parseVideo(url: string): Promise<{ success: boolean; data?: VideoInfo; error?: string }> {
  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error || '解析失败' };
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: '网络错误，请检查后端服务' };
  }
}

/**
 * 获取图片代理 URL（解决防盗链）
 */
export function proxyImage(url: string): string {
  if (!url) return '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

/**
 * 获取抖音视频代理下载 URL
 */
export function proxyVideo(url: string): string {
  if (!url) return '';
  return `/api/proxy-video?url=${encodeURIComponent(url)}`;
}

/**
 * 检查后端是否在线
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}
