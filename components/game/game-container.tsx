"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { Stats } from "@react-three/drei"
import GameScene from "./game-scene"
import LoadingScreen from "./ui/loading-screen"
import TitlePage from "./ui/title-page"
import WakeUpScreen from "./ui/wake-up-screen"
import SettingsPage from "./ui/settings-page"
import HowToPlay from "./ui/how-to-play"
import HUD from "./hud/hud"
import CampfireInventory from "./ui/campfire-inventory"
import NotificationContainer from "./ui/notification-container"
import DebugPanel from "./ui/debug-panel"
import FPSCounter from "./ui/fps-counter"
import SoundManager from "@/lib/sound-manager"
import AudioGenerator from "./audio/audio-generator"
import { GameProvider } from "@/lib/game-context"
import { SettingsProvider, useSettings } from "@/lib/settings-context"
import { GameStateProvider, useGameState } from "@/lib/game-state-context"
import { ToolbarProvider } from "@/lib/toolbar-context"
import { InventoryProvider, useInventory } from "@/lib/inventory-context"
import { CraftingProvider } from "@/lib/crafting-context"
import { PlayerStatusProvider, usePlayerStatus } from "@/lib/player-status-context"
import { NotificationProvider } from "@/lib/notification-context"
import { CampfireProvider, useCampfire } from "@/lib/campfire-context"
import { useNotifications } from "@/lib/notification-context"
import { StorageBoxProvider } from "@/lib/storage-box-context"
import StorageBoxInventory from "./ui/storage-box-inventory"
import { InteractionProvider } from "@/lib/interaction-context"
import { ItemManagerProvider } from "@/lib/item-manager-context"

// Initialize sound manager early - but only in browser
const soundManager = typeof window !== "undefined" ? SoundManager.getInstance() : null
if (typeof window !== "undefined" && soundManager) {
  soundManager.init()
  soundManager.warmup()
}

