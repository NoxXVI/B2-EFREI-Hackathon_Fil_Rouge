import { GameCanvas } from "./game/GameCanvas";

export default function App() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
        overflow: "hidden",
      }}
    >
      <GameCanvas />
    </div>
  );
}
