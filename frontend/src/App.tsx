import { useCallback, useMemo, useState } from "react";
import { TamaguiProvider, YStack } from "tamagui";
import config from "../tamagui.config";
import { GameCanvas } from "./game/GameCanvas";
import { HomeScreen } from "./ui/screens/HomeScreen";
import { GameOverScreen } from "./ui/screens/GameOverScreen";

type Screen = "home" | "playing" | "gameover";
type GameMode = "solo" | "multi";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [sessionId, setSessionId] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("solo");
  const [playerName, setPlayerName] = useState("Player");
  const [playerColor, setPlayerColor] = useState("#44ccff");
  const [roomId, setRoomId] = useState("default");

  const startSoloGame = () => {
    setGameMode("solo");
    setSessionId((prev) => prev + 1);
    setScreen("playing");
  };

  const startMultiGame = useCallback(
    (config: { playerName: string; playerColor: string; roomId: string }) => {
      setGameMode("multi");
      setPlayerName(config.playerName);
      setPlayerColor(config.playerColor);
      setRoomId(config.roomId);
      setSessionId((prev) => prev + 1);
      setScreen("playing");
    },
    [],
  );

  const backHome = () => {
    setScreen("home");
  };

  const showGameOver = useCallback(() => {
    setScreen("gameover");
  }, []);

  const containerMode = useMemo(() => {
    if (screen === "playing") {
      return { justifyContent: "stretch", alignItems: "stretch" } as const;
    }
    return { justifyContent: "center", alignItems: "center" } as const;
  }, [screen]);

  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <YStack
        width="100vw"
        height="100vh"
        style={{
          ...containerMode,
          overflow: "hidden",
          background:
            "radial-gradient(circle at 18% 20%, #3c2f2a 0, #121015 45%), radial-gradient(circle at 82% 72%, #5a4832 0, rgba(0,0,0,0) 36%), #08070c",
        }}
      >
        {screen === "home" && (
          <HomeScreen onPlaySolo={startSoloGame} onPlayMulti={startMultiGame} />
        )}
        {screen === "playing" && (
          <YStack flex={1} width="100%" height="100%">
            <GameCanvas
              key={`game-${sessionId}`}
              mode={gameMode}
              initialPlayerName={playerName}
              initialPlayerColor={playerColor}
              roomId={roomId}
              onGameOver={showGameOver}
            />
          </YStack>
        )}
        {screen === "gameover" && (
          <GameOverScreen
            onReplay={() => {
              if (gameMode === "multi") {
                startMultiGame({ playerName, playerColor, roomId });
                return;
              }
              startSoloGame();
            }}
            onBackHome={backHome}
          />
        )}
      </YStack>
    </TamaguiProvider>
  );
}
