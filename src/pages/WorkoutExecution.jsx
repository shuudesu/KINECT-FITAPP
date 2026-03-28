import React, { useState, useEffect } from 'react';
import { Timer, Heart, Activity, Play, Pause, ChevronRight } from 'lucide-react';

export default function WorkoutExecution() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45); // e.g., 45s effort
  const [currentBlock, setCurrentBlock] = useState(1);
  const [phase, setPhase] = useState('workout'); // 'workout' or 'rest'

  const mockWorkout = [
    { id: 1, name: 'Burpees', duration: 45, rest: 15 },
    { id: 2, name: 'Mountain Climbers', duration: 40, rest: 20 },
    { id: 3, name: 'Jumping Jacks', duration: 30, rest: 15 },
  ];

  const currentExercise = mockWorkout[currentBlock - 1];
  const nextExercise = mockWorkout[currentBlock] || null;

  useEffect(() => {
    let interval = null;
    if (isPlaying && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isPlaying && timeLeft === 0) {
      // Switch phase or advance block
      if (phase === 'workout') {
        setPhase('rest');
        setTimeLeft(currentExercise.rest);
      } else {
        if (currentBlock < mockWorkout.length) {
          setCurrentBlock(currentBlock + 1);
          setPhase('workout');
          setTimeLeft(mockWorkout[currentBlock].duration);
        } else {
          setIsPlaying(false);
          // End of workout logic could go here
        }
      }
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeLeft, phase, currentBlock]);

  const toggleTimer = () => setIsPlaying(!isPlaying);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = phase === 'workout' 
    ? ((currentExercise.duration - timeLeft) / currentExercise.duration) * 100
    : ((currentExercise.rest - timeLeft) / currentExercise.rest) * 100;

  return (
    <div className="min-h-screen bg-[#0d0714] text-[#fcf4ff] font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* BACKGROUND GLOW */}
      <div 
        className={`absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,theme(colors.purple.900),transparent_70%)] transition-opacity duration-1000 ${
          phase === 'workout' ? 'opacity-40 animate-pulse' : 'opacity-10'
        }`}
      />

      {/* HEADER INFO */}
      <div className="w-full max-w-md flex justify-between items-center mb-12 z-10">
        <div className="flex items-center space-x-2 bg-[#1a0f2e] px-4 py-2 rounded-full border border-[#baa4d3]/10">
          <Heart className="w-5 h-5 text-[#f74b6d] animate-pulse" />
          <span className="font-bold text-lg">168 bpm</span>
        </div>
        <div className="flex items-center space-x-2 bg-[#1a0f2e] px-4 py-2 rounded-full border border-[#baa4d3]/10">
          <Activity className="w-5 h-5 text-[#CCFF00]" />
          <span className="font-bold text-lg">Zona 4</span>
        </div>
      </div>

      {/* MAIN TIMER & FOCUS */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md z-10 relative">
        
        {/* PROGRESS RING */}
        <div className="relative w-72 h-72 flex items-center justify-center mb-8">
          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
            <circle 
              cx="144" cy="144" r="130"
              stroke="#1a0f2e" strokeWidth="8" fill="transparent"
            />
            <circle 
              cx="144" cy="144" r="130"
              stroke={phase === 'workout' ? '#6437db' : '#9c3660'} 
              strokeWidth="12" fill="transparent"
              strokeDasharray={2 * Math.PI * 130}
              strokeDashoffset={2 * Math.PI * 130 * (1 - progress / 100)}
              className="transition-all duration-1000 ease-linear"
              strokeLinecap="round"
            />
          </svg>
          
          <div className="text-center">
            <h2 className="text-[#baa4d3] text-lg font-bold uppercase tracking-widest mb-2">
              {phase === 'workout' ? 'Em Ação' : 'Descanso'}
            </h2>
            <div className="text-7xl font-bold tabular-nums tracking-tighter text-white">
              {formatTime(timeLeft)}
            </div>
            <p className="text-[#826f9a] font-medium mt-2">
              Bloco {currentBlock} de {mockWorkout.length}
            </p>
          </div>
        </div>

        {/* CURRENT EXERCISE */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold break-words bg-clip-text text-transparent bg-gradient-to-r from-white to-[#baa4d3]">
            {phase === 'workout' ? currentExercise.name : 'Recuperação'}
          </h1>
        </div>

        {/* CONTROLS */}
        <button 
          onClick={toggleTimer}
          className={`w-24 h-24 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 ${
            isPlaying 
              ? 'bg-[#1a0f2e] text-[#baa4d3] border border-[#341d5e]'
              : 'bg-gradient-to-tr from-[#6437db] to-[#9c3660] text-white shadow-[0_0_30px_rgba(100,55,219,0.5)]'
          }`}
        >
          {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-2" />}
        </button>

      </div>

      {/* UP NEXT FOOTER */}
      {nextExercise && (
        <div className="w-full max-w-md mt-auto pt-8 border-t border-[#341d5e]/50 z-10 flex items-center justify-between">
          <div>
            <p className="text-[#826f9a] text-sm font-semibold uppercase tracking-wider">A Seguir</p>
            <p className="text-xl font-bold text-[#f2e2ff]">{nextExercise.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[#826f9a] text-sm font-semibold uppercase tracking-wider">{nextExercise.duration}s</p>
            <ChevronRight className="w-6 h-6 text-[#6437db]" />
          </div>
        </div>
      )}

    </div>
  );
}
