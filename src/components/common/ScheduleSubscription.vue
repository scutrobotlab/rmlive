<script setup lang="ts">
import { useScheduleNotifyStore } from '@/stores/scheduleNotify';
import Button from 'primevue/button';
import { computed } from 'vue';

const props = defineProps<{
  matchId: string | undefined;
}>();

const store = useScheduleNotifyStore();

const canSubscribe = computed(
  () => Boolean(props.matchId && props.matchId !== '-') && store.policy === 'follow',
);

const following = computed(() => (props.matchId ? store.isFollowing(props.matchId) : false));
</script>

<template>
  <Button
    v-if="canSubscribe"
    :icon="following ? 'pi pi-star-fill' : 'pi pi-star'"
    rounded
    text
    severity="secondary"
    size="small"
    :aria-label="following ? '取消关注' : '关注赛程'"
    @click="store.toggleFollowMatchId(matchId!)"
  />
</template>
