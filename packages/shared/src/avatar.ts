export type AvatarEyes = 'normal' | 'happy' | 'wink' | 'angry';
export type AvatarMouth = 'smile' | 'grin' | 'smirk' | 'o';
export type AvatarHair = 'none' | 'short' | 'curly' | 'long';
export type AvatarGlasses = 'none' | 'round' | 'square' | 'sunglasses';
export type AvatarFacial = 'none' | 'mustache' | 'beard';

export interface AvatarConfig {
  skin: string;
  eyes: AvatarEyes;
  mouth: AvatarMouth;
  hair: AvatarHair;
  glasses: AvatarGlasses;
  facial: AvatarFacial;
  blush: boolean;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#F5D0A9',
  eyes: 'happy',
  mouth: 'smile',
  hair: 'short',
  glasses: 'none',
  facial: 'none',
  blush: false,
};

export const AVATAR_SKINS = ['#F5D0A9', '#E0AC69', '#C68642', '#8D5524', '#FFD5C2', '#F4C2A1'];
export const AVATAR_EYES: AvatarEyes[] = ['normal', 'happy', 'wink', 'angry'];
export const AVATAR_MOUTHS: AvatarMouth[] = ['smile', 'grin', 'smirk', 'o'];
export const AVATAR_HAIR: AvatarHair[] = ['none', 'short', 'curly', 'long'];
export const AVATAR_GLASSES: AvatarGlasses[] = ['none', 'round', 'square', 'sunglasses'];
export const AVATAR_FACIAL: AvatarFacial[] = ['none', 'mustache', 'beard'];

export function parseAvatar(raw: unknown): AvatarConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AVATAR };
  }
  const v = raw as Partial<AvatarConfig>;
  return {
    skin: typeof v.skin === 'string' ? v.skin : DEFAULT_AVATAR.skin,
    eyes: AVATAR_EYES.includes(v.eyes as AvatarEyes) ? (v.eyes as AvatarEyes) : DEFAULT_AVATAR.eyes,
    mouth: AVATAR_MOUTHS.includes(v.mouth as AvatarMouth) ? (v.mouth as AvatarMouth) : DEFAULT_AVATAR.mouth,
    hair: AVATAR_HAIR.includes(v.hair as AvatarHair) ? (v.hair as AvatarHair) : DEFAULT_AVATAR.hair,
    glasses: AVATAR_GLASSES.includes(v.glasses as AvatarGlasses)
      ? (v.glasses as AvatarGlasses)
      : DEFAULT_AVATAR.glasses,
    facial: AVATAR_FACIAL.includes(v.facial as AvatarFacial)
      ? (v.facial as AvatarFacial)
      : DEFAULT_AVATAR.facial,
    blush: Boolean(v.blush),
  };
}

export function randomAvatar(): AvatarConfig {
  const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!;
  const glassesRoll = Math.random();
  const facialRoll = Math.random();
  return {
    skin: pick(AVATAR_SKINS),
    eyes: pick(AVATAR_EYES),
    mouth: pick(AVATAR_MOUTHS),
    hair: pick(AVATAR_HAIR),
    glasses: glassesRoll < 0.22 ? pick(['round', 'square', 'sunglasses'] as const) : 'none',
    facial: facialRoll < 0.18 ? pick(['mustache', 'beard'] as const) : 'none',
    blush: Math.random() < 0.28,
  };
}
