import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Flag, Play, RotateCcw, Camera, Keyboard } from 'lucide-react';
import confetti from 'canvas-confetti';

class SoundEngine {
  ctx: AudioContext | null = null;
  gallopInterval: number | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTap() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playBeep(high = false) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 880 : 440, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playWin() {
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + i * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.15);
      osc.stop(this.ctx.currentTime + i * 0.15 + 0.3);
    });
  }

  startGallop() {
    if (!this.ctx) return;
    if (this.gallopInterval) return;
    
    let step = 0;
    const playHoof = (vol: number, pitch: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    };

    this.gallopInterval = window.setInterval(() => {
      step = (step + 1) % 4;
      if (step === 0) playHoof(0.2, 150);
      else if (step === 1) playHoof(0.1, 180);
      else if (step === 2) playHoof(0.15, 160);
      // step 3 is a rest
    }, 120);
  }

  stopGallop() {
    if (this.gallopInterval) {
      clearInterval(this.gallopInterval);
      this.gallopInterval = null;
    }
  }
}

const soundEngine = new SoundEngine();

type GameState = 'setup' | 'ready' | 'racing' | 'finished';

interface Horse {
  id: number;
  name: string;
  colorHex: string;
  imageUrl: string;
  position: number;
  velocity: number;
  isPlayer: boolean;
  burstTimer: number;
}

const COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#eab308', // yellow
  '#a855f7', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
];

const NAMES = [
  'Thunder', 'Lightning', 'Shadow', 'Comet', 
  'Blaze', 'Storm', 'Apollo', 'Spirit'
];

const HORSE_IMAGES = [
  'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1543014870-1f912a78f4a1?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1598974357801-cbca100e65d3?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1534224039826-c7a0c073168a?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1551884831-bbf3cdc6469e?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1528154291023-a6525fabe5b4?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1472653816316-3ad6f10a6592?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1599839619722-39751411ea63?w=150&h=150&fit=crop'
];

const RACE_DISTANCE = 500;

