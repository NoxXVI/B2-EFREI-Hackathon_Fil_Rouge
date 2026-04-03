import { Text, YStack } from "tamagui";
import { type UpgradeOption } from "../../systems/PlayerProgressSystem";
import { hudUi } from "../styles";
import { UpgradeCardButton } from "./UpgradeCardButton";

interface UpgradeModalProps {
  open: boolean;
  options: UpgradeOption[];
  onUpgrade: (option: UpgradeOption) => void;
}

export const UpgradeModal = ({
  open,
  options,
  onUpgrade,
}: UpgradeModalProps) => {
  if (!open) return null;

  return (
    <YStack
      p="$4"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: hudUi.overlayBg,
        zIndex: 30,
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
          fontSize={28}
          fontWeight="900"
          style={{ fontFamily: "var(--font-section-title)" }}
        >
          Level Up
        </Text>
        <Text
          color={hudUi.textMuted}
          fontSize={20}
          style={{ fontFamily: "var(--font-ui-body)" }}
        >
          Choose a passive upgrade.
        </Text>

        <YStack gap="$3" mt="$1">
          {options.map((option) => (
            <UpgradeCardButton
              key={option.type}
              option={option}
              onSelect={onUpgrade}
            />
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
};
