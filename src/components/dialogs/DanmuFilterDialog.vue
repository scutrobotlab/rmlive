<script setup lang="ts">
import { MultiSelect } from 'primevue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref } from 'vue';
import { normalizeDanmuFilterToken } from '../../services/danmuFilterRules';
import { useDanmuStore } from '../../stores/danmu';
import { useDanmuFilterStore } from '../../stores/danmuFilter';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:visible': [visible: boolean];
}>();

const danmuFilterStore = useDanmuFilterStore();
const danmuStore = useDanmuStore();

const keywordInput = ref('');
const customSchoolInput = ref('');
const customUserInput = ref('');

const rules = computed(() => danmuFilterStore.rules);
const activeRuleCount = computed(() => danmuFilterStore.activeRuleCount);

function buildSelectedFirstOptions(selected: string[], candidates: string[]) {
  const seen = new Set<string>();
  const values: string[] = [];

  selected.forEach((item) => {
    const raw = String(item || '').trim();
    const token = normalizeDanmuFilterToken(raw);
    if (!token || seen.has(token)) {
      return;
    }
    seen.add(token);
    values.push(raw);
  });

  candidates.forEach((item) => {
    const raw = String(item || '').trim();
    const token = normalizeDanmuFilterToken(raw);
    if (!token || seen.has(token)) {
      return;
    }
    seen.add(token);
    values.push(raw);
  });

  return values.map((value) => ({ label: value, value }));
}

const schoolOptions = computed(() => {
  return buildSelectedFirstOptions(rules.value.schools, danmuStore.schoolCandidates);
});

const userOptions = computed(() => {
  return buildSelectedFirstOptions(rules.value.users, danmuStore.userCandidates);
});

const keywordTrimmed = computed(() => keywordInput.value.trim());
const customSchoolTrimmed = computed(() => customSchoolInput.value.trim());
const customUserTrimmed = computed(() => customUserInput.value.trim());

const keywordDuplicate = computed(() => {
  if (!keywordTrimmed.value) {
    return false;
  }
  const target = normalizeDanmuFilterToken(keywordTrimmed.value);
  return rules.value.keywords.some((item) => normalizeDanmuFilterToken(item) === target);
});

const customSchoolDuplicate = computed(() => {
  if (!customSchoolTrimmed.value) {
    return false;
  }
  const target = normalizeDanmuFilterToken(customSchoolTrimmed.value);
  return rules.value.schools.some((item) => normalizeDanmuFilterToken(item) === target);
});

const customUserDuplicate = computed(() => {
  if (!customUserTrimmed.value) {
    return false;
  }
  const target = normalizeDanmuFilterToken(customUserTrimmed.value);
  return rules.value.users.some((item) => normalizeDanmuFilterToken(item) === target);
});

const canAddKeyword = computed(() => Boolean(keywordTrimmed.value) && !keywordDuplicate.value);
const canAddCustomSchool = computed(() => Boolean(customSchoolTrimmed.value) && !customSchoolDuplicate.value);
const canAddCustomUser = computed(() => Boolean(customUserTrimmed.value) && !customUserDuplicate.value);

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

function updateSchools(values: string[]) {
  danmuFilterStore.setSchools(values);
}

function updateUsers(values: string[]) {
  danmuFilterStore.setUsers(values);
}

function addCustomSchool() {
  if (!canAddCustomSchool.value) {
    return;
  }
  updateSchools([...rules.value.schools, customSchoolTrimmed.value]);
  customSchoolInput.value = '';
}

function addCustomUser() {
  if (!canAddCustomUser.value) {
    return;
  }
  updateUsers([...rules.value.users, customUserTrimmed.value]);
  customUserInput.value = '';
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
      <div class="selector-row">
        <MultiSelect
          :model-value="rules.schools"
          :options="schoolOptions"
          option-label="label"
          option-value="value"
          placeholder="选择已出现过的学校"
          filter
          display="chip"
          size="small"
          fluid
          :max-selected-labels="3"
          @update:model-value="updateSchools"
        />
      </div>
      <div class="input-row">
        <InputText
          v-model="customSchoolInput"
          fluid
          size="small"
          placeholder="或手动输入学校后添加"
          @keydown.enter.prevent="addCustomSchool"
        />
        <Button label="添加" size="small" :disabled="!canAddCustomSchool" @click="addCustomSchool" />
      </div>
      <small v-if="customSchoolDuplicate" class="hint">该学校已存在</small>
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
      <div class="selector-row">
        <MultiSelect
          :model-value="rules.users"
          :options="userOptions"
          option-label="label"
          option-value="value"
          placeholder="选择已出现过的用户"
          filter
          display="chip"
          size="small"
          fluid
          :max-selected-labels="3"
          @update:model-value="updateUsers"
        />
      </div>
      <div class="input-row">
        <InputText
          v-model="customUserInput"
          fluid
          size="small"
          placeholder="或手动输入用户名/昵称后添加"
          @keydown.enter.prevent="addCustomUser"
        />
        <Button label="添加" size="small" :disabled="!canAddCustomUser" @click="addCustomUser" />
      </div>
      <small v-if="customUserDuplicate" class="hint">该用户已存在</small>
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

.selector-row {
  display: flex;
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
