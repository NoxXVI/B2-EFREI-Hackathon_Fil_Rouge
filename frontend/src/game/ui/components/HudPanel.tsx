import { Text, XStack, YStack } from "tamagui";
import { type HudHealth, type HudProgress } from "../HudOverlay";
import { hudUi } from "../styles";
import { HeartsRow } from "./HeartsRow";
import { XpBar } from "./XpBar";

interface HudPanelProps {
  progress: HudProgress;
  health: HudHealth;
}

export const HudPanel = ({ progress, health }: HudPanelProps) => {
  const xpPercent = Math.max(
    0,
    Math.min(100, (progress.xp / progress.xpToNext) * 100),
  );

  return (
    <YStack
      style={{
        position: "absolute",
        top: 10,
        left: 10,
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
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
};
