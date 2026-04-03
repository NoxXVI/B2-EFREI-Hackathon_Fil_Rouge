import { type UpgradeOption } from "../systems/PlayerProgressSystem";
import { HudPanel } from "./components/HudPanel";
import { UpgradeModal } from "./components/UpgradeModal";

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
  onUpgrade: (option: UpgradeOption) => void;
}

export const HudOverlay = ({
  progress,
  health,
  levelUpOpen,
  upgradeOptions,
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
    </>
  );
};
