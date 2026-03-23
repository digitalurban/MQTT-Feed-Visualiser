import React, { useEffect, useRef, useState, useCallback } from 'react';
import mqtt from 'mqtt';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Info, Wifi, WifiOff, Maximize2, Minimize2 } from 'lucide-react';

const GRID_SIZE = 90;
const FLASH_DURATION = 300; // ms
const TIMEOUT_DURATION = 61 * 60 * 1000; // 61 minutes in ms
const BROKER_URL = 'wss://mqtt.cetools.org:8081/mqtt';

interface TopicInfo {
  topic: string;
  lastSeen: number;
  flashUntil: number;
  color: string;
  index: number;
  lastPayload: string;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [connected, setConnected] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TopicInfo | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState({ totalMessages: 0, uniqueTopics: 0 });
  const [featuredTopicPath, setFeaturedTopicPath] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  const statsRef = useRef({ totalMessages: 0, uniqueTopics: 0 });
  const featuredTopicPathRef = useRef<string | null>(null);
  const selectedTopicRef = useRef<TopicInfo | null>(null);
  const topicsRef = useRef<Map<string, TopicInfo>>(new Map());
  const gridRef = useRef<(TopicInfo | null)[]>(new Array(GRID_SIZE * GRID_SIZE).fill(null));
  const nextIndexRef = useRef(0);

  const getBranchColor = (topic: string) => {
    if (topic.startsWith('personal/')) return '#22c55e'; // Green
    if (topic.startsWith('UCL/')) return '#3b82f6'; // Blue
    if (topic.startsWith('student/')) return '#f97316'; // Orange
    if (topic.startsWith('tasmota/')) return '#eab308'; // Yellow
    return '#4b5563'; // Gray (Default)
  };

  useEffect(() => {
    featuredTopicPathRef.current = featuredTopicPath;
  }, [featuredTopicPath]);

  useEffect(() => {
    selectedTopicRef.current = selectedTopic;
  }, [selectedTopic]);

