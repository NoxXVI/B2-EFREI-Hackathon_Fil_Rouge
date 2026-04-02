import { type UpgradeOption } from "../systems/PlayerProgressSystem";

export interface HudProgress {
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
}

interface HudOverlayProps {
  progress: HudProgress;
  levelUpOpen: boolean;
  upgradeOptions: UpgradeOption[];
  onUpgrade: (option: UpgradeOption) => void;
}

export const HudOverlay = ({
  progress,
  levelUpOpen,
  upgradeOptions,
  onUpgrade,
}: HudOverlayProps) => {
  const xpPercent = Math.max(
    0,
    Math.min(100, (progress.xp / progress.xpToNext) * 100),
  );

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          width: 230,
          padding: 10,
          background: "rgba(0,0,0,0.45)",
          color: "white",
          borderRadius: 8,
          zIndex: 20,
          pointerEvents: "none",
          fontFamily: "monospace",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 22, lineHeight: 1 }}>
          Level {progress.level}
        </div>
        <div style={{ marginTop: 6, fontSize: 18 }}>
          XP {progress.xp}/{progress.xpToNext}
        </div>
        <div
          style={{
            marginTop: 6,
            width: "100%",
            height: 14,
            background: "#3a3a3a",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${xpPercent}%`,
              height: "100%",
              background: "#f5a000",
              transition: "width 120ms linear",
            }}
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 16, color: "#ffd700" }}>
          Skill points: {progress.skillPoints}
        </div>
      </div>

      {levelUpOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.65)",
            zIndex: 30,
          }}
        >
          <div
            style={{
              width: 520,
              padding: 24,
              borderRadius: 16,
              background: "#1d2430",
              color: "white",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ marginBottom: 12, fontSize: 24, fontWeight: 700 }}>
              Level Up
            </div>
            <div style={{ marginBottom: 16, opacity: 0.8 }}>
              Choose a passive upgrade.
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {upgradeOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => onUpgrade(option)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#2a3342",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {option.label}
                  </div>
                  <div style={{ opacity: 0.8, marginTop: 4 }}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
