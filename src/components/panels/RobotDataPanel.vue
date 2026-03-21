<script setup lang="ts">
import Card from 'primevue/card';
import Chart from 'primevue/chart';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { computed } from 'vue';
import type { RobotData } from '../../types/api';

interface Props {
  payload: RobotData | null;
  selectedZoneId: string | null;
  teamName?: string | null;
}

const props = defineProps<Props>();

interface RobotRow {
  team: string;
  collegeName: string;
  robot: string;
  robotType: string;
  eaKDA: number;
  eagHurt: number;
  eaSmallHitRate: number;
  combatScore: number;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getZones(data: RobotData | null): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const root = data as Record<string, unknown>;
  if (Array.isArray(root.zones)) {
    return root.zones as Record<string, unknown>[];
  }

  return [];
}

function toRows(
  data: RobotData | null,
  selectedZoneId: string | null,
  teamName: string | null | undefined,
): RobotRow[] {
  const zones = getZones(data);
  if (!zones.length) {
    return [];
  }

  const zone = zones.find((item) => String(item.id ?? '') === String(selectedZoneId ?? '')) ?? zones[0];
  const teams = (zone.teams ?? []) as Record<string, unknown>[];

  const rows: RobotRow[] = [];

  for (const team of teams) {
    const teamName = String(team.name ?? '-');
    const collegeName = String(team.collegeName ?? '-');
    const robots = (team.robots ?? []) as Record<string, unknown>[];

    for (const robot of robots) {
      const eaKDA = toNumber(robot.eaKDA);
      const eagHurt = toNumber(robot.eagHurt);
      const eaSmallHitRate = toNumber(robot.eaSmallHitRate);
      const combatScore = eagHurt > 0 ? eagHurt : eaKDA * 100 + eaSmallHitRate;

      rows.push({
        team: teamName,
        collegeName,
        robot: String(robot.name ?? '-'),
        robotType: String(robot.robotType ?? '-'),
        eaKDA,
        eagHurt,
        eaSmallHitRate,
        combatScore,
      });
    }
  }

  const filteredRows = teamName && teamName.trim().length ? rows.filter((row) => row.team === teamName) : rows;

  return filteredRows.sort((a, b) => b.combatScore - a.combatScore);
}

const rows = computed(() => toRows(props.payload, props.selectedZoneId, props.teamName));

const chartData = computed(() => {
  const topRows = rows.value.slice(0, 10);
  const labels = topRows.map((item) => `${item.team}-${item.robot}`);
  const scores = topRows.map((item) => item.combatScore);

  return {
    labels,
    datasets: [
      {
        label: '综合战斗值',
        backgroundColor: '#0070f3',
        borderColor: '#0070f3',
        data: scores,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(148, 163, 184, 0.15)' },
    },
    y: {
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(148, 163, 184, 0.15)' },
    },
  },
};
</script>

<template>
  <Card>
    <template #title> 比赛数据{{ props.teamName ? ` - ${props.teamName}` : '' }} </template>
    <template #content>
      <p v-if="props.teamName" class="tip">已按队伍筛选，可在上方卡片切换查看其他队伍。</p>
      <div class="chart-wrap">
        <Chart type="bar" :data="chartData" :options="chartOptions" />
      </div>

      <div class="table-wrap">
        <DataTable
          class="table"
          :value="rows"
          paginator
          :rows="6"
          size="small"
          stripedRows
          tableStyle="min-width: 42rem"
        >
          <Column field="team" header="队伍" />
          <Column field="collegeName" header="学校" />
          <Column field="robot" header="机器人" />
          <Column field="robotType" header="类型" />
          <Column field="eaKDA" header="KDA" />
          <Column field="eagHurt" header="伤害" />
          <Column field="eaSmallHitRate" header="命中率" />
          <Column field="combatScore" header="综合" />
        </DataTable>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.chart-wrap {
  height: 260px;
  margin-bottom: 1rem;
}

.tip {
  margin: 0 0 0.6rem;
  font-size: 0.84rem;
  opacity: 0.8;
}

.table {
  margin-top: 0.5rem;
}

.table-wrap {
  overflow-x: auto;
}

@media (max-width: 768px) {
  .chart-wrap {
    height: 210px;
  }
}
</style>
