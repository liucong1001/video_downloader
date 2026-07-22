import { useState, useEffect, useCallback, useRef } from 'react';
import { parseVideo, proxyImage, proxyVideo, checkHealth, type VideoInfo } from './api';

interface DownloadRecord {
  id: string;
  title: string;
  platform: string;
  date: string;
  videoUrl: string;
}

const HISTORY_KEY = 'vd_history';

function App() {
  const [url, setUrl] = useState('');
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载历史记录
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // 检查后端健康
  useEffect(() => {
    checkHealth().then(setOnline);
    const timer = setInterval(() => checkHealth().then(setOnline), 10000);
    return () => clearInterval(timer);
  }, []);

  const saveHistory = (list: DownloadRecord[]) => {
    setHistory(list);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  };

  const addHistory = (record: DownloadRecord) => {
    const filtered = history.filter((r: DownloadRecord) => r.videoUrl !== record.videoUrl);
    saveHistory([record, ...filtered].slice(0, 50));
  };

  const deleteHistory = (id: string) => {
    saveHistory(history.filter((r: DownloadRecord) => r.id !== id));
  };

  // 解析视频
  const handleParse = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setVideo(null);

    const result = await parseVideo(url.trim());
    setLoading(false);

    if (result.success && result.data) {
      setVideo(result.data);
    } else {
      setError(result.error || '解析失败');
    }
  }, [url]);

  // 粘贴
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        // 自动提取 URL 并解析
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          setUrl(urlMatch[0]);
        }
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  // 下载视频
  const handleDownload = useCallback(async () => {
    if (!video?.videoUrl) return;
    setDownloading(true);
    setProgress(0);

    try {
      // 所有平台均通过后端代理下载（抖音绕过 CORS/Referer，X/Twitter 绕过网络封锁）
      const downloadUrl = proxyVideo(video.videoUrl);

      setProgress(0.1);
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = Number(response.headers.get('content-length') || 0);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (contentLength > 0) {
          setProgress(Math.min(0.9, received / contentLength));
        }
      }

      const blob = new Blob(chunks as unknown as BlobPart[], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const safeName = video.title.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 60);
      a.download = `${safeName}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      setProgress(1);

      // 添加到历史记录
      addHistory({
        id: Date.now().toString(),
        title: video.title,
        platform: video.platform,
        date: new Date().toLocaleString('zh-CN'),
        videoUrl: video.videoUrl,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '下载失败';
      setError(`下载失败: ${msg}。请确认服务端已配置 HTTP_PROXY 代理。`);
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  }, [video, history]);

  return (
    <div className="app">
      <header className="header">
        <h1>VideoDownloader</h1>
        <p className="subtitle">下载抖音和 X 上的视频</p>
        <span className={`status ${online ? 'online' : 'offline'}`}>
          {online ? '服务已连接' : '服务未连接'}
        </span>
      </header>

      <section className="input-section">
        <div className="input-group">
          <input
            ref={inputRef}
            type="text"
            className="url-input"
            placeholder="粘贴抖音或 X 视频链接..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleParse()}
            disabled={loading}
          />
          <button className="btn btn-paste" onClick={handlePaste}>粘贴</button>
        </div>
        <button
          className="btn btn-parse"
          onClick={handleParse}
          disabled={loading || !url.trim()}
        >
          {loading ? '解析中...' : '解析'}
        </button>
      </section>

      {error && <div className="error">{error}</div>}

      {video && (
        <section className="video-card">
          {video.coverUrl && (
            <img
              src={proxyImage(video.coverUrl)}
              alt="cover"
              className="cover"
            />
          )}
          <div className="video-info">
            <span className={`platform-badge ${video.platform}`}>
              {video.platform === 'douyin' ? '抖音' : 'X'}
            </span>
            {video.duration && <span className="duration">{video.duration}</span>}
            <p className="title">{video.title}</p>
            <p className="author">{video.author}</p>
          </div>
          <button
            className="btn btn-download"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? `下载中 ${Math.round(progress * 100)}%` : '下载视频'}
          </button>
        </section>
      )}

      <section className="history-section">
        <h2>下载历史</h2>
        {history.length === 0 ? (
          <p className="empty">暂无下载记录</p>
        ) : (
          <ul className="history-list">
            {history.map(item => (
              <li key={item.id} className="history-item">
                <div className="history-info">
                  <span className={`platform-badge ${item.platform}`}>
                    {item.platform === 'douyin' ? '抖音' : 'X'}
                  </span>
                  <p className="history-title">{item.title}</p>
                  <p className="history-date">{item.date}</p>
                </div>
                <button className="btn-icon" onClick={() => deleteHistory(item.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;
