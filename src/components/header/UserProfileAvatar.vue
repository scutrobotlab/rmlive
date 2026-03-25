<script setup lang="ts">
import Avatar from 'primevue/avatar';
import { computed } from 'vue';
import { useUserInfoStore } from '../../stores/userInfo';

const userInfoStore = useUserInfoStore();

const avatarLabel = computed(() => {
  const nickname = userInfoStore.userInfo?.nickname ?? '';
  return nickname.charAt(0).toUpperCase();
});

const avatarTitle = computed(() => userInfoStore.userInfo?.nickname || '用户主页');

function goToUserProfile() {
  if (!userInfoStore.userInfo?.id) {
    return;
  }

  window.open(`https://bbs.robomaster.com/user/${userInfoStore.userInfo.id}`, '_blank');
}
</script>

<template>
  <div v-if="userInfoStore.userInfo">
    <Avatar
      v-if="userInfoStore.userInfo.avatar"
      class="user-avatar"
      :image="userInfoStore.userInfo.avatar"
      :aria-label="`访问 ${avatarTitle}`"
      :title="avatarTitle"
      shape="circle"
      size="small"
      @click="goToUserProfile"
    />
    <Avatar
      v-else
      class="user-avatar"
      :label="avatarLabel"
      :aria-label="`访问 ${avatarTitle}`"
      :title="avatarTitle"
      shape="circle"
      size="small"
      @click="goToUserProfile"
    />
  </div>
</template>

<style scoped>
.user-avatar {
  cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--p-surface-500) 45%, transparent);
  transition: border-color 0.2s ease;
}

.user-avatar:hover {
  border-color: color-mix(in srgb, var(--p-primary-400) 65%, transparent);
}
</style>
