<script setup lang="ts">
import Avatar from 'primevue/avatar';
import { computed } from 'vue';
import { useUserInfoStore } from '../../stores/userInfo';

const userInfoStore = useUserInfoStore();

const userInfo = computed(() => userInfoStore.userInfo);

const avatarLabel = computed(() => {
  const nickname = userInfo.value?.nickname ?? '';
  return nickname.charAt(0).toUpperCase();
});

const avatarTitle = computed(() => userInfo.value?.nickname || '用户主页');

function goToUserProfile() {
  if (!userInfo.value?.id) {
    return;
  }

  window.open(`https://bbs.robomaster.com/user/${userInfo.value.id}`, '_blank');
}
</script>

<template>
  <Avatar
    v-if="userInfo"
    class="user-avatar"
    :image="userInfo.avatar"
    :label="avatarLabel"
    :aria-label="`访问 ${avatarTitle}`"
    :title="avatarTitle"
    shape="circle"
    size="small"
    @click="goToUserProfile"
  />
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
