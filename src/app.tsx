import { useState, useEffect } from 'react';
import { Download, Folder, Music, Check, X, Youtube, Settings2 } from 'lucide-react';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

function App() {
  const [query, setQuery] = useState('');
  const [savePath, setSavePath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<'music' | 'youtube'>('music');
  const [quality, setQuality] = useState<string>('high');

  // When deployed on Vercel, the API is hosted on the same domain at /api
  // In development, we can hit the local server or the Vercel API
  const apiBaseUrlNormalized = import.meta.env.PROD ? '' : 'http://127.0.0.1:8000';

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (mode === 'music') setQuality('high');
    else setQuality('1080p');
  }, [mode]);

  const themeColor = mode === 'music' ? '#1DB954' : '#FF0000';
  const themeColorHover = mode === 'music' ? '#1ed760' : '#ff3333';
  const themeColorHex = mode === 'music' ? '29,185,84' : '255,0,0';

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  };

  const handleFilePickerClick = async () => {
    try {
      const response = await fetch(`${apiBaseUrlNormalized}/api/pick-folder`);
      if (response.ok) {
        const data = await response.json();
        if (data.folder) {
          setSavePath(data.folder);
          showToast('success', 'Folder selected successfully!');
        }
      } else {
        showToast('error', 'Could not open folder picker.');
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', `Cannot open folder picker. Is the local Python backend running?`);
    }
  };

  const handleDownload = async () => {
    if (!query.trim()) {
      showToast('error', `Please enter a ${mode === 'music' ? 'song' : 'video'} URL or name`);
      return;
    }
    
    // savePath is optional in Cloud mode (Vercel), but recommended in Local mode
    const isLocal = !!apiBaseUrlNormalized;

    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrlNormalized}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          save_path: savePath,
          media_type: mode === 'music' ? 'audio' : 'video',
          quality: quality
        }),
      });

      if (response.ok) {
        // Check if the response is a file (Blob) or a JSON message
        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('application/octet-stream')) {
          const blob = await response.blob();
          const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'download';
          
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          showToast('success', 'File downloaded successfully!');
        } else {
          const data = await response.json();
          const msg = data.saved_to ? `Saved successfully to ${data.saved_to}!` : 'Download completed successfully!';
          showToast('success', msg);
        }
        setQuery('');
      } else {
        try {
          const errData = await response.json();
          showToast('error', `Download failed: ${errData.error || 'Server error'}`);
        } catch {
          const error = await response.text();
          showToast('error', `Download failed: ${error}`);
        }
      }
    } catch (error) {
      showToast('error', 'Failed to connect. Is the local Python backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-1000" style={{ background: `linear-gradient(to bottom right, #0a0a0a, #0f0f0f, #121212)` }}>
      <FloatingParticles color={themeColor} />

      <div className="relative z-10 container mx-auto px-4 py-12 md:py-24 max-w-7xl">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-20">

          {/* Left Side Text */}
          <div className="lg:w-1/2 text-center lg:text-left space-y-6 flex-1 mt-0 lg:mt-10">
            <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight drop-shadow-lg">
              No Spotify or YouTube Premium?
            </h2>
            <p className="text-xl md:text-2xl text-gray-400 font-medium max-w-2xl mx-auto lg:mx-0">
              Are you unable to download your favourite music and videos? No worries.
            </p>
            <div className="pt-6">
              <p className="text-base md:text-lg text-gray-200 bg-white/10 inline-flex text-left items-center gap-3 px-8 py-5 rounded-3xl border border-white/20 backdrop-blur-md shadow-2xl hover:bg-white/15 transition-colors duration-300">
                Enjoy high-quality music and video downloads anytime, with a fast and seamless experience. 🎧📺
              </p>
            </div>
          </div>

          {/* Right Side Form */}
          <div className="lg:w-1/2 w-full max-w-xl mx-auto flex-shrink-0">

            <div className="flex justify-center items-center gap-6 mb-8 z-20 relative">
              <span className={`text-lg font-bold transition-colors duration-300 ${mode === 'music' ? 'text-white' : 'text-gray-500'}`} style={{ color: mode === 'music' ? themeColor : '' }}>
                Music
              </span>
              <button
                onClick={() => setMode(mode === 'music' ? 'youtube' : 'music')}
                className="w-24 h-12 rounded-full p-1.5 transition-colors duration-500 relative cursor-pointer border border-white/20 shadow-xl"
                style={{ backgroundColor: mode === 'music' ? '#1DB954' : '#FF0000' }}
              >
                <div
                  className="w-9 h-9 bg-white rounded-full shadow-lg transition-transform duration-500 absolute top-1.5 flex items-center justify-center"
                  style={{ transform: mode === 'music' ? 'translateX(0)' : 'translateX(48px)' }}
                >
                  {mode === 'music' ? <Music className="w-5 h-5 text-[#1DB954]" /> : <Youtube className="w-5 h-5 text-[#FF0000]" />}
                </div>
              </button>
              <span className={`text-lg font-bold transition-colors duration-300 ${mode === 'youtube' ? 'text-white' : 'text-gray-500'}`} style={{ color: mode === 'youtube' ? themeColor : '' }}>
                YouTube
              </span>
            </div>

            <div
              className={`transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
            >
              <div
                className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl border transition-all duration-500"
                style={{ borderColor: `rgba(${themeColorHex}, 0.2)` }}
              >

                <div className="flex items-center gap-4 mb-8 justify-center">
                  <div className="p-4 rounded-full backdrop-blur-sm animate-pulse-glow" style={{ backgroundColor: `${themeColor}20` }}>
                    {mode === 'music' ? (
                      <Music className="w-8 h-8" style={{ color: themeColor }} />
                    ) : (
                      <Youtube className="w-8 h-8" style={{ color: themeColor }} />
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-white tracking-tight transition-colors duration-500">
                    Download {mode === 'music' ? 'Music' : 'Video'}
                  </h1>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      {mode === 'music' ? <Music className="w-4 h-4" style={{ color: themeColor }} /> : <Youtube className="w-4 h-4" style={{ color: themeColor }} />}
                      {mode === 'music' ? 'Song URL or Name' : 'Video URL or Name'}
                    </label>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={mode === 'music' ? "e.g., https://open.spotify.com/... or 'Bohemian Rhapsody'" : "e.g., https://www.youtube.com/watch?v=..."}
                      className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all duration-300"
                      style={{ boxShadow: query ? `0 0 10px rgba(${themeColorHex}, 0.1)` : 'none' }}
                      onFocus={(e) => {
                        e.target.style.borderColor = themeColor;
                        e.target.style.boxShadow = `0 0 20px rgba(${themeColorHex}, 0.3)`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.target.style.boxShadow = 'none';
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && handleDownload()}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="space-y-2 flex-1">
                      <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Folder className="w-4 h-4" style={{ color: themeColor }} />
                        Save Location
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={savePath}
                          onChange={(e) => setSavePath(e.target.value)}
                          placeholder="Default downloads"
                          className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all duration-300"
                          onFocus={(e) => {
                            e.target.style.borderColor = themeColor;
                            e.target.style.boxShadow = `0 0 20px rgba(${themeColorHex}, 0.3)`;
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                        <button
                          onClick={handleFilePickerClick}
                          className="px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0"
                          title="Choose folder"
                        >
                          <Folder className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 sm:w-1/3">
                      <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Settings2 className="w-4 h-4" style={{ color: themeColor }} />
                        Quality
                      </label>
                      <select
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none transition-all duration-300 appearance-none cursor-pointer"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 0.5rem center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '1.5em 1.5em',
                          paddingRight: '2.5rem'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = themeColor;
                          e.target.style.boxShadow = `0 0 20px rgba(${themeColorHex}, 0.3)`;
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        {mode === 'music' ? (
                          <>
                            <option value="high" className="bg-gray-900 text-white">High (320 kbps)</option>
                            <option value="medium" className="bg-gray-900 text-white">Medium (192)</option>
                            <option value="low" className="bg-gray-900 text-white">Low (128)</option>
                          </>
                        ) : (
                          <>
                            <option value="1080p" className="bg-gray-900 text-white">1080p</option>
                            <option value="720p" className="bg-gray-900 text-white">720p</option>
                            <option value="480p" className="bg-gray-900 text-white">480p</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleDownload}
                    disabled={isLoading}
                    className="w-full py-5 text-white font-bold rounded-xl transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg group relative overflow-hidden mt-6"
                    style={{ backgroundColor: themeColor }}
                    onMouseEnter={(e) => {
                      if (!isLoading) e.currentTarget.style.backgroundColor = themeColorHover;
                      e.currentTarget.style.boxShadow = `0 0 30px rgba(${themeColorHex}, 0.4)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = themeColor;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10" />
                        <span className="relative z-10">Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 group-hover:animate-bounce relative z-10" />
                        <span className="relative z-10 text-lg">Download Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} themeColor={themeColor} />
    </div>
  );
}

function FloatingParticles({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-xl animate-float transition-colors duration-1000"
          style={{
            backgroundColor: color + '20',
            left: (Math.random() * 100) + '%',
            top: (Math.random() * 100) + '%',
            width: (Math.random() * 100 + 50) + 'px',
            height: (Math.random() * 100 + 50) + 'px',
            animationDelay: (Math.random() * 5) + 's',
            animationDuration: (Math.random() * 10 + 15) + 's',
          }}
        />
      ))}
    </div>
  );
}

function ToastContainer({ toasts, themeColor }: { toasts: Toast[], themeColor: string }) {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-xl border transition-all duration-300 animate-slide-in text-white`}
          style={{
            backgroundColor: toast.type === 'success' ? `${themeColor}E6` : 'rgba(239, 68, 68, 0.9)',
            borderColor: toast.type === 'success' ? themeColor : '#ef4444'
          }}
        >
          {toast.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
          <span className="font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export default App;

