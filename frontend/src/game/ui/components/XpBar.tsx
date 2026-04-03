import { XStack } from "tamagui";
import { hudUi } from "../styles";

interface XpBarProps {
  percent: number;
}

export const XpBar = ({ percent }: XpBarProps) => {
  return (
    <XStack
      mt="$2"
      style={{
        width: "100%",
        height: 14,
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
          width: `${percent}%`,
          backgroundColor: hudUi.xpFill,
        }}
      />
    </XStack>
  );
};
