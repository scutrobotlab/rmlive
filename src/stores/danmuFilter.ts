import { Danmu } from 'artplayer-plugin-danmuku';
import { defineStore } from 'pinia';

export const useDanmuFilterStore = defineStore('danmuFilter', () => {
  const filter = (d: Danmu): boolean => {
    return true;
  };

  return {
    filter,
  };
});
