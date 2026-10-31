import "client-only";

const CHARACTER_SETS = {
  uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lowercase: "abcdefghijkmnopqrstuvwxyz",
  numbers: "23456789",
  symbols: "!@#$%^&*()-_=+[]{}?",
} as const;

type CharacterSetKey = keyof typeof CHARACTER_SETS;

export type GeneratorOptions = Record<CharacterSetKey, boolean> & { length: number };

function randomIndex(maxExclusive: number): number {
  if (maxExclusive < 1 || maxExclusive > 256) throw new Error("Invalid random range");
  const limit = Math.floor(256 / maxExclusive) * maxExclusive;
  const randomByte = new Uint8Array(1);
  let value = 256;
  while (value >= limit) {
    crypto.getRandomValues(randomByte);
    value = randomByte[0];
  }
  return value % maxExclusive;
}

function randomCharacter(characters: string): string {
  return characters[randomIndex(characters.length)];
}

export function generateSecurePassword(options: GeneratorOptions): string {
  const enabledSets = (Object.keys(CHARACTER_SETS) as CharacterSetKey[]).filter((key) => options[key]);
  if (enabledSets.length === 0) throw new Error("Select at least one character set");
  if (!Number.isInteger(options.length) || options.length < enabledSets.length || options.length > 128) {
    throw new Error("Password length must be between 4 and 128 characters");
  }

  const characters = enabledSets.map((key) => CHARACTER_SETS[key]);
  const alphabet = characters.join("");
  const password = enabledSets.map((key) => randomCharacter(CHARACTER_SETS[key]));
  while (password.length < options.length) password.push(randomCharacter(alphabet));

  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }
  return password.join("");
}
