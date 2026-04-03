import { Image, XStack } from "tamagui";

interface HeartsRowProps {
  current: number;
  max: number;
}

export const HeartsRow = ({ current, max }: HeartsRowProps) => {
  const safeMax = Math.max(0, max);
  const safeCurrent = Math.max(0, Math.min(current, safeMax));

  return (
    <XStack gap="$1" alignItems="center" flexWrap="wrap">
      {Array.from({ length: safeMax }).map((_, index) => {
        const active = index < safeCurrent;

        return (
          <Image
            key={`heart-${index}`}
            src="/assets/heart.png"
            width={41}
            height={60}
            style={{
              imageRendering: "pixelated",
              opacity: active ? 1 : 0.28,
              filter: active ? "none" : "grayscale(100%)",
            }}
          />
        );
      })}
    </XStack>
  );
};