function GameContainerInner() {
  const [isLoading, setIsLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [terrainReady, setTerrainReady] = useState(false)
  const [weaponAmmo, setWeaponAmmo] = useState({ current: 30, reserve: 90 })
  const [pointerLockSupported, setPointerLockSupported] = useState(true)
  const [pointerLockError, setPointerLockError] = useState<any>(null)
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const [showCampfirePrompt, setShowCampfirePrompt] = useState(false)
  const [activeCampfire, setActiveCampfire] = useState<string | null>(null)
  const [placedCampfires, setPlacedCampfires] = useState<
    Array<{
      id: string
      position: [number, number, number]
      isActive?: boolean
    }>
  >([])

  const [showStorageBoxPrompt, setShowStorageBoxPrompt] = useState(false)
  const [activeStorageBox, setActiveStorageBox] = useState<string | null>(null)
  const [placedStorageBoxes, setPlacedStorageBoxes] = useState<
    Array<{
      id: string
      position: [number, number, number]
      normal?: [number, number, number]
    }>
  >([])

  // Track if we're intentionally returning to the title screen
  const intentionalTitleReturn = useRef(false)
  // Canvas reference
  const canvasRef = useRef<HTMLDivElement>(null)
  // ESC key cooldown
  const escKeyCooldown = useRef(false)
  const ESC_COOLDOWN_MS = 500 // Reduced cooldown for better responsiveness

  // Track when the player entered the game
  const gameEntryTime = useRef(0)
  // Cooldown period for returning to title (5 seconds)
  const TITLE_RETURN_COOLDOWN_MS = 5000

  const { settings } = useSettings()
  const { gameStatus, setGameStatus, hasStarted, setHasStarted } = useGameState()
  const {
    isTogglingInventory,
    isOpen: isInventoryOpen,
    setIsOpen: toggleInventory,
    openInventoryForInteraction,
    closeInventory,
    closedByTab,
    activeCampfire: inventoryActiveCampfire,
    setActiveCampfire: setInventoryActiveCampfire,
    activeStorageBox: inventoryActiveStorageBox,
    setActiveStorageBox: setInventoryActiveStorageBox,
  } = useInventory()
  const { getCampfire } = useCampfire()
  const { notifications } = useNotifications()
  const { health, hydration, hunger, updateStatus } = usePlayerStatus()

  // Sync campfire state with context
  useEffect(() => {
    // Update the isActive state of placed campfires based on the campfire context
    setPlacedCampfires((prev) => {
      const updated = prev.map((campfire) => {
        const campfireData = getCampfire(campfire.id)
        if (campfireData) {
          return {
            ...campfire,
            isActive: campfireData.isActive,
          }
        }
        return campfire
      })
      return updated
    })
  }, [getCampfire])

  // Sync activeCampfire state between inventory context and game container
  useEffect(() => {
    setActiveCampfire(inventoryActiveCampfire)
  }, [inventoryActiveCampfire])

  // Sync activeStorageBox state between inventory context and game container
  useEffect(() => {
    console.log("Syncing activeStorageBox from inventory context:", inventoryActiveStorageBox)
    setActiveStorageBox(inventoryActiveStorageBox)
  }, [inventoryActiveStorageBox])

  // Store canvas element reference once it's available
  useEffect(() => {
    const findCanvas = () => {
      const canvas = document.querySelector("canvas")
      if (canvas) {
        setCanvasElement(canvas)
        console.log("Canvas element found and stored")
      } else {
        // Try again in a moment if canvas isn't available yet
        setTimeout(findCanvas, 100)
      }
    }

    if (typeof document !== "undefined") {
      findCanvas()
    }
  }, [])

  // Check if Pointer Lock API is supported
  useEffect(() => {
    if (typeof document !== "undefined") {
      setPointerLockSupported(
        "pointerLockElement" in document ||
          "mozPointerLockElement" in document ||
          "webkitPointerLockElement" in document,
      )
    }
  }, [])

  // Initialize sound manager
  useEffect(() => {
    soundManager?.setVolume(settings.audio.masterVolume, settings.audio.sfxVolume)
  }, [settings.audio.masterVolume, settings.audio.sfxVolume, soundManager])

  // Handle pointer lock errors
  const handlePointerLockError = (error: any) => {
    console.error("Pointer lock error in container:", error)
    setPointerLockError(error)
    // No user-facing error notification
  }

  // Function to safely request pointer lock
  const requestPointerLock = () => {
    // Don't request pointer lock if inventory is open
    if (isInventoryOpen) {
      console.log("Inventory is open, not requesting pointer lock")
      return
    }

    // Only request pointer lock if in playing mode
    if (gameStatus !== "playing") {
      console.log("Not requesting pointer lock - not in playing mode")
      return
    }

    // Check if pointer lock is supported
    if (!pointerLockSupported) {
      console.warn("Pointer lock not supported in this browser")
      return
    }

    // Get the canvas element
    const canvas = canvasElement || document.querySelector("canvas")
    if (!canvas) {
      console.error("Canvas element not found")
      return
    }

    // Check if we already have pointer lock
    if (document.pointerLockElement === canvas) {
      console.log("Pointer is already locked")
      return
    }

    try {
      // Try to request pointer lock with proper error handling
      if (canvas.requestPointerLock) {
        // Modern browsers - use Promise-based approach if available
        if (typeof canvas.requestPointerLock().then === "function") {
          canvas
            .requestPointerLock()
            .then(() => {
              console.log("Pointer lock successfully acquired")
              setIsLocked(true)
            })
            .catch((error) => {
              console.warn("Error requesting pointer lock:", error)
              handlePointerLockError(error)
              // Don't automatically go to sleeping state as fallback
              console.log("Not automatically going to sleeping state on pointer lock error")
            })
        } else {
          // Fallback for browsers without Promise support
          canvas.requestPointerLock()
        }
      } else if ((canvas as any).mozRequestPointerLock) {
        // Firefox fallback
        ;(canvas as any).mozRequestPointerLock()
      } else if ((canvas as any).webkitRequestPointerLock) {
        // Webkit fallback
        ;(canvas as any).webkitRequestPointerLock()
      }
    } catch (error) {
      console.error("Exception requesting pointer lock:", error)
      handlePointerLockError(error)
      // Go to sleeping state as fallback
      setGameStatus("sleeping")
    }
  }

  // Function to exit pointer lock
  const exitPointerLock = () => {
    if (document.exitPointerLock) {
      try {
        document.exitPointerLock()
      } catch (error) {
        console.error("Error exiting pointer lock:", error)
      }
    }
  }

  // Monitor inventory state changes to handle Tab closing
  useEffect(() => {
    if (!isInventoryOpen && closedByTab) {
      console.log("Inventory was closed by Tab, ensuring game state is playing")
      // Make sure we're in playing state when inventory is closed by Tab
      if (gameStatus !== "playing") {
        setGameStatus("playing")
      }

      // Request pointer lock after a short delay
      setTimeout(() => {
        requestPointerLock()
      }, 50)
    }
  }, [isInventoryOpen, closedByTab, gameStatus, setGameStatus])

  // Handle ESC key press based on current game status
  const handleEscKey = () => {
    // Check if we're in cooldown period
    if (escKeyCooldown.current) {
      return
    }

    // If inventory is open or campfire dialog is open, close them and go to sleep screen
    if (isInventoryOpen || activeCampfire || activeStorageBox) {
      console.log("ESC pressed while inventory/campfire is open, closing and going to sleep screen")

      // Close campfire dialog if open
      if (activeCampfire || activeStorageBox) {
        setInventoryActiveCampfire(null)
        setInventoryActiveStorageBox(null)
      }

      // Close inventory
      closeInventory()

      // Short delay to ensure everything is closed first
      setTimeout(() => {
        setGameStatus("sleeping")
        exitPointerLock()
        setIsLocked(false)
      }, 50)

      return
    }

    console.log("ESC pressed, current game status:", gameStatus)

    // Set cooldown flag to prevent rapid presses
    escKeyCooldown.current = true

    // Schedule cooldown reset
    setTimeout(() => {
      escKeyCooldown.current = false
    }, ESC_COOLDOWN_MS)

    // When in playing mode, check if enough time has passed to go to title
    if (gameStatus === "playing") {
      const currentTime = Date.now()
      const timeInGame = currentTime - gameEntryTime.current

      // If less than 5 seconds have passed, go to paused state instead
      if (timeInGame < TITLE_RETURN_COOLDOWN_MS) {
        console.log(`Only ${timeInGame}ms in game, going to paused state instead of title`)
        setGameStatus("sleeping")
        exitPointerLock()
        setIsLocked(false)
      } else {
        // More than 5 seconds have passed, can go to title
        intentionalTitleReturn.current = true
        console.log("ESC pressed during gameplay, going directly to title")
        setGameStatus("title")
        exitPointerLock()
        setIsLocked(false)

        // Reset the flag after a short delay
        setTimeout(() => {
          intentionalTitleReturn.current = false
        }, 500)
      }
    }
    // If on title screen and game has started, go to playing state directly
    else if (gameStatus === "title" && hasStarted) {
      console.log("ESC pressed on title screen, going to playing state")
      setGameStatus("playing")

      // Record the time when entering the game
      gameEntryTime.current = Date.now()

      // Request pointer lock after a short delay
      setTimeout(() => {
        requestPointerLock()
      }, 100)
    }
    // If in sleeping/paused state, go to title
    else if (gameStatus === "sleeping") {
      intentionalTitleReturn.current = true
      console.log("ESC pressed in sleeping state, going to title")

      // Ensure inventory is closed when going to title
      if (isInventoryOpen) {
        closeInventory()
      }

      setGameStatus("title")
      exitPointerLock()
      setIsLocked(false)

      // Reset the flag after a short delay
      setTimeout(() => {
        intentionalTitleReturn.current = false
      }, 500)
    }
  }

  // Simulate loading and initialize audio
  useEffect(() => {
    // Simulate asset loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

    // Add debug toggle and ESC key handler
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Backquote") {
        // ` key
        setShowDebug((prev) => !prev)
      } else if (e.code === "Escape") {
        // ESC key - handle in separate function
        handleEscKey()
      }
    }

    window.addEventListener("keydown", handleKeyPress)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("keydown", handleKeyPress)
    }
  }, [gameStatus, hasStarted, isInventoryOpen])

  // Track when we transition between game states
  useEffect(() => {
    console.log("Game status changed to:", gameStatus)

    // If we're transitioning to sleeping or playing and terrain is ready, setHasStarted
    if ((gameStatus === "sleeping" || gameStatus === "playing") && terrainReady && !hasStarted) {
      setHasStarted(true)
    }

    // Handle transitions specifically to playing state
    if (gameStatus === "playing") {
      console.log("Transitioning to playing state")

      // Record the time when entering the game
      gameEntryTime.current = Date.now()

      // Automatically request pointer lock when transitioning to playing state
      setTimeout(() => {
        if (gameStatus === "playing" && !isInventoryOpen) {
          requestPointerLock()
        }
      }, 100)
    }

    // Make sure pointer lock is released when entering sleeping state
    if (gameStatus === "sleeping") {
      console.log("Transitioning to sleeping state, releasing pointer lock")
      exitPointerLock()
    }

    // Make sure inventory is closed when going to title
    if (gameStatus === "title" && isInventoryOpen) {
      console.log("Going to title screen, closing inventory")
      closeInventory()
    }
  }, [gameStatus, setGameStatus, isTogglingInventory, pointerLockSupported, isInventoryOpen, closedByTab])

  // Handle pointer lock changes
  useEffect(() => {
    const handleLockChange = () => {
      const isCurrentlyLocked = document.pointerLockElement !== null
      console.log("Pointer lock changed:", isCurrentlyLocked ? "locked" : "unlocked")

      setIsLocked(isCurrentlyLocked)

      // If pointer lock was exited unexpectedly during gameplay
      if (
        !isCurrentlyLocked &&
        gameStatus === "playing" &&
        !intentionalTitleReturn.current &&
        !isTogglingInventory &&
        !isInventoryOpen &&
        !closedByTab // Don't pause if inventory was just closed by Tab
      ) {
        console.log("Pointer lock exited unexpectedly, pausing game")
        setGameStatus("sleeping")
      }
    }

    // Add pointer lock error handler
    const handlePointerLockError = (event: Event) => {
      console.error("Pointer lock error event:", event)
      setPointerLockError(event)
    }

    if (pointerLockSupported) {
      document.addEventListener("pointerlockchange", handleLockChange)
      document.addEventListener("mozpointerlockchange", handleLockChange)
      document.addEventListener("webkitpointerlockchange", handleLockChange)

      document.addEventListener("pointerlockerror", handlePointerLockError)
      document.addEventListener("mozpointerlockerror", handlePointerLockError)
      document.addEventListener("webkitpointerlockerror", handlePointerLockError)
    }

    return () => {
      if (pointerLockSupported) {
        document.removeEventListener("pointerlockchange", handleLockChange)
        document.removeEventListener("mozpointerlockchange", handleLockChange)
        document.removeEventListener("webkitpointerlockchange", handleLockChange)

        document.removeEventListener("pointerlockerror", handlePointerLockError)
        document.removeEventListener("mozpointerlockerror", handlePointerLockError)
        document.removeEventListener("webkitpointerlockerror", handlePointerLockError)
      }
    }
  }, [gameStatus, setGameStatus, isTogglingInventory, pointerLockSupported, isInventoryOpen, closedByTab])

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Prevent the click from bubbling up
    e.stopPropagation()

    // Don't request pointer lock if inventory is open or in sleeping state
    if (isInventoryOpen || gameStatus === "sleeping") {
      console.log("Inventory is open or game is paused, not requesting pointer lock")
      return
    }

    // Only request pointer lock if in playing mode
    if (gameStatus === "playing" && !isLocked) {
      console.log("Canvas clicked in playing mode, requesting pointer lock")

      // Make sure this is a direct user interaction
      setTimeout(() => {
        requestPointerLock()
      }, 10)
    }
  }

  // Prevent scrolling when mouse wheel is used in game
  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (gameStatus === "playing" && isLocked) {
      e.preventDefault()
    }
  }

  // Function to handle terrain ready state
  const handleTerrainReady = (ready: boolean) => {
    setTerrainReady(ready)
  }

  // Handle debug commands
  const handleCommand = (command: string) => {
    switch (command) {
      case "fps_toggle":
        console.log(`FPS counter ${settings.gameplay.showFps ? "disabled" : "enabled"}`)
        break
      case "help":
        console.log("Available commands:")
        console.log("fps_toggle - Toggle FPS counter")
        console.log("help - Show available commands")
        break
      default:
        console.log(`Unknown command: ${command}`)
    }
  }

  // Handle wake up from sleep
  const handleWakeUp = () => {
    console.log("Waking up from sleep")

    // Ensure inventory is closed when waking up
    if (isInventoryOpen) {
      console.log("Closing inventory before waking up")
      closeInventory()
    }

    setGameStatus("playing")

    // Record the time when entering the game
    gameEntryTime.current = Date.now()

    // Request pointer lock after a short delay to ensure DOM updates first
    setTimeout(() => {
      console.log("Requesting pointer lock after wake up")
      requestPointerLock()
    }, 100)
  }

  // Handle campfire prompt change
  const handleCampfirePromptChange = (showPrompt: boolean) => {
    setShowCampfirePrompt(showPrompt)
  }

  const handleCampfireInteraction = (campfireId: string | null) => {
    if (campfireId) {
      // Open inventory via interaction and set active campfire
      openInventoryForInteraction("campfire")
      setInventoryActiveCampfire(campfireId)
      setInventoryActiveStorageBox(null)
    } else {
      setInventoryActiveCampfire(null)
    }
  }

  const handleCloseCampfireInventory = () => {
    console.log("Closing campfire inventory")
    setInventoryActiveCampfire(null)
    closeInventory()
  }

  const handleCampfireIgnite = (campfireId: string) => {
    console.log(`Igniting campfire ${campfireId}`)

    // Update the campfire's active state in the placedCampfires array
    setPlacedCampfires((prev) => {
      const updatedCampfires = prev.map((c) => {
        if (c.id === campfireId) {
          console.log(`Setting campfire ${campfireId} to active`)
          return { ...c, isActive: true }
        }
        return c
      })

      console.log("Updated campfires:", updatedCampfires)
      return updatedCampfires
    })
  }

  const handleStorageBoxPromptChange = (showPrompt: boolean) => {
    setShowStorageBoxPrompt(showPrompt)
  }

  const handleStorageBoxInteraction = (storageBoxId: string | null) => {
    console.log("handleStorageBoxInteraction called with:", storageBoxId)
    if (storageBoxId) {
      console.log("Opening storage box interaction for:", storageBoxId)
      openInventoryForInteraction("storage")
      setInventoryActiveCampfire(null)
      setInventoryActiveStorageBox(storageBoxId)
      console.log("Set activeStorageBox to:", storageBoxId)
    } else {
      setInventoryActiveStorageBox(null)
    }
  }

  const handleCloseStorageBoxInventory = () => {
    console.log("Closing storage box inventory")
    setInventoryActiveStorageBox(null)
    closeInventory()
  }

  // Render appropriate content based on game status
  const renderContent = () => {
    if (isLoading) {
      return <LoadingScreen />
    }

    // Render game canvas if playing or sleeping
    if (gameStatus === "playing" || gameStatus === "sleeping") {
      return (
        <>
          <div ref={canvasRef} className="w-full h-full" onClick={handleCanvasClick} onWheel={handleCanvasWheel}>
            <Canvas
              shadows={settings.graphics.enableShadows}
              camera={{ fov: settings.gameplay.fov, near: 0.1, far: 1000 }}
              gl={{
                antialias: settings.graphics.quality !== "low",
                powerPreference: "high-performance",
                alpha: false,
                stencil: false,
                depth: true,
                logarithmicDepthBuffer: false,
              }}
              performance={{ min: 0.5 }}
              dpr={settings.graphics.quality === "low" ? 0.8 : settings.graphics.quality === "medium" ? 1 : 1.5}
            >
              <GameScene
                isLocked={isLocked && gameStatus === "playing" && !isInventoryOpen} // Only pass isLocked as true if in playing state and inventory closed
                setIsLocked={setIsLocked}
                onTerrainReady={handleTerrainReady}
                maxRenderDistance={settings.graphics.maxRenderDistance}
                fogDensity={settings.graphics.fogDensity}
                onAmmoChange={setWeaponAmmo}
                onPointerLockError={handlePointerLockError}
                onCampfirePromptChange={handleCampfirePromptChange}
                onCampfireInteraction={handleCampfireInteraction}
                activeCampfire={activeCampfire}
                placedCampfires={placedCampfires}
                setPlacedCampfires={setPlacedCampfires}
                onStorageBoxPromptChange={handleStorageBoxPromptChange}
                onStorageBoxInteraction={handleStorageBoxInteraction}
                activeStorageBox={activeStorageBox}
                placedStorageBoxes={placedStorageBoxes}
                setPlacedStorageBoxes={setPlacedStorageBoxes}
              />
              {showDebug && <Stats />}
            </Canvas>
          </div>

          {/* Show wake up screen if in sleeping state */}
          {gameStatus === "sleeping" && <WakeUpScreen onWakeUp={handleWakeUp} />}

          {/* Only show HUD when playing and not sleeping */}
          {gameStatus === "playing" && (
            <HUD
              isLocked={isLocked}
              terrainReady={terrainReady}
              showCrosshair={settings.gameplay.showCrosshair}
              ammo={weaponAmmo}
              pointerLockSupported={pointerLockSupported}
              pointerLockError={pointerLockError}
              returningFromTitle={false}
              gameStatus={gameStatus}
            />
          )}

          {/* Campfire interaction prompt - hide when actively interacting */}
          {showCampfirePrompt && !activeCampfire && (
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40">
              <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-center">
                <div className="flex items-center gap-2">
                  <kbd className="bg-gray-600 px-2 py-1 rounded text-sm font-mono">E</kbd>
                  <span>Interact with Campfire</span>
                </div>
              </div>
            </div>
          )}

          {activeCampfire && isInventoryOpen && (
            <CampfireInventory
              campfireId={activeCampfire}
              onClose={handleCloseCampfireInventory}
              onIgnite={handleCampfireIgnite}
              isActive={placedCampfires.find((c) => c.id === activeCampfire)?.isActive || false}
            />
          )}

          {/* Storage Box interaction prompt */}
          {showStorageBoxPrompt && !activeStorageBox && (
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40">
              <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-center">
                <div className="flex items-center gap-2">
                  <kbd className="bg-gray-600 px-2 py-1 rounded text-sm font-mono">E</kbd>
                  <span>Open Storage Box</span>
                </div>
              </div>
            </div>
          )}

          {activeStorageBox &&
            isInventoryOpen &&
            (console.log("Rendering StorageBoxInventory with ID:", activeStorageBox) || (
              <StorageBoxInventory storageBoxId={activeStorageBox} onClose={handleCloseStorageBoxInventory} />
            ))}

          {showDebug && <DebugPanel isLocked={isLocked} onCommand={handleCommand} />}
          <FPSCounter visible={settings.gameplay.showFps} />
        </>
      )
    }

    // Render menu pages
    switch (gameStatus) {
      case "title":
        return <TitlePage />
      case "settings":
        return <SettingsPage />
      case "howToPlay":
        return <HowToPlay />
      default:
        return <TitlePage />
    }
  }

  return (
    <div className="relative w-full h-full">
      {/* Audio generator for fallback sounds - render this first */}
      <AudioGenerator />
      {/* Render SoundTest component */}
      {renderContent()}
    </div>
  )
}

export default function GameContainer() {
  return (
    <SettingsProvider>
      <GameStateProvider>
        <GameProvider>
          <PlayerStatusProvider>
            <NotificationProvider>
              <ToolbarProvider>
                <InventoryProvider>
                  <CampfireProvider>
                    <StorageBoxProvider>
                      <CraftingProvider>
                        <ItemManagerProvider>
                          <InteractionProvider>
                            <GameContainerInner />
                            <NotificationContainer />
                          </InteractionProvider>
                        </ItemManagerProvider>
                      </CraftingProvider>
                    </StorageBoxProvider>
                  </CampfireProvider>
                </InventoryProvider>
              </ToolbarProvider>
            </NotificationProvider>
          </PlayerStatusProvider>
        </GameProvider>
      </GameStateProvider>
    </SettingsProvider>
  )
}
