import { useState } from "react";
import { Button, Input, Text, XStack, YStack } from "tamagui";
import { screenUi } from "./screenStyles";

interface HomeScreenProps {
  onPlaySolo: () => void;
  onPlayMulti: (config: { playerName: string; playerColor: string }) => void;
}

const normalizeHexColor = (value: string): string => {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  return "#44ccff";
};

export const HomeScreen = ({ onPlaySolo, onPlayMulti }: HomeScreenProps) => {
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [wsModalOpen, setWsModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState("Player");
  const [playerColor, setPlayerColor] = useState("#44ccff");

  return (
    <YStack
      width="100%"
      p="$5"
      gap="$4"
      style={{
        position: "relative",
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
        onPress={() => setModeModalOpen(true)}
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

      <Button
        unstyled
        onPress={() => setHelpModalOpen(true)}
        px="$5"
        py="$2"
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
          color={screenUi.textMuted}
          fontSize={30}
          style={{ fontFamily: "var(--font-ui-body)" }}
        >
          Commandes
        </Text>
      </Button>

      {modeModalOpen && (
        <YStack
          p="$4"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(8, 6, 12, 0.72)",
            zIndex: 40,
          }}
        >
          <YStack
            width="100%"
            gap="$3"
            p="$5"
            style={{
              maxWidth: 580,
              backgroundColor: screenUi.panelBg,
              borderWidth: 2,
              borderColor: screenUi.panelBorder,
              boxShadow: `inset 0 0 0 1px ${screenUi.panelBorderInner}`,
            }}
          >
            <Text
              color={screenUi.title}
              fontSize={60}
              style={{
                fontFamily: "var(--font-section-title)",
                textAlign: "center",
              }}
            >
              Choix du mode
            </Text>

            <Button
              unstyled
              onPress={onPlaySolo}
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
                fontSize={38}
                style={{ fontFamily: "var(--font-ui-body)" }}
              >
                Solo
              </Text>
            </Button>

            <Button
              unstyled
              onPress={() => {
                setModeModalOpen(false);
                setWsModalOpen(true);
              }}
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
                fontSize={38}
                style={{ fontFamily: "var(--font-ui-body)" }}
              >
                Multijoueur WS
              </Text>
            </Button>

            <Button
              unstyled
              onPress={() => setModeModalOpen(false)}
              py="$2"
              style={{
                borderWidth: 2,
                borderColor: screenUi.buttonBorder,
                backgroundColor: "transparent",
              }}
            >
              <Text
                color={screenUi.textMuted}
                fontSize={30}
                style={{ fontFamily: "var(--font-ui-body)" }}
              >
                Fermer
              </Text>
            </Button>
          </YStack>
        </YStack>
      )}

      {wsModalOpen && (
        <YStack
          p="$4"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(8, 6, 12, 0.78)",
            zIndex: 50,
          }}
        >
          <YStack
            width="100%"
            gap="$3"
            p="$5"
            style={{
              maxWidth: 620,
              backgroundColor: screenUi.panelBg,
              borderWidth: 2,
              borderColor: screenUi.panelBorder,
              boxShadow: `inset 0 0 0 1px ${screenUi.panelBorderInner}`,
            }}
          >
            <Text
              color={screenUi.title}
              fontSize={54}
              style={{
                fontFamily: "var(--font-section-title)",
                textAlign: "center",
              }}
            >
              Lobby WS
            </Text>

            <Text
              color={screenUi.textMuted}
              fontSize={28}
              style={{ fontFamily: "var(--font-ui-body)" }}
            >
              Configure ton profil avant d&apos;entrer dans le lobby.
            </Text>

            <YStack gap="$2">
              <Text
                color={screenUi.text}
                fontSize={28}
                style={{ fontFamily: "var(--font-ui-body)" }}
              >
                Pseudo
              </Text>
              <Input
                value={playerName}
                onChangeText={setPlayerName}
                size="$4"
                style={{
                  backgroundColor: screenUi.boardBg,
                  color: screenUi.text,
                  borderWidth: 2,
                  borderColor: screenUi.panelBorder,
                  boxShadow: `inset 0 0 0 1px ${screenUi.panelBorderInner}`,
                  fontFamily: "var(--font-ui-body)",
                  fontSize: 28,
                }}
              />
            </YStack>

            <YStack gap="$2">
              <Text
                color={screenUi.text}
                fontSize={28}
                style={{ fontFamily: "var(--font-ui-body)" }}
              >
                Couleur
              </Text>
              <XStack alignItems="center" gap="$3">
                <input
                  type="color"
                  value={normalizeHexColor(playerColor)}
                  onChange={(event) => setPlayerColor(event.target.value)}
                  style={{
                    width: 58,
                    height: 46,
                    border: `2px solid ${screenUi.panelBorder}`,
                    background: screenUi.boardBg,
                  }}
                />
                <Text
                  color={screenUi.textMuted}
                  fontSize={28}
                  style={{ fontFamily: "var(--font-ui-body)" }}
                >
                  {normalizeHexColor(playerColor)}
                </Text>
              </XStack>
            </YStack>

            <XStack
              gap="$2"
              flexWrap="wrap"
              style={{ justifyContent: "center" }}
            >
              <Button
                unstyled
                onPress={() =>
                  onPlayMulti({
                    playerName: playerName.trim() || "Player",
                    playerColor: normalizeHexColor(playerColor),
                  })
                }
                px="$5"
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
                  fontSize={34}
                  style={{ fontFamily: "var(--font-ui-body)" }}
                >
                  Entrer dans le lobby
                </Text>
              </Button>

              <Button
                unstyled
                onPress={() => {
                  setWsModalOpen(false);
                  setModeModalOpen(true);
                }}
                px="$5"
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
                  fontSize={34}
                  style={{ fontFamily: "var(--font-ui-body)" }}
                >
                  Retour
                </Text>
              </Button>
            </XStack>
          </YStack>
        </YStack>
      )}

      {helpModalOpen && (
        <YStack
          p="$4"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(8, 6, 12, 0.72)",
            zIndex: 45,
          }}
        >
          <YStack
            width="100%"
            gap="$2"
            p="$5"
            style={{
              maxWidth: 560,
              backgroundColor: screenUi.panelBg,
              borderWidth: 2,
              borderColor: screenUi.panelBorder,
              boxShadow: `inset 0 0 0 1px ${screenUi.panelBorderInner}`,
            }}
          >
            <Text
              color={screenUi.title}
              fontSize={56}
              style={{
                fontFamily: "var(--font-section-title)",
                textAlign: "center",
              }}
            >
              Commandes
            </Text>
            <Text
              color={screenUi.text}
              fontSize={30}
              style={{ fontFamily: "var(--font-ui-body)" }}
            >
              Bouger: WASD / ZQSD / Fleches
            </Text>
            <Text
              color={screenUi.text}
              fontSize={30}
              style={{ fontFamily: "var(--font-ui-body)" }}
            >
              Viser: Souris
            </Text>
            <Text
              color={screenUi.textMuted}
              fontSize={28}
              style={{ fontFamily: "var(--font-ui-body)" }}
            >
              Monte de niveau pour debloquer des upgrades.
            </Text>

            <Button
              unstyled
              onPress={() => setHelpModalOpen(false)}
              mt="$2"
              py="$2"
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
                fontSize={32}
                style={{ fontFamily: "var(--font-ui-body)" }}
              >
                Fermer
              </Text>
            </Button>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
};
