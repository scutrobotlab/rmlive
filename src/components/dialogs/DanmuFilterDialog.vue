<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref } from 'vue';
import { normalizeDanmuFilterToken } from '../../services/danmuFilterRules';
import { useDanmuFilterStore } from '../../stores/danmuFilter';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:visible': [visible: boolean];
}>();

const danmuFilterStore = useDanmuFilterStore();

const keywordInput = ref('');
const schoolInput = ref('');
const userInput = ref('');

const rules = computed(() => danmuFilterStore.rules);
const activeRuleCount = computed(() => danmuFilterStore.activeRuleCount);

const keywordTrimmed = computed(() => keywordInput.value.trim());
const schoolTrimmed = computed(() => schoolInput.value.trim());
const userTrimmed = computed(() => userInput.value.trim());

const keywordDuplicate = computed(() => {
  if (!keywordTrimmed.value) {
    return false;
  }
  const target = normalizeDanmuFilterToken(keywordTrimmed.value);
  return rules.value.keywords.some((item) => normalizeDanmuFilterToken(item) === target);
});

const schoolDuplicate = computed(() => {
  if (!schoolTrimmed.value) {
    return false;
  }
  const target = normalizeDanmuFilterToken(schoolTrimmed.value);
  return rules.value.schools.some((item) => normalizeDanmuFilterToken(item) === target);
});

const userDuplicate = computed(() => {
  if (!userTrimmed.value) {
    return false;
  }
  const target = normalizeDanmuFilterToken(userTrimmed.value);
  return rules.value.users.some((item) => normalizeDanmuFilterToken(item) === target);
});

const canAddKeyword = computed(() => Boolean(keywordTrimmed.value) && !keywordDuplicate.value);
const canAddSchool = computed(() => Boolean(schoolTrimmed.value) && !schoolDuplicate.value);
const canAddUser = computed(() => Boolean(userTrimmed.value) && !userDuplicate.value);

function onDialogVisibleChange(value: boolean) {
  emit('update:visible', value);
}

function addKeyword() {
  if (!canAddKeyword.value) {
    return;
  }
  danmuFilterStore.addKeyword(keywordInput.value);
  keywordInput.value = '';
}

function addSchool() {
  if (!canAddSchool.value) {
    return;
  }
  danmuFilterStore.addSchool(schoolInput.value);
  schoolInput.value = '';
}

function addUser() {
  if (!canAddUser.value) {
    return;
  }
  danmuFilterStore.addUser(userInput.value);
  userInput.value = '';
}

function resetRules() {
  danmuFilterStore.resetRules();
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    header="弹幕过滤"
    :style="{ width: 'min(760px, 96vw)' }"
    @update:visible="onDialogVisibleChange"
  >
    <section class="filter-header">
      <div class="filter-header-left">
        <strong>启用过滤</strong>
        <small>当前规则 {{ activeRuleCount }} 条</small>
      </div>
      <ToggleSwitch :model-value="rules.enabled" @update:model-value="danmuFilterStore.setEnabled" />
    </section>

    <Message severity="info" :closable="false" class="tip">
      当前为屏蔽名单模式：命中关键字、学校、用户后将从轨道和列表同时隐藏。
    </Message>

    <section class="rule-block">
      <div class="rule-title-row">
        <h4>关键字过滤</h4>
        <Button
          v-if="rules.keywords.length"
          label="清空"
          size="small"
          text
          severity="secondary"
          @click="danmuFilterStore.clearKeywords"
        />
      </div>
      <div class="input-row">
        <InputText
          v-model="keywordInput"
          fluid
          size="small"
          placeholder="输入关键字后添加（如：刷屏、广告）"
          @keydown.enter.prevent="addKeyword"
        />
        <Button label="添加" size="small" :disabled="!canAddKeyword" @click="addKeyword" />
      </div>
      <small v-if="keywordDuplicate" class="hint">该关键字已存在</small>
      <div class="tag-wrap">
        <span v-if="!rules.keywords.length" class="empty">暂无关键字规则</span>
        <Tag v-for="keyword in rules.keywords" :key="`kw-${keyword}`" severity="secondary" rounded>
          <span class="tag-content">
            <span>{{ keyword }}</span>
            <button type="button" class="tag-remove" @click="danmuFilterStore.removeKeyword(keyword)">×</button>
          </span>
        </Tag>
      </div>
    </section>

    <section class="rule-block">
      <div class="rule-title-row">
        <h4>学校过滤</h4>
        <Button
          v-if="rules.schools.length"
          label="清空"
          size="small"
          text
          severity="secondary"
          @click="danmuFilterStore.clearSchools"
        />
      </div>
      <div class="input-row">
        <InputText
          v-model="schoolInput"
          fluid
          size="small"
          placeholder="输入学校名后添加"
          @keydown.enter.prevent="addSchool"
        />
        <Button label="添加" size="small" :disabled="!canAddSchool" @click="addSchool" />
      </div>
      <small v-if="schoolDuplicate" class="hint">该学校已存在</small>
      <div class="tag-wrap">
        <span v-if="!rules.schools.length" class="empty">暂无学校规则</span>
        <Tag v-for="school in rules.schools" :key="`school-${school}`" severity="secondary" rounded>
          <span class="tag-content">
            <span>{{ school }}</span>
            <button type="button" class="tag-remove" @click="danmuFilterStore.removeSchool(school)">×</button>
          </span>
        </Tag>
      </div>
    </section>

    <section class="rule-block">
      <div class="rule-title-row">
        <h4>用户过滤</h4>
        <Button
          v-if="rules.users.length"
          label="清空"
          size="small"
          text
          severity="secondary"
          @click="danmuFilterStore.clearUsers"
        />
      </div>
      <div class="input-row">
        <InputText
          v-model="userInput"
          fluid
          size="small"
          placeholder="输入用户名或昵称后添加"
          @keydown.enter.prevent="addUser"
        />
        <Button label="添加" size="small" :disabled="!canAddUser" @click="addUser" />
      </div>
      <small v-if="userDuplicate" class="hint">该用户已存在</small>
      <div class="tag-wrap">
        <span v-if="!rules.users.length" class="empty">暂无用户规则</span>
        <Tag v-for="user in rules.users" :key="`user-${user}`" severity="secondary" rounded>
          <span class="tag-content">
            <span>{{ user }}</span>
            <button type="button" class="tag-remove" @click="danmuFilterStore.removeUser(user)">×</button>
          </span>
        </Tag>
      </div>
    </section>

    <template #footer>
      <Button label="重置规则" severity="secondary" text @click="resetRules" />
      <Button label="关闭" @click="onDialogVisibleChange(false)" />
    </template>
  </Dialog>
</template>

<style scoped>
.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.filter-header-left {
  display: grid;
  gap: 0.15rem;
}

.filter-header-left small {
  opacity: 0.75;
}

.tip {
  margin-bottom: 0.7rem;
}

.rule-block {
  margin-bottom: 0.8rem;
}

.rule-block h4 {
  margin: 0 0 0.45rem;
  font-size: 0.9rem;
}

.rule-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.input-row {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
  min-height: 1.8rem;
}

.hint {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.78rem;
  opacity: 0.76;
}

.tag-content {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
}

.tag-remove {
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  font-size: 0.86rem;
}

.empty {
  opacity: 0.68;
  font-size: 0.8rem;
}

@media (max-width: 768px) {
  .input-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
