import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { detectPlatform } from './utils.js';
import { parseDouyin } from './parsers/douyin.js';
import { parseX } from './parsers/x.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

// 代理配置（用于访问被封锁的境外站点，如 Twitter CDN）
const HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy || '';
const proxyAgent = HTTP_PROXY ? new HttpsProxyAgent(HTTP_PROXY) : undefined;
if (HTTP_PROXY) {
  console.log(`🌐 已配置代理: ${HTTP_PROXY}`);
}

app.use(cors());
app.use(express.json());

// 生产环境：serve Vite 构建产物
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 视频解析接口
app.post('/api/parse', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: '请提供有效的视频链接' });
  }

  const platform = detectPlatform(url);
  if (!platform) {
    return res.status(400).json({ error: '不支持的平台，目前仅支持抖音和 X/Twitter' });
  }

  try {
    let result = null;
    if (platform === 'douyin') {
      result = await parseDouyin(url);
    } else if (platform === 'x') {
      result = await parseX(url);
    }

    if (!result) {
      return res.status(404).json({ error: '视频解析失败，请检查链接是否正确' });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('解析错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 图片代理（解决抖音封面防盗链）
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // 确保签名参数中的 + 被正确编码为 %2B（否则 CDN 会解释为空格导致 403）
    const safeUrl = url.replace(/\+/g, '%2B');
    const response = await axios.get(safeUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        Referer: 'https://www.douyin.com/',
      },
      timeout: 10000,
    });
    const contentType = String(response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('图片代理失败:', (error as any)?.message || error);
    res.status(502).json({ error: 'Image proxy failed' });
  }
});

// 视频代理（抖音 + X/Twitter 均走后端代理下载）
app.get('/api/proxy-video', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 60000,
      httpsAgent: proxyAgent,
    });

    const contentType = String(response.headers['content-type'] || 'video/mp4');
    const contentLength = response.headers['content-length'];

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    res.setHeader('Content-Disposition', 'attachment');

    response.data.pipe(res);
  } catch (error) {
    console.error('视频代理失败:', error);
    res.status(502).json({ error: 'Video proxy failed' });
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 VideoDownloader 服务已启动: http://localhost:${PORT}`);
});
