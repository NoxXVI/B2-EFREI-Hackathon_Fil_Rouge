import { TamaguiProvider, YStack } from "tamagui";
import config from "../tamagui.config";
import { GameCanvas } from "./game/GameCanvas";

export default function App() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <YStack
        width="100vw"
        height="100vh"
        justifyContent="center"
        alignItems="center"
        backgroundColor="$background"
      >
        <GameCanvas />
      </YStack>
    </TamaguiProvider>
  );
}
