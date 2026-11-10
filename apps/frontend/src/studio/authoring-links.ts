export function safeAuthoringLink(value: string) {
  if (
    !value ||
    /[\\\s]/.test(value) ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) ||
    !/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(value)
  )
    return false;
  try {
    return ["http:", "https:", "mailto:"].includes(
      new URL(value, "https://bunkercode.local").protocol,
    );
  } catch {
    return false;
  }
}
