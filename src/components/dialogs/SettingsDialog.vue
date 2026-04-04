<script setup lang="ts">
import { useScheduleNotifyStore } from '@/stores/scheduleNotify';
import { useUiStore } from '@/stores/ui';
import type { NotifyPolicy } from '@/utils/scheduleNotifyDiff';
import { SelectButton } from 'primevue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Fieldset from 'primevue/fieldset';
import Message from 'primevue/message';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const scheduleNotifyStore = useScheduleNotifyStore();
const uiStore = useUiStore();
const permissionHint = ref('');
const danmuEnabledDraft = ref(Boolean(uiStore.danmuEnabled));
const danmuSettingChanged = ref(false);

const scheduleNotifyPermLabel = computed(() => {
  if (typeof globalThis.Notification === 'undefined') {
    return '当前环境不支持系统通知';
  }
  if (globalThis.Notification.permission === 'granted') {
    return '系统通知已开启';
  }
  if (globalThis.Notification.permission === 'denied') {
    return '系统通知已被拒绝，可在浏览器或系统设置中开启';
  }
  return '尚未授予系统通知权限（打开应用时已尝试请求）';
});

const scheduleNotifyPermCanRequestAgain = computed(
  () =>
    typeof globalThis.Notification !== 'undefined' &&
    globalThis.Notification.permission !== 'denied' &&
    globalThis.Notification.permission !== 'granted',
);

watch(
  () => props.visible,
  (v) => {
    if (v) {
      permissionHint.value = '';
      danmuEnabledDraft.value = Boolean(uiStore.danmuEnabled);
      danmuSettingChanged.value = false;
    }
  },
);

function close() {
  emit('update:visible', false);
}

function onDanmuEnabledChange(value: boolean) {
  danmuEnabledDraft.value = value;
  const normalized = Boolean(value);
  if (normalized !== Boolean(uiStore.danmuEnabled)) {
    uiStore.setDanmuEnabled(normalized);
    danmuSettingChanged.value = true;
  }
}

async function requestNotificationPermission() {
  if (typeof globalThis.Notification === 'undefined') {
    permissionHint.value = '当前环境不支持';
    return;
  }
  if (globalThis.Notification.permission === 'denied') {
    permissionHint.value = '请在浏览器设置中允许通知';
    return;
  }
  try {
    const r = await globalThis.Notification.requestPermission();
    permissionHint.value = r === 'granted' ? '已授权' : `结果：${r}`;
  } catch {
    permissionHint.value = '请求失败';
  }
}

const scheduleNotifyPolicyOptions: { label: string; value: NotifyPolicy }[] = [
  { label: '全部', value: 'all' },
  { label: '仅已关注', value: 'follow' },
];
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="设置"
    :style="{ width: 'min(420px, 94vw)' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="settings-form p-fluid">
      <Fieldset legend="赛程通知">
        <div class="field-row">
          <label for="settings-follow-only" class="field-label">推送模式</label>
          <SelectButton
            v-model="scheduleNotifyStore.policy"
            :options="scheduleNotifyPolicyOptions"
            option-label="label"
            option-value="value"
          />
        </div>

        <p class="perm-line">{{ scheduleNotifyPermLabel }}</p>

        <Button
          v-if="scheduleNotifyPermCanRequestAgain"
          label="Request Notification Permission"
          size="small"
          variant="outlined"
          @click="requestNotificationPermission"
        />

        <p v-if="permissionHint" class="perm-hint">{{ permissionHint }}</p>
      </Fieldset>

      <Fieldset legend="功能开关">
        <div class="flex flex-col gap-2">
          <div class="field-row">
            <label for="settings-pk-enabled" class="field-label">队伍PK</label>
            <ToggleSwitch id="settings-pk-enabled" v-model="uiStore.pkEnabled" />
          </div>
          <div class="field-row">
            <label for="settings-reaction-enabled" class="field-label">对局评价</label>
            <ToggleSwitch id="settings-reaction-enabled" v-model="uiStore.reactionEnabled" />
          </div>
          <div class="field-row">
            <label for="settings-danmu-enabled" class="field-label">弹幕功能</label>
            <ToggleSwitch
              id="settings-danmu-enabled"
              :model-value="danmuEnabledDraft"
              @update:model-value="onDanmuEnabledChange"
            />
          </div>
        </div>
        <Message v-if="danmuSettingChanged" severity="warn" :closable="false" class="mt-2">
          弹幕功能开关已更新，刷新页面后生效。
        </Message>
      </Fieldset>
    </div>

    <template #footer>
      <Button label="Close" severity="secondary" size="small" @click="close" />
    </template>
  </Dialog>
</template>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.field-label {
  flex: 1;
  min-width: 0;
}

.perm-line {
  margin: 0.65rem 0 0;
  font-size: 0.82rem;
  opacity: 0.88;
  line-height: 1.4;
}

.perm-hint {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  opacity: 0.9;
}
</style>
