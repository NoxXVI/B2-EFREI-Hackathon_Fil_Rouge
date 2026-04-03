import { createTamagui } from "tamagui";
import { defaultConfig } from "@tamagui/config/v5";

const config = createTamagui(defaultConfig);

export type Conf = typeof config;

declare module "tamagui" {
  // required for Tamagui type augmentation
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends Conf {}
}

export default config;
