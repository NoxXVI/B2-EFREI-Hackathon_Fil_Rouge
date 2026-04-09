import { Text, XStack, YStack } from "tamagui";
import {
  type HudAbilities,
  type HudHealth,
  type HudProgress,
} from "../HudOverlay";
import { hudUi } from "../styles";
import { HeartsRow } from "./HeartsRow";
import { XpBar } from "./XpBar";
import {
  DASH_COOLDOWN_MS,
  DASH_DURATION_MS,
  SHIELD_COOLDOWN_MS,
  SHIELD_DURATION_MS,
} from "../../config/abilities";

interface HudPanelProps {
  progress: HudProgress;
  health: HudHealth;
  abilities: HudAbilities;
  weaponName: string;
  currentMapName: string;
}

export const HudPanel = ({
  progress,
  health,
  abilities,
  weaponName,
  currentMapName,
}: HudPanelProps) => {
  const xpPercent = Math.max(
    0,
    Math.min(100, (progress.xp / progress.xpToNext) * 100),
  );

  const formatSeconds = (ms: number) => {
    const s = Math.max(0, ms) / 1000;
    return s >= 10 ? `${s.toFixed(0)}s` : `${s.toFixed(1)}s`;
  };

  const shieldActive = abilities.shieldActiveMS > 0;
  const shieldCooldown = Math.max(0, abilities.shieldCooldownMS);
  const shieldReady = shieldCooldown <= 0 && !shieldActive;
  const shieldPercent = shieldActive
    ? Math.max(
        0,
        Math.min(100, (abilities.shieldActiveMS / SHIELD_DURATION_MS) * 100),
      )
    : shieldCooldown > 0
      ? Math.max(
          0,
          Math.min(100, (1 - shieldCooldown / SHIELD_COOLDOWN_MS) * 100),
        )
      : 100;

  const dashActive = abilities.dashActiveMS > 0;
  const dashCooldown = Math.max(0, abilities.dashCooldownMS);
  const dashReady = dashCooldown <= 0 && !dashActive;
  const dashPercent = dashActive
    ? Math.max(
        0,
        Math.min(100, (abilities.dashActiveMS / DASH_DURATION_MS) * 100),
      )
    : dashCooldown > 0
      ? Math.max(0, Math.min(100, (1 - dashCooldown / DASH_COOLDOWN_MS) * 100))
      : 100;

  return (
    <YStack
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <YStack
        p="$1"
        style={{
          width: 300,
          backgroundColor: hudUi.panelBg,
          borderWidth: 2,
          borderColor: hudUi.panelBorder,
          boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
        }}
      >
        <XStack items="flex-start" gap="$2" px="$1" py="$1">
          <YStack px="$1" style={{ marginBottom: 4 }}>
            <HeartsRow current={health.current} max={health.max} />
          </YStack>
          <YStack flex={1}>
            <Text
              color={hudUi.textMuted}
              fontSize={24}
              style={{ fontFamily: "var(--font-section-title)" }}
            >
              Level {progress.level}
            </Text>

            <XpBar percent={xpPercent} />

            <Text
              mt="$2"
              color={hudUi.textMuted}
              fontSize={18}
              numberOfLines={1}
              style={{ fontFamily: "var(--font-ui-body)", opacity: 0.92 }}
            >
              Arme: {weaponName}
            </Text>

            <XStack mt="$2" gap="$2">
              <YStack flex={1} gap="$1">
                <XStack style={{ justifyContent: "space-between" }}>
                  <Text
                    color={hudUi.textMuted}
                    fontSize={16}
                    style={{ fontFamily: "var(--font-ui-body)", opacity: 0.9 }}
                  >
                    Clique droit · Bouclier
                  </Text>
                  <Text
                    color={shieldActive ? "#44ccff" : hudUi.textMuted}
                    fontSize={16}
                    style={{ fontFamily: "var(--font-ui-body)", opacity: 0.95 }}
                  >
                    {shieldActive
                      ? formatSeconds(abilities.shieldActiveMS)
                      : shieldReady
                        ? "Prêt"
                        : formatSeconds(shieldCooldown)}
                  </Text>
                </XStack>

                <XStack
                  style={{
                    width: "100%",
                    height: 10,
                    overflow: "hidden",
                    backgroundColor: hudUi.xpTrack,
                    borderWidth: 2,
                    borderColor: hudUi.panelBorder,
                    boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
                  }}
                >
                  <XStack
                    style={{
                      height: "100%",
                      width: `${shieldPercent}%`,
                      backgroundColor: "#44ccff",
                      opacity: shieldActive ? 0.95 : 0.55,
                    }}
                  />
                </XStack>
              </YStack>

              <YStack flex={1} gap="$1">
                <XStack style={{ justifyContent: "space-between" }}>
                  <Text
                    color={hudUi.textMuted}
                    fontSize={16}
                    style={{ fontFamily: "var(--font-ui-body)", opacity: 0.9 }}
                  >
                    Space · Dash
                  </Text>
                  <Text
                    color={dashActive ? "#7CFF6B" : hudUi.textMuted}
                    fontSize={16}
                    style={{ fontFamily: "var(--font-ui-body)", opacity: 0.95 }}
                  >
                    {dashActive
                      ? formatSeconds(abilities.dashActiveMS)
                      : dashReady
                        ? "Prêt"
                        : formatSeconds(dashCooldown)}
                  </Text>
                </XStack>

                <XStack
                  style={{
                    width: "100%",
                    height: 10,
                    overflow: "hidden",
                    backgroundColor: hudUi.xpTrack,
                    borderWidth: 2,
                    borderColor: hudUi.panelBorder,
                    boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
                  }}
                >
                  <XStack
                    style={{
                      height: "100%",
                      width: `${dashPercent}%`,
                      backgroundColor: "#7CFF6B",
                      opacity: dashActive ? 0.95 : 0.55,
                    }}
                  />
                </XStack>
              </YStack>
            </XStack>

            <XStack mt="$2" style={{ justifyContent: "space-between" }}>
              <Text
                color={hudUi.textMuted}
                fontSize={20}
                numberOfLines={1}
                style={{ fontFamily: "var(--font-ui-body)", opacity: 0.9 }}
              >
                Map: {currentMapName}
              </Text>

              <Text
                color={progress.skillPoints > 0 ? hudUi.textAccent : hudUi.text}
                fontSize={20}
                style={{ fontFamily: "var(--font-ui-body)", fontWeight: "900" }}
              >
                +{progress.skillPoints}
              </Text>
            </XStack>
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
};
