import { Button, Text, YStack } from "tamagui";
import { type UpgradeOption } from "../systems/PlayerProgressSystem";
import { HudPanel } from "./components/HudPanel";
import { UpgradeModal } from "./components/UpgradeModal";
import { hudUi } from "./styles";

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

interface HudOverlayProps {
  progress: HudProgress;
  health: HudHealth;
  levelUpOpen: boolean;
  upgradeOptions: UpgradeOption[];
  mapChangeOpen: boolean;
  pendingMapName: string;
  isChangingMap: boolean;
  onConfirmMapChange: () => void;
  onUpgrade: (option: UpgradeOption) => void;
}

export const HudOverlay = ({
  progress,
  health,
  levelUpOpen,
  upgradeOptions,
  mapChangeOpen,
  pendingMapName,
  isChangingMap,
  onConfirmMapChange,
  onUpgrade,
}: HudOverlayProps) => {
  return (
    <>
      <HudPanel progress={progress} health={health} />
      <UpgradeModal
        open={levelUpOpen}
        options={upgradeOptions}
        onUpgrade={onUpgrade}
      />

      {mapChangeOpen && (
        <YStack
          p="$4"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: hudUi.overlayBg,
            zIndex: 40,
          }}
        >
          <YStack
            width="100%"
            gap="$3"
            p="$5"
            style={{
              maxWidth: 560,
              backgroundColor: hudUi.modalBg,
              borderWidth: 2,
              borderColor: hudUi.panelBorder,
              boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
            }}
          >
            <Text
              color="white"
              fontSize={32}
              style={{ fontFamily: "var(--font-section-title)" }}
            >
              Nouvelle zone debloquee
            </Text>
            <Text
              color={hudUi.textMuted}
              fontSize={22}
              style={{ fontFamily: "var(--font-ui-body)" }}
            >
              Passer sur la map: {pendingMapName}
            </Text>
            <Button
              unstyled
              onPress={onConfirmMapChange}
              disabled={isChangingMap}
              py="$3"
              style={{
                borderWidth: 2,
                borderColor: hudUi.cardBorder,
                backgroundColor: isChangingMap ? hudUi.panelBg : hudUi.cardBg,
                boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
              }}
              hoverStyle={{ background: "#253652" }}
              pressStyle={{ background: "#17243a" }}
            >
              <Text
                color="white"
                fontSize={24}
                style={{ fontFamily: "var(--font-ui-body)" }}
              >
                {isChangingMap ? "Changement..." : "OK"}
              </Text>
            </Button>
          </YStack>
        </YStack>
      )}
    </>
  );
};