  useEffect(() => {
    const client = mqtt.connect(BROKER_URL);

    client.on('connect', () => {
      setConnected(true);
      client.subscribe('#');
    });

    client.on('message', (topic, payload) => {
      const now = Date.now();
      const payloadStr = payload.toString();
      let topicInfo = topicsRef.current.get(topic);

      if (!topicInfo) {
        if (nextIndexRef.current < GRID_SIZE * GRID_SIZE) {
          const index = nextIndexRef.current++;
          topicInfo = {
            topic,
            lastSeen: now,
            flashUntil: now + FLASH_DURATION,
            color: getBranchColor(topic),
            index,
            lastPayload: payloadStr,
          };
          topicsRef.current.set(topic, topicInfo);
          gridRef.current[index] = topicInfo;
          statsRef.current.uniqueTopics = topicsRef.current.size;
        }
      } else {
        topicInfo.lastSeen = now;
        topicInfo.flashUntil = now + FLASH_DURATION;
        topicInfo.lastPayload = payloadStr;
      }

      // If this is the featured or selected topic, trigger an immediate UI update
      if (topic === featuredTopicPathRef.current || topic === selectedTopicRef.current?.topic) {
        setLastUpdate(now);
      }

      statsRef.current.totalMessages++;
    });

    // Throttle stats updates to 1Hz
    const statsInterval = setInterval(() => {
      setStats({ ...statsRef.current });
    }, 1000);

    client.on('close', () => setConnected(false));
    client.on('error', (err) => console.error('MQTT Error:', err));

    return () => {
      client.end();
      clearInterval(statsInterval);
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = Date.now();
    const pixelSize = canvas.width / GRID_SIZE;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    topicsRef.current.forEach((info) => {
      const x = (info.index % GRID_SIZE) * pixelSize;
      const y = Math.floor(info.index / GRID_SIZE) * pixelSize;

      let color = info.color;

      if (now < info.flashUntil) {
        color = '#ffffff'; // Flash White
      } else if (now - info.lastSeen > TIMEOUT_DURATION) {
        color = '#ef4444'; // Timeout Red
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, y, pixelSize - 0.2, pixelSize - 0.2);

      // Highlight selected topic
      if (selectedTopic && info.index === selectedTopic.index) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, y - 1, pixelSize + 1.8, pixelSize + 1.8);
      }
    });

    requestAnimationFrame(draw);
  }, [selectedTopic]);

  useEffect(() => {
    const animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [draw]);

  // Cycle featured topic every minute
  useEffect(() => {
    const cycle = () => {
      const allPaths = Array.from(topicsRef.current.keys());
      if (allPaths.length > 0) {
        const randomPath = allPaths[Math.floor(Math.random() * allPaths.length)];
        setFeaturedTopicPath(randomPath);
      }
    };

    const interval = setInterval(cycle, 60000);
    return () => clearInterval(interval);
  }, []);

  // Ensure we have a featured topic as soon as data arrives
  useEffect(() => {
    if (!featuredTopicPath && stats.uniqueTopics > 0) {
      const allPaths = Array.from(topicsRef.current.keys());
      if (allPaths.length > 0) {
        setFeaturedTopicPath(allPaths[0]);
      }
    }
  }, [stats.uniqueTopics, featuredTopicPath]);

  const featuredTopic = featuredTopicPath ? topicsRef.current.get(featuredTopicPath) : null;

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cssPixelSize = rect.width / GRID_SIZE;
    const gridX = Math.floor(x / cssPixelSize);
    const gridY = Math.floor(y / cssPixelSize);
    
    if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
      const index = gridY * GRID_SIZE + gridX;
      const found = gridRef.current[index];
      setSelectedTopic(found || null);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {connected ? <Wifi size={24} /> : <WifiOff size={24} />}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">MQTT Visualiser</h1>
            <p className="text-xs text-white/40 font-mono uppercase tracking-widest">mqtt.cetools.org</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex gap-6">
            <Stat label="Topics" value={stats.uniqueTopics.toLocaleString()} />
            <Stat label="Messages" value={stats.totalMessages.toLocaleString()} />
          </div>
          <button 
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Main Canvas Area */}
        <div className="relative aspect-square bg-black rounded-2xl border border-white/10 shadow-2xl group overflow-hidden">
          <canvas
            ref={canvasRef}
            width={1024}
            height={1024}
            onClick={handleCanvasClick}
            className="w-full h-full cursor-pointer"
          />
          <div className="absolute bottom-4 left-4 pointer-events-none bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] text-white/60 font-mono uppercase tracking-widest">
            Click a pixel to inspect
          </div>
        </div>

        {/* Sidebar Controls/Info */}
        <aside className="space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] pr-2 custom-scrollbar">
          {/* Featured Feed Section */}
          <section className="p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-20">
              <Activity size={40} className="text-blue-400" />
            </div>
            <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity size={14} /> Featured Feed
            </h2>
            <AnimatePresence mode="wait">
              {featuredTopic ? (
                <motion.div
                  key={featuredTopic.topic}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: featuredTopic.color }} />
                    <span className="text-[10px] font-mono text-white/40 truncate max-w-[200px]">{featuredTopic.topic}</span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                    <p className="text-sm font-mono text-blue-100 break-all leading-relaxed">
                      {featuredTopic.lastPayload || 'No data...'}
                    </p>
                  </div>
                  <p className="text-[9px] text-white/20 font-mono uppercase tracking-widest">Updates every 60s</p>
                </motion.div>
              ) : (
                <p className="text-sm text-white/30 italic">Waiting for data...</p>
              )}
            </AnimatePresence>
          </section>

          {/* Selected Topic Section */}
          <AnimatePresence mode="wait">
            {selectedTopic && (
              <motion.section
                key="selected-topic"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 bg-zinc-900 rounded-2xl border border-white/20 shadow-xl relative"
              >
                <button 
                  onClick={() => setSelectedTopic(null)}
                  className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors"
                >
                  ✕
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.4)]" style={{ backgroundColor: selectedTopic.color }} />
                  <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">Inspecting Topic</h2>
                </div>
                
                <p className="text-sm font-mono break-all leading-tight text-white font-medium mb-4">
                  {selectedTopic.topic}
                </p>
                
                <div className="space-y-4">
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                    <span className="text-[9px] font-mono text-white/30 uppercase block mb-2 tracking-widest">Payload Data</span>
                    <p className="text-xs font-mono text-blue-300 break-all leading-relaxed">
                      {selectedTopic.lastPayload || 'No data'}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <span className="text-[9px] font-mono text-white/30 uppercase block mb-1">Last Seen</span>
                      <p className="text-[10px] font-mono text-white/80">{new Date(selectedTopic.lastSeen).toLocaleTimeString()}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <span className="text-[9px] font-mono text-white/30 uppercase block mb-1">Status</span>
                      <p className={`text-[10px] font-mono font-bold ${Date.now() - selectedTopic.lastSeen > TIMEOUT_DURATION ? 'text-red-400' : 'text-green-400'}`}>
                        {Date.now() - selectedTopic.lastSeen > TIMEOUT_DURATION ? 'OFFLINE' : 'ACTIVE'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <section className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Info size={14} /> Legend
            </h2>
            <div className="space-y-3">
              <LegendItem color="#22c55e" label="personal/#" />
              <LegendItem color="#3b82f6" label="UCL/#" />
              <LegendItem color="#f97316" label="student/#" />
              <LegendItem color="#eab308" label="tasmota/#" />
              <LegendItem color="#4b5563" label="Other Topics" />
              <LegendItem color="#ffffff" label="Active Flash" />
              <LegendItem color="#ef4444" label="Inactive (61m+)" />
            </div>
          </section>

          <section className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity size={14} /> System Info
            </h2>
            <div className="space-y-4 text-sm text-white/70 leading-relaxed">
              <p>Tracking up to {GRID_SIZE * GRID_SIZE} unique topics on a {GRID_SIZE}x{GRID_SIZE} grid.</p>
              <p>Each pixel represents a unique MQTT topic observed on the broker.</p>
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-white/40 italic">"The grid is a living map of the university's digital pulse."</p>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] text-white/30 uppercase tracking-widest font-mono">{label}</span>
      <span className="text-lg font-mono font-medium">{value}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-sm text-white/70 font-mono">{label}</span>
    </div>
  );
}
