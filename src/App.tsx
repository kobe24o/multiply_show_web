import { useState } from "react";
import { MultiplicationAnimation } from "./components/MultiplicationAnimation";
import { Play, Pause, RotateCcw, Shuffle } from "lucide-react";

export default function App() {
  const [num1, setNum1] = useState("23");
  const [num2, setNum2] = useState("45");
  const [isPlaying, setIsPlaying] = useState(false);
  const [key, setKey] = useState(0);
  const [speed, setSpeed] = useState(1); // 1x速度

  const handleRandom = () => {
    const random1 = Math.floor(Math.random() * 90 + 10);
    const random2 = Math.floor(Math.random() * 90 + 10);
    setNum1(String(random1));
    setNum2(String(random2));
    setIsPlaying(false);
    setKey((prev) => prev + 1);
  };

  const handleStart = () => {
    setIsPlaying(true);
    setKey((prev) => prev + 1);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setKey((prev) => prev + 1);
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-center text-indigo-900 mb-8">
          乘法竖式计算演示
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end justify-center">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-gray-700 mb-2">
                被乘数
              </label>
              <input
                type="number"
                value={num1}
                onChange={(e) => setNum1(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="输入数字"
              />
            </div>

            <div className="flex-1 min-w-[120px]">
              <label className="block text-gray-700 mb-2">
                乘数
              </label>
              <input
                type="number"
                value={num2}
                onChange={(e) => setNum2(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="输入数字"
              />
            </div>

            <button
              onClick={handleRandom}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
            >
              <Shuffle className="w-5 h-5" />
              随机
            </button>

            <button
              onClick={handleStart}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              开始演示
            </button>
          </div>

          {/* 速度控制 */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <label className="text-gray-700">播放速度:</label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-48"
            />
            <span className="text-gray-700 min-w-[60px]">{speed}x</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={togglePlayPause}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
              disabled={!num1 || !num2}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-5 h-5" />
                  暂停
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  播放
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              重置
            </button>
          </div>

          {num1 && num2 && (
            <MultiplicationAnimation
              key={key}
              num1={parseInt(num1) || 0}
              num2={parseInt(num2) || 0}
              isPlaying={isPlaying}
              speed={speed}
            />
          )}
        </div>
      </div>
    </div>
  );
}