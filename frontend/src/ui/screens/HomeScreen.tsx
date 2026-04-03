import { Button, Text, YStack } from "tamagui";
import { screenUi } from "./screenStyles";

interface HomeScreenProps {
  onPlay: () => void;
}

export const HomeScreen = ({ onPlay }: HomeScreenProps) => {
  return (
    <YStack
      width="100%"
      p="$5"
      gap="$4"
      style={{
        maxWidth: 860,
        alignItems: "center",
        backgroundColor: screenUi.panelBg,
        borderWidth: 2,
        borderColor: screenUi.panelBorder,
        boxShadow: `inset 0 0 0 1px ${screenUi.panelBorderInner}`,
      }}
    >
      <Text
        color={screenUi.title}
        fontSize={84}
        lineHeight={84}
        style={{
          fontFamily: "var(--font-section-title)",
          textAlign: "center",
          textShadow: "0 3px 0 rgba(0,0,0,0.35)",
        }}
      >
        The Arch
      </Text>

      <YStack
        width="100%"
        p="$4"
        gap="$2"
        style={{
          backgroundColor: screenUi.boardBg,
          borderWidth: 2,
          borderColor: screenUi.panelBorder,
          boxShadow: `inset 0 0 0 1px ${screenUi.panelBorderInner}`,
        }}
      >
        <Text
          color={screenUi.text}
          fontSize={34}
          style={{ fontFamily: "var(--font-ui-body)" }}
        >
          Survis le plus longtemps possible et monte en niveau.
        </Text>
        <Text
          color={screenUi.textMuted}
          fontSize={30}
          style={{ fontFamily: "var(--font-ui-body)" }}
        >
          WASD / ZQSD pour bouger, la souris pour viser.
        </Text>
      </YStack>

      <Button
        unstyled
        onPress={onPlay}
        px="$7"
        py="$3"
        style={{
          borderWidth: 2,
          borderColor: screenUi.buttonBorder,
          backgroundColor: screenUi.buttonPrimaryBg,
          boxShadow: `inset 0 0 0 1px ${screenUi.panelBorderInner}`,
        }}
        hoverStyle={{ background: screenUi.buttonPrimaryHover }}
        pressStyle={{ background: screenUi.buttonPrimaryPress }}
      >
        <Text
          color={screenUi.text}
          fontSize={44}
          style={{ fontFamily: "var(--font-ui-body)" }}
        >
          Jouer
        </Text>
      </Button>
    </YStack>
  );
};
