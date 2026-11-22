/**
 * The intro's sprite sheet. Its file name carries a hash of the content: the service worker keeps
 * /brand/ files forever (cache-first), so a re-rendered sheet MUST get a new name, or devices would
 * keep cutting the old image with the new frame grid. When re-baking: rename the file to
 * intro-mascot.<first 10 chars of its md5>.webp and update this constant.
 */
export const INTRO_SPRITE = "/brand/intro-mascot.75de6ff813.webp";