export default function App() {
  const [gameState, setGameState] = useState<GameState>('setup');
  const [numHorses, setNumHorses] = useState(4);
  const [playerName, setPlayerName] = useState('Millie');
  const [playerAvatar, setPlayerAvatar] = useState(HORSE_IMAGES[0]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [winner, setWinner] = useState<Horse | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [lastTap, setLastTap] = useState<'left' | 'right' | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  
  const horsesRef = useRef<Horse[]>([]);
  const gameStateRef = useRef<GameState>('setup');
  const lastTapRef = useRef<'left' | 'right' | null>(null);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  
  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const motionIndicatorRef = useRef<HTMLDivElement>(null);

  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraEnabled(true);
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Could not access camera. Please allow camera permissions or continue using keyboard/touch.");
    }
  };

  const startGame = () => {
    soundEngine.init();
    const newHorses: Horse[] = [];
    const shuffledColors = [...COLORS].sort(() => Math.random() - 0.5);
    const shuffledNames = [...NAMES].sort(() => Math.random() - 0.5);
    const shuffledImages = [...HORSE_IMAGES].filter(img => img !== playerAvatar).sort(() => Math.random() - 0.5);
    
    // Place player in the middle
    const playerIndex = Math.floor(numHorses / 2);
    
    let colorIdx = 0;
    let nameIdx = 0;
    let imgIdx = 0;

    for (let i = 0; i < numHorses; i++) {
      const isPlayer = i === playerIndex;
      newHorses.push({
        id: i,
        name: isPlayer ? (playerName.trim() || 'Player') : shuffledNames[nameIdx++],
        colorHex: isPlayer ? '#f59e0b' : shuffledColors[colorIdx++], // Amber for player
        imageUrl: isPlayer ? playerAvatar : shuffledImages[imgIdx++],
        position: 0,
        velocity: 0,
        isPlayer: isPlayer,
        burstTimer: 0
      });
    }
    
    horsesRef.current = newHorses;
    setHorses(newHorses);
    setWinner(null);
    lastTapRef.current = null;
    setLastTap(null);
    setGameState('ready');
    gameStateRef.current = 'ready';
    prevFrameRef.current = null; // Reset camera motion baseline
  };

  const handleTap = useCallback((side: 'left' | 'right') => {
    if (gameStateRef.current !== 'racing') return;
    
    if (lastTapRef.current !== side) {
      lastTapRef.current = side;
      setLastTap(side);
      soundEngine.playTap();
      
      horsesRef.current = horsesRef.current.map(h => {
        if (h.isPlayer) {
          return { ...h, velocity: h.velocity + 12 }; 
        }
        return h;
      });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleTap('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleTap('right');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  useEffect(() => {
    if (gameState === 'ready') {
      setCountdown(3);
      soundEngine.playBeep(false);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setGameState('racing');
            gameStateRef.current = 'racing';
            soundEngine.playBeep(true);
            soundEngine.startGallop();
            return 0;
          }
          soundEngine.playBeep(false);
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  useEffect(() => {
    const gameLoop = (time: number) => {
      if (gameStateRef.current !== 'racing') return;
      
      if (previousTimeRef.current !== undefined) {
        const deltaTime = (time - previousTimeRef.current) / 1000;
        const dt = Math.min(deltaTime, 0.1);
        
        // Process Camera Motion
        let motionScore = 0;
        if (cameraEnabled && videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              
              if (prevFrameRef.current) {
                let diff = 0;
                // Sample every 4th pixel to speed up processing (16 bytes instead of 4)
                for (let i = 0; i < currentFrame.length; i += 16) {
                  diff += Math.abs(currentFrame[i] - prevFrameRef.current[i]);
                  diff += Math.abs(currentFrame[i+1] - prevFrameRef.current[i+1]);
                  diff += Math.abs(currentFrame[i+2] - prevFrameRef.current[i+2]);
                }
                const maxDiff = (canvas.width * canvas.height / 4) * 3 * 255;
                motionScore = diff / maxDiff;
                
                // Update motion indicator visually without React re-render
                if (motionIndicatorRef.current) {
                  const heightPct = Math.min(100, motionScore * 1000);
                  motionIndicatorRef.current.style.height = `${heightPct}%`;
                  motionIndicatorRef.current.style.backgroundColor = motionScore > 0.008 ? '#f59e0b' : '#f87171'; // Amber when active
                }
              }
              prevFrameRef.current = new Uint8ClampedArray(currentFrame);
            }
          }
        }
        
        let maxPos = 0;
        let currentWinner: Horse | null = null;
        
        horsesRef.current = horsesRef.current.map(h => {
          let newVel = h.velocity;
          let newBurst = h.burstTimer;
          
          if (h.isPlayer) {
            // Add velocity from camera motion (if significant)
            if (motionScore > 0.008) {
              newVel += motionScore * 4000 * dt; 
            }
          } else {
            if (newBurst > 0) {
              newBurst -= dt;
              newVel += 25 * dt;
            } else {
              if (Math.random() < dt * 0.3) {
                newBurst = Math.random() * 1.0 + 0.5;
              }
              if (Math.random() < dt * 10) {
                newVel += Math.random() * 4 + 2;
              }
            }
          }
          
          newVel -= newVel * 2.0 * dt; // Friction
          if (newVel < 0) newVel = 0;
          
          let newPos = h.position + newVel * dt;
          
          if (newPos >= RACE_DISTANCE && newPos > maxPos) {
             maxPos = newPos;
             currentWinner = { ...h, position: newPos, velocity: newVel, burstTimer: newBurst };
          }
          
          return { ...h, velocity: newVel, position: newPos, burstTimer: newBurst };
        });
        
        setHorses([...horsesRef.current]);
        
        if (currentWinner) {
          gameStateRef.current = 'finished';
          setGameState('finished');
          setWinner(currentWinner);
          soundEngine.stopGallop();
          soundEngine.playWin();
          
          // Trigger celebration confetti
          const duration = 3000;
          const end = Date.now() + duration;

          const frame = () => {
            confetti({
              particleCount: 5,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: [currentWinner!.colorHex, '#ffffff', '#fbbf24']
            });
            confetti({
              particleCount: 5,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: [currentWinner!.colorHex, '#ffffff', '#fbbf24']
            });

            if (Date.now() < end) {
              requestAnimationFrame(frame);
            }
          };
          frame();
        }
      }
      
      previousTimeRef.current = time;
      if (gameStateRef.current === 'racing') {
        requestRef.current = requestAnimationFrame(gameLoop);
      }
    };

    if (gameState === 'racing') {
      previousTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      soundEngine.stopGallop();
    };
  }, [gameState, cameraEnabled]);

  return (
    <div className="h-screen w-full flex flex-col font-sans overflow-hidden bg-stone-900 select-none relative">
      
      {/* Hidden canvas for camera processing */}
      <canvas ref={canvasRef} width={64} height={64} className="hidden" />

      {/* Single Camera Video Element */}
      <div className={`absolute z-50 overflow-hidden border-2 border-amber-500 shadow-lg rounded-lg bg-black transition-all duration-500 ${
        cameraEnabled 
          ? gameState === 'setup'
            ? 'top-6 right-6 w-32 h-24' 
            : 'bottom-36 sm:bottom-44 left-1/2 -translate-x-1/2 w-24 h-18'
          : 'hidden'
      }`}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover opacity-80"
          style={{ transform: 'scaleX(-1)' }}
        />
        <div className="absolute bottom-1 left-0 right-0 text-center text-[8px] font-bold text-amber-400 bg-black/50">
          MOTION SENSOR
        </div>
        {/* Motion Level Indicator */}
        <div className="absolute right-0 bottom-0 w-2 h-full bg-stone-800/80">
          <div 
            ref={motionIndicatorRef}
            className="absolute bottom-0 w-full bg-red-400 transition-all duration-75" 
            style={{ height: '0%' }}
          />
        </div>
      </div>

      {/* Setup Screen */}
      {gameState === 'setup' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-stone-900 p-6 overflow-y-auto">
          <div className="flex items-center gap-4 mb-6 mt-8">
            <Flag className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500" />
            <h1 className="text-3xl sm:text-5xl font-black text-white italic tracking-tight text-center uppercase">MILLIE'S HORSE RACE</h1>
            <Flag className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500" />
          </div>
          
          <div className="bg-stone-800 p-6 sm:p-8 rounded-3xl border border-stone-700 w-full max-w-md shadow-xl mb-8">
            
            {/* Player Name Input */}
            <div className="mb-6">
              <label className="block text-amber-200 font-bold mb-2 text-center text-sm uppercase tracking-wider">Your Name</label>
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-stone-900 border-2 border-stone-700 rounded-xl px-4 py-3 text-white text-center font-bold text-xl focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="Enter your name"
                maxLength={12}
              />
            </div>

            {/* Avatar Selection */}
            <div className="mb-6">
              <label className="block text-amber-200 font-bold mb-2 text-center text-sm uppercase tracking-wider">Choose Your Horse</label>
              <div className="flex gap-3 overflow-x-auto pb-4 px-1 snap-x hide-scrollbar">
                {HORSE_IMAGES.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPlayerAvatar(img)}
                    className={`relative shrink-0 w-16 h-16 rounded-full overflow-hidden border-4 transition-all snap-center ${
                      playerAvatar === img 
                        ? 'border-amber-500 scale-110 shadow-lg shadow-amber-500/50 z-10' 
                        : 'border-stone-600 scale-95 opacity-60 hover:opacity-100 hover:scale-100'
                    }`}
                  >
                    <img src={img} alt={`Horse ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-amber-200 font-bold mb-2 text-center text-sm uppercase tracking-wider">Number of Horses</label>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {[2, 3, 4, 5, 6, 7, 8].map(num => (
                  <button
                    key={num}
                    onClick={() => setNumHorses(num)}
                    className={`py-2 rounded-xl font-bold text-lg transition-colors ${
                      numHorses === num 
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' 
                        : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-amber-200 font-bold mb-2 text-center text-sm uppercase tracking-wider">Control Method</label>
              {!cameraEnabled ? (
                <button
                  onClick={enableCamera}
                  className="w-full py-3 bg-stone-700 hover:bg-stone-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-colors border border-stone-600"
                >
                  <Camera className="w-5 h-5" />
                  Enable Camera Motion Control
                </button>
              ) : (
                <div className="w-full py-3 bg-amber-900/40 text-amber-400 rounded-xl font-bold flex items-center justify-center gap-3 border border-amber-800/50">
                  <Camera className="w-5 h-5" />
                  Camera Enabled! Wave to run.
                </div>
              )}
            </div>
            
            <button
              onClick={startGame}
              className="w-full py-5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-2xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-amber-600/30"
            >
              <Play className="w-8 h-8 fill-current" />
              START RACE
            </button>
          </div>
          
          <div className="text-stone-400 text-center max-w-sm pb-8 text-sm">
            <p className="font-bold mb-2 text-stone-300">How to play:</p>
            <p className="mb-2"><Keyboard className="inline w-4 h-4 mr-1"/> <strong>Keyboard/Touch:</strong> Tap LEFT/RIGHT alternately as fast as you can.</p>
            <p><Camera className="inline w-4 h-4 mr-1"/> <strong>Camera:</strong> Enable camera and wave your hands/body to make your horse run!</p>
          </div>
        </div>
      )}

      {/* Ready Overlay */}
      {gameState === 'ready' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div key={countdown} className="text-9xl font-black text-amber-500 italic drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] animate-bounce">
            {countdown > 0 ? countdown : 'GO!'}
          </div>
        </div>
      )}

      {/* Result Overlay */}
      {gameState === 'finished' && winner && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-opacity duration-500">
          <div className="bg-stone-800 p-8 rounded-3xl border border-stone-700 flex flex-col items-center max-w-md w-full shadow-2xl transform transition-all scale-100 duration-500">
            
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-yellow-400 blur-xl opacity-30 rounded-full animate-pulse"></div>
              <img 
                src={winner.imageUrl} 
                alt={winner.name} 
                className="w-32 h-32 rounded-full border-4 relative z-10 object-cover shadow-2xl" 
                style={{ borderColor: winner.colorHex }}
                referrerPolicy="no-referrer" 
              />
              <Trophy className="w-12 h-12 text-yellow-400 absolute -bottom-4 -right-4 z-20 drop-shadow-lg" />
            </div>
            
            <h2 className="text-5xl font-black text-white mb-2 text-center uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-600">
              {winner.isPlayer ? 'YOU WON!' : `${winner.name} WINS!`}
            </h2>
            <p className="text-stone-300 text-xl mb-8 text-center font-medium">
              {winner.isPlayer ? 'Incredible racing!' : 'Better luck next time.'}
            </p>
            
            <button 
              onClick={() => setGameState('setup')}
              className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl font-bold text-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-600/30 hover:scale-105 active:scale-95"
            >
              <RotateCcw className="w-6 h-6" />
              Race Again
            </button>
          </div>
        </div>
      )}

      {/* Track Area (Vertical Layout) */}
      <div className="flex-1 flex flex-row relative bg-[#5c3a21] overflow-hidden shadow-inner">
        {/* Track markings (horizontal lines) */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(255,255,255,0.2) 50px, rgba(255,255,255,0.2) 52px)' }}>
        </div>
        
        {/* Finish Line (Top) */}
        <div className="absolute top-8 left-0 right-0 h-8 flex flex-col z-10 opacity-90 shadow-[0_5px_15px_rgba(0,0,0,0.4)]">
          {Array.from({length: 2}).map((_, row) => (
            <div key={row} className="flex-1 flex">
              {Array.from({length: 20}).map((_, col) => (
                <div key={col} className={`flex-1 ${ (row+col)%2 === 0 ? 'bg-white' : 'bg-black' }`}></div>
              ))}
            </div>
          ))}
        </div>
        
        {/* Track Lanes */}
        <div className="flex-1 flex flex-row px-2 sm:px-8">
          {horses.map((h, i) => (
            <div key={h.id} className="flex-1 min-w-[40px] border-r border-[#3e2723]/60 relative flex flex-col items-center last:border-r-0">
              {/* Lane Number */}
              <div className="absolute bottom-4 text-[#3e2723]/50 font-black text-2xl sm:text-4xl italic">{i + 1}</div>
              
              {/* Horse Container */}
              <div className="absolute bottom-16 top-16 left-0 right-0">
                <div 
                  className="absolute left-1/2 -translate-x-1/2 z-20"
                  style={{ bottom: `${(h.position / RACE_DISTANCE) * 100}%` }}
                >
                  <div className="relative flex flex-col items-center justify-center">
                    
                    {/* Dust */}
                    {h.velocity > 10 && (
                      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex flex-col gap-1 opacity-60">
                        <div className="w-2 h-2 bg-[#d7ccc8]/50 rounded-full animate-ping" style={{ animationDuration: '0.5s' }}></div>
                        <div className="w-1.5 h-1.5 bg-[#d7ccc8]/40 rounded-full animate-ping" style={{ animationDuration: '0.6s', animationDelay: '0.1s' }}></div>
                      </div>
                    )}

                    {/* Realistic Horse Photo */}
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden border-4 shadow-lg transition-transform ${h.isPlayer ? 'scale-110 z-30' : 'z-20'}`}
                         style={{ borderColor: h.colorHex, filter: h.isPlayer ? 'drop-shadow(0 0 10px rgba(245,158,11,0.8))' : 'drop-shadow(2px 4px 4px rgba(0,0,0,0.5))' }}>
                      <img src={h.imageUrl} alt={h.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    
                    <div className="absolute top-full mt-4 text-[9px] sm:text-[10px] font-bold bg-black/80 text-white px-1.5 py-0.5 rounded whitespace-nowrap z-30">
                      {h.name}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Player Controls (Bottom) */}
      <div className="h-32 sm:h-40 bg-stone-900 flex p-3 sm:p-4 gap-3 sm:gap-4 touch-none relative">
        <button 
          className={`flex-1 rounded-2xl transition-all flex flex-col items-center justify-center text-white select-none 
            ${lastTap !== 'left' ? 'bg-amber-700 shadow-[0_8px_0_rgb(146,64,14)] translate-y-0' : 'bg-amber-900 shadow-[0_0px_0_rgb(146,64,14)] translate-y-2 opacity-80'}`}
          onPointerDown={(e) => { e.preventDefault(); handleTap('left'); }}
        >
          <span className="text-3xl sm:text-5xl font-black mb-1 sm:mb-2">LEFT</span>
          <span className="text-amber-200 font-bold text-sm sm:text-base">TAP</span>
        </button>
        <button 
          className={`flex-1 rounded-2xl transition-all flex flex-col items-center justify-center text-white select-none 
            ${lastTap !== 'right' ? 'bg-amber-600 shadow-[0_8px_0_rgb(180,83,9)] translate-y-0' : 'bg-amber-800 shadow-[0_0px_0_rgb(180,83,9)] translate-y-2 opacity-80'}`}
          onPointerDown={(e) => { e.preventDefault(); handleTap('right'); }}
        >
          <span className="text-3xl sm:text-5xl font-black mb-1 sm:mb-2">RIGHT</span>
          <span className="text-amber-200 font-bold text-sm sm:text-base">TAP</span>
        </button>
      </div>
    </div>
  );
}
