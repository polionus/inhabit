/// <reference types="vite/client" />

declare module 'virtual:game-disc' {
  import type { GameDisc } from './template/types.ts';
  export const disc: GameDisc;
  export default disc;
}
