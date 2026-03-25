import { UserInfo } from '@/types/user';
import { useEventListener } from '@vueuse/core';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const userInfoRequestEvent = 'user-info-request';
export const userInfoResponseEvent = 'user-info-response';

export const useUserInfoStore = defineStore('userInfo', () => {
  const userInfo = ref<UserInfo | null>(null);

  const isIFrame = window.self !== window.top;

  if (window.parent && isIFrame) {
    useEventListener(window, userInfoResponseEvent, (e: CustomEvent<UserInfo | null>) => {
      userInfo.value = e.detail;
    });

    // start requesting user info now
    setInterval(() => {
      window.parent.dispatchEvent(new CustomEvent(userInfoRequestEvent));
    }, 1000);
    window.parent.dispatchEvent(new CustomEvent(userInfoRequestEvent));
  }

  return {
    userInfo,
  };
});
