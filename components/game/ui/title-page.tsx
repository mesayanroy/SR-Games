"use client"

import { useEffect } from "react"
import { useGameState } from "@/lib/game-state-context"

export default function TitlePage() {
  const { hasStarted, setGameStatus } = useGameState()

  // Update the handlePlayButtonClick function to go directly to playing state if already started
  const handlePlayButtonClick = () => {
    if (hasStarted) {
      console.log("Resume button clicked, setting game status directly to playing")
      setGameStatus("playing")
    } else {
      console.log("Play button clicked, setting game status to sleeping")
      setGameStatus("sleeping")
    }
  }

  // Handle ESC key to resume game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape" && hasStarted) {
        console.log("ESC pressed on title screen, going to paused state")
        setGameStatus("sleeping")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasStarted, setGameStatus])

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 z-50 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {/* Floating Particles */}
        <div className="absolute top-10 left-10 w-2 h-2 bg-white/20 rounded-full animate-pulse"></div>
        <div className="absolute top-32 right-20 w-1 h-1 bg-blue-300/30 rounded-full animate-bounce"></div>
        <div className="absolute bottom-20 left-32 w-3 h-3 bg-purple-300/20 rounded-full animate-ping"></div>
        <div className="absolute top-1/2 right-10 w-2 h-2 bg-indigo-300/25 rounded-full animate-pulse"></div>
        <div className="absolute bottom-32 right-1/3 w-1 h-1 bg-white/30 rounded-full animate-bounce"></div>

        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="max-w-2xl w-full px-4 relative z-10">
        {/* Animated Title */}
        <div className="text-center mb-12">
          <h1 className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 mb-4 animate-pulse">
            SR Games
          </h1>
          <div className="h-1 w-32 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full animate-pulse"></div>
        </div>

        {/* Glass Morphism Container */}
        <div className="backdrop-blur-lg bg-white/10 rounded-2xl border border-white/20 p-8 shadow-2xl">
          <div className="space-y-4 max-w-md mx-auto">
            <button
              onClick={handlePlayButtonClick}
              className="group w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative z-10">{hasStarted ? "🎮 Resume Game" : "🚀 Start Game"}</span>
            </button>

            <button
              onClick={() => setGameStatus("settings")}
              className="group w-full py-4 px-6 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 border border-white/20 hover:border-white/40"
            >
              <span className="flex items-center justify-center gap-2">⚙️ Settings</span>
            </button>

            <button
              onClick={() => setGameStatus("howToPlay")}
              className="group w-full py-4 px-6 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 border border-white/20 hover:border-white/40"
            >
              <span className="flex items-center justify-center gap-2">📖 How to Play</span>
            </button>
          </div>

          {hasStarted && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-400/30 rounded-full text-green-300 text-sm animate-pulse">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                Press ESC to resume game
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 text-white/60 text-sm">
            <span>© 2025 SR Games</span>
            <div className="w-1 h-1 bg-white/40 rounded-full"></div>
            <span>All rights reserved</span>
          </div>
        </div>
      </div>

      {/* Animated Border Effect */}
      <div className="absolute inset-0 border-4 border-transparent bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-indigo-500/20 rounded-lg animate-pulse pointer-events-none"></div>
    </div>
  )
}
