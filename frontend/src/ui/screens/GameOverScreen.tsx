import { Button, Text, XStack, YStack } from "tamagui";
import { screenUi } from "./screenStyles";

interface GameOverScreenProps {
  onReplay: () => void;
  onBackHome: () => void;
}

export const GameOverScreen = ({
  onReplay,
  onBackHome,
}: GameOverScreenProps) => {
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
        fontSize={88}
        lineHeight={88}
        style={{
          fontFamily: "var(--font-section-title)",
          textAlign: "center",
          textShadow: "0 3px 0 rgba(0,0,0,0.35)",
        }}
      >
        Game Over
      </Text>

      <Text
        color={screenUi.textMuted}
        fontSize={34}
        style={{ fontFamily: "var(--font-ui-body)", textAlign: "center" }}
      >
        Tu es tombe au combat, mais la partie n&apos;est pas finie.
      </Text>

      <XStack gap="$3" flexWrap="wrap" style={{ justifyContent: "center" }}>
        <Button
          unstyled
          onPress={onReplay}
          px="$6"
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
            fontSize={40}
            style={{ fontFamily: "var(--font-ui-body)" }}
          >
            Rejouer
          </Text>
        </Button>

        <Button
          unstyled
          onPress={onBackHome}
          px="$6"
          py="$3"
          style={{
            borderWidth: 2,
            borderColor: screenUi.buttonBorder,
            backgroundColor: screenUi.buttonSecondaryBg,
            boxShadow: `inset 0 0 0 1px ${screenUi.panelBorderInner}`,
          }}
          hoverStyle={{ background: screenUi.buttonSecondaryHover }}
          pressStyle={{ background: screenUi.buttonSecondaryPress }}
        >
          <Text
            color={screenUi.text}
            fontSize={40}
            style={{ fontFamily: "var(--font-ui-body)" }}
          >
            Accueil
          </Text>
        </Button>
      </XStack>
    </YStack>
  );
};
