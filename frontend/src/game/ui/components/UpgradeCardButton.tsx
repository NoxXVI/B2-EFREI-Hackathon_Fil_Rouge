import { Button, Text, YStack } from "tamagui";
import { type UpgradeOption } from "../../systems/PlayerProgressSystem";
import { hudUi } from "../styles";

interface UpgradeCardButtonProps {
  option: UpgradeOption;
  onSelect: (option: UpgradeOption) => void;
}

export const UpgradeCardButton = ({
  option,
  onSelect,
}: UpgradeCardButtonProps) => {
  return (
    <Button
      unstyled
      onPress={() => onSelect(option)}
      style={{
        padding: 12,
        borderWidth: 2,
        borderColor: hudUi.cardBorder,
        backgroundColor: hudUi.cardBg,
        boxShadow: `inset 0 0 0 1px ${hudUi.panelBorderInner}`,
      }}
      hoverStyle={{ background: "#253652" }}
      pressStyle={{ background: "#17243a" }}
    >
      <YStack width="100%" gap="$1">
        <Text
          color="white"
          fontSize={24}
          style={{ fontFamily: "var(--font-ui-body)" }}
        >
          {option.label}
        </Text>
        <Text
          color={hudUi.textMuted}
          fontSize={20}
          style={{ fontFamily: "var(--font-ui-body)" }}
        >
          {option.description}
        </Text>
      </YStack>
    </Button>
  );
};
