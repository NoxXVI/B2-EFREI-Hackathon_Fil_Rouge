import { GameCanvas } from "./game/GameCanvas";

export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000",
      }}
    >
      <GameCanvas />
    </div>
  );
}
