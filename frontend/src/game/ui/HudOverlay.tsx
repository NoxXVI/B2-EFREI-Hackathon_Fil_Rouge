import { type UpgradeOption } from "../systems/PlayerProgressSystem";
import { HudPanel } from "./components/HudPanel";
import { UpgradeModal } from "./components/UpgradeModal";
import { hudUi } from "./styles";
import { Button, Text, XStack, YStack } from "tamagui";

export interface HudProgress {
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
}

export interface HudHealth {
  current: number;
  max: number;
}

export interface HudAbilities {
  shieldActiveMS: number;
  shieldCooldownMS: number;
  dashActiveMS: number;
  dashCooldownMS: number;
}

export interface HudRadarTarget {
  direction: string;
  distanceTiles: number;
  angleDeg: number;
}

export interface HudPickupRadar {
  heal: HudRadarTarget | null;
  power: HudRadarTarget | null;
}

export interface HudMiniMapData {
  cols: number;
  rows: number;
  player: { x: number; y: number } | null;
  heal: { x: number; y: number } | null;
  power: { x: number; y: number } | null;
}

export interface MapChangeInfo {
  level: number;
  name: string;
  description: string;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const MiniMap = ({ data }: { data: HudMiniMapData }) => {
  const W = 260;
  const H = 208;
  const cols = Math.max(1, Math.floor(data.cols));
  const rows = Math.max(1, Math.floor(data.rows));

  const toMini = (p: { x: number; y: number }) => {
    const x01 = clamp(p.x / Math.max(1, cols - 1), 0, 1);
    const y01 = clamp(p.y / Math.max(1, rows - 1), 0, 1);
    return { left: x01 * W, top: y01 * H };
  };

  const playerDot = data.player ? toMini(data.player) : null;
  const healDot = data.heal ? toMini(data.heal) : null;
  const powerDot = data.power ? toMini(data.power) : null;

  return (
    <YStack
      style={{
        width: W,
        height: H,
        position: "relative",
        alignSelf: "center",
        overflow: "hidden",
        backgroundColor: hudUi.boardBg,
        borderWidth: 2,
        borderColor: hudUi.panelBorder,
        boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
      }}
    >
      {/* Guide lines */}
      <YStack
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: H / 2,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.10)",
        }}
      />
      <YStack
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: W / 2,
          width: 1,
          backgroundColor: "rgba(255,255,255,0.10)",
        }}
      />

      {!!healDot && (
        <YStack
          style={{
            position: "absolute",
            left: healDot.left,
            top: healDot.top,
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: "#ff3b30",
            borderWidth: 2,
            borderColor: "rgba(0,0,0,0.35)",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {!!powerDot && (
        <YStack
          style={{
            position: "absolute",
            left: powerDot.left,
            top: powerDot.top,
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: "#8f2dff",
            borderWidth: 2,
            borderColor: "rgba(0,0,0,0.35)",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {!!playerDot && (
        <YStack
          style={{
            position: "absolute",
            left: playerDot.left,
            top: playerDot.top,
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: "#ffffff",
            borderWidth: 2,
            borderColor: "rgba(0,0,0,0.35)",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </YStack>
  );
};

const RadarRow = ({
  icon,
  iconColor,
  label,
  target,
}: {
  icon: string;
  iconColor: string;
  label: string;
  target: HudRadarTarget | null;
}) => {
  const arrowOpacity = target ? 1 : 0.25;
  const angle = target?.angleDeg ?? 0;

  return (
    <XStack items="center" gap="$2" style={{ justifyContent: "space-between" }}>
      <XStack items="center" gap="$2" flex={1} style={{ minWidth: 0 }}>
        <Text
          fontSize={22}
          style={{
            width: 18,
            textAlign: "center",
            color: iconColor,
            fontFamily: "var(--font-ui-body)",
            fontWeight: "900",
          }}
        >
          {icon}
        </Text>

        <Text
          color={hudUi.text}
          fontSize={20}
          numberOfLines={1}
          style={{ fontFamily: "var(--font-ui-body)" }}
        >
          {label}
        </Text>
      </XStack>

      <XStack items="center" gap="$2">
        <Text
          color={hudUi.textMuted}
          fontSize={18}
          numberOfLines={1}
          style={{ fontFamily: "var(--font-ui-body)", opacity: 0.92 }}
        >
          {target
            ? `${target.direction} · ≈ ${target.distanceTiles} cases`
            : "—"}
        </Text>

        <Text
          fontSize={22}
          lineHeight={22}
          style={{
            width: 22,
            textAlign: "center",
            color: iconColor,
            fontFamily: "var(--font-ui-body)",
            transform: `rotate(${angle}deg)`,
            opacity: arrowOpacity,
          }}
        >
          ▲
        </Text>
      </XStack>
    </XStack>
  );
};

interface HudOverlayProps {
  progress: HudProgress;
  health: HudHealth;
  abilities: HudAbilities;
  pickupRadar: HudPickupRadar;
  miniMap: HudMiniMapData;
  weaponName: string;
  currentMapName: string;
  toastMessage?: string | null;
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
  health,
  abilities,
  pickupRadar,
  miniMap,
  weaponName,
  currentMapName,
  toastMessage,
  scoreboard,
  levelUpOpen,
  upgradeOptions,
  onUpgrade,
  mapChangeOpen,
  mapChangeInfo,
  onConfirmMapChange,
  isChangingMap,
}: HudOverlayProps) => {
  const sortedScoreboard =
    scoreboard && scoreboard.length > 0
      ? scoreboard.slice().sort((a, b) => {
          if (b.kills !== a.kills) return b.kills - a.kills;
          return a.name.localeCompare(b.name);
        })
      : null;

  return (
    <>
      {!!toastMessage && (
        <YStack
          style={{
            position: "absolute",
            top: 18,
            left: 0,
            right: 0,
            alignItems: "center",
            pointerEvents: "none",
            zIndex: 60,
          }}
        >
          <YStack
            px="$4"
            py="$2"
            style={{
              maxWidth: 720,
              backgroundColor: hudUi.panelBg,
              borderWidth: 2,
              borderColor: hudUi.panelBorder,
              boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
            }}
          >
            <Text
              color={hudUi.text}
              fontSize={28}
              style={{
                fontFamily: "var(--font-ui-body)",
                textAlign: "center",
              }}
            >
              {toastMessage}
            </Text>
          </YStack>
        </YStack>
      )}

      <YStack
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          pointerEvents: "none",
          zIndex: 30,
        }}
      >
        <YStack
          px="$3"
          py="$2"
          gap="$2"
          style={{
            width: 300,
            backgroundColor: hudUi.panelBg,
            borderWidth: 2,
            borderColor: hudUi.panelBorder,
            boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
          }}
        >
          <Text
            color={hudUi.title}
            fontSize={24}
            lineHeight={24}
            style={{ fontFamily: "var(--font-section-title)" }}
          >
            Boussole
          </Text>

          <MiniMap data={miniMap} />

          <RadarRow
            icon="♥"
            iconColor="#ff3b30"
            label="Coeur"
            target={pickupRadar.heal}
          />

          <RadarRow
            icon="●"
            iconColor="#8f2dff"
            label="Super pouvoir"
            target={pickupRadar.power}
          />
        </YStack>
      </YStack>

      <HudPanel
        progress={progress}
        health={health}
        abilities={abilities}
        weaponName={weaponName}
        currentMapName={currentMapName}
      />

      {!!sortedScoreboard && (
        <YStack
          p="$2"
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 260,
            pointerEvents: "none",
            zIndex: 20,
            backgroundColor: hudUi.panelBg,
            borderWidth: 2,
            borderColor: hudUi.panelBorder,
            boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
          }}
        >
          <Text
            color={hudUi.title}
            fontSize={30}
            lineHeight={30}
            style={{ fontFamily: "var(--font-section-title)" }}
          >
            Kills
          </Text>

          <YStack mt="$2" gap="$2">
            {sortedScoreboard.map((p) => (
              <XStack
                key={p.id}
                items="center"
                gap="$2"
                px="$2"
                py="$1"
                style={{
                  justifyContent: "space-between",
                  backgroundColor: p.isYou
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(255,255,255,0.06)",
                }}
              >
                <XStack
                  items="center"
                  gap="$2"
                  flex={1}
                  style={{ minWidth: 0 }}
                >
                  <YStack
                    width={10}
                    height={10}
                    style={{
                      flexShrink: 0,
                      borderRadius: 999,
                      backgroundColor: `#${p.color
                        .toString(16)
                        .padStart(6, "0")}`,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.25)",
                    }}
                  />

                  <Text
                    color={hudUi.text}
                    fontSize={22}
                    numberOfLines={1}
                    style={{
                      fontFamily: "var(--font-ui-body)",
                      fontWeight: p.isYou ? "900" : "700",
                    }}
                  >
                    {p.name}
                    {p.isYou ? " (toi)" : ""}
                  </Text>
                </XStack>

                <Text
                  color={hudUi.text}
                  fontSize={22}
                  style={{
                    fontFamily: "var(--font-ui-body)",
                    fontWeight: "900",
                  }}
                >
                  {p.kills}
                </Text>
              </XStack>
            ))}
          </YStack>
        </YStack>
      )}

      <UpgradeModal
        open={levelUpOpen}
        options={upgradeOptions}
        onUpgrade={onUpgrade}
      />

      {mapChangeOpen && mapChangeInfo && (
        <YStack
          p="$4"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: hudUi.overlayBg,
            zIndex: 40,
          }}
        >
          <YStack
            width="100%"
            gap="$3"
            p="$5"
            style={{
              maxWidth: 620,
              backgroundColor: hudUi.modalBg,
              borderWidth: 2,
              borderColor: hudUi.panelBorder,
              boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
            }}
          >
            <Text
              color={hudUi.textMuted}
              fontSize={22}
              style={{ fontFamily: "var(--font-ui-body)" }}
            >
              {mapChangeInfo.level > 0
                ? `Palier atteint — Niveau ${mapChangeInfo.level}`
                : "Changement de map"}
            </Text>

            <Text
              color={hudUi.title}
              fontSize={50}
              lineHeight={50}
              style={{ fontFamily: "var(--font-section-title)" }}
            >
              {mapChangeInfo.name}
            </Text>

            <Text
              color={hudUi.text}
              fontSize={26}
              style={{ fontFamily: "var(--font-ui-body)", lineHeight: 32 }}
            >
              {mapChangeInfo.description}
            </Text>

            <XStack style={{ justifyContent: "flex-end" }}>
              <Button
                unstyled
                onPress={onConfirmMapChange}
                disabled={isChangingMap}
                px="$4"
                py="$3"
                style={{
                  borderWidth: 2,
                  borderColor: hudUi.buttonBorder,
                  backgroundColor: isChangingMap
                    ? hudUi.buttonSecondaryBg
                    : hudUi.buttonPrimaryBg,
                  boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
                  opacity: isChangingMap ? 0.7 : 1,
                }}
                hoverStyle={
                  isChangingMap
                    ? undefined
                    : { background: hudUi.buttonPrimaryHover }
                }
                pressStyle={
                  isChangingMap
                    ? undefined
                    : { background: hudUi.buttonPrimaryPress }
                }
              >
                <Text
                  color={hudUi.text}
                  fontSize={34}
                  style={{ fontFamily: "var(--font-ui-body)" }}
                >
                  {isChangingMap ? "Changement..." : "OK — Changer de map"}
                </Text>
              </Button>
            </XStack>
          </YStack>
        </YStack>
      )}
    </>
  );
};
