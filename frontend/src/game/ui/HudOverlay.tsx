import { type UpgradeOption } from "../systems/PlayerProgressSystem";

export interface HudProgress {
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
}

export interface MapChangeInfo {
  level: number;
  name: string;
  description: string;
}

interface HudOverlayProps {
  progress: HudProgress;
  currentMapName: string;
  scoreboard?: Array<{
    id: string;
    name: string;
    color: number;
    kills: number;
    isYou: boolean;
  }>;
  levelUpOpen: boolean;
  upgradeOptions: UpgradeOption[];
  onUpgrade: (option: UpgradeOption) => void;
  mapChangeOpen: boolean;
  mapChangeInfo: MapChangeInfo | null;
  onConfirmMapChange: () => void;
  isChangingMap: boolean;
}

export const HudOverlay = ({
  progress,
  currentMapName,
  scoreboard,
  levelUpOpen,
  upgradeOptions,
  onUpgrade,
  mapChangeOpen,
  mapChangeInfo,
  onConfirmMapChange,
  isChangingMap,
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
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
          Map: {currentMapName}
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

      {!!scoreboard && scoreboard.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
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
          <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>
            Kills
          </div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {scoreboard
              .slice()
              .sort((a, b) => {
                if (b.kills !== a.kills) return b.kills - a.kills;
                return a.name.localeCompare(b.name);
              })
              .map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: p.isYou
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: `#${p.color.toString(16).padStart(6, "0")}`,
                        border: "1px solid rgba(255,255,255,0.25)",
                      }}
                    />
                    <div style={{ fontWeight: p.isYou ? 800 : 700 }}>
                      {p.name}
                      {p.isYou ? " (toi)" : ""}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800 }}>{p.kills}</div>
                </div>
              ))}
          </div>
        </div>
      )}

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

      {mapChangeOpen && mapChangeInfo && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.72)",
            zIndex: 40,
          }}
        >
          <div
            style={{
              width: 560,
              padding: 24,
              borderRadius: 16,
              background: "linear-gradient(180deg, #1d2430 0%, #141925 100%)",
              color: "white",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ marginBottom: 10, fontSize: 18, opacity: 0.85 }}>
              {mapChangeInfo.level > 0
                ? `Palier atteint — Niveau ${mapChangeInfo.level}`
                : "Changement de map"}
            </div>
            <div style={{ marginBottom: 10, fontSize: 28, fontWeight: 800 }}>
              {mapChangeInfo.name}
            </div>
            <div style={{ marginBottom: 18, opacity: 0.85, lineHeight: 1.4 }}>
              {mapChangeInfo.description}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={onConfirmMapChange}
                disabled={isChangingMap}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: isChangingMap ? "#243044" : "#2a3342",
                  color: "white",
                  cursor: isChangingMap ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                {isChangingMap ? "Changement..." : "OK — Changer de map"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
