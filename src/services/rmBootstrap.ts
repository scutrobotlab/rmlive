import type {
  CurrentAndNextMatches,
  GroupRankInfo,
  GroupsOrder,
  LiveGameInfo,
  RobotData,
  Schedule,
} from '../types/api';
import {
  fetchCurrentAndNextMatches,
  fetchGroupRankInfo,
  fetchGroupsOrder,
  fetchLiveGameInfo,
  fetchRobotData,
  fetchSchedule,
} from './rmApi';

export interface BootstrapFetchResults {
  liveGameInfoResult: PromiseSettledResult<LiveGameInfo>;
  currentAndNextResult: PromiseSettledResult<CurrentAndNextMatches>;
  groupsOrderResult: PromiseSettledResult<GroupsOrder>;
  scheduleResult: PromiseSettledResult<Schedule>;
  robotResult: PromiseSettledResult<RobotData>;
  groupRankResult: PromiseSettledResult<GroupRankInfo>;
}

export async function fetchBootstrapData(
  withBootstrapTimeout: <T>(promise: Promise<T>) => Promise<T>,
): Promise<BootstrapFetchResults> {
  const [liveGameInfoResult, currentAndNextResult, groupsOrderResult, scheduleResult, robotResult, groupRankResult] =
    await Promise.allSettled([
      withBootstrapTimeout(fetchLiveGameInfo()),
      withBootstrapTimeout(fetchCurrentAndNextMatches()),
      withBootstrapTimeout(fetchGroupsOrder()),
      withBootstrapTimeout(fetchSchedule()),
      withBootstrapTimeout(fetchRobotData()),
      withBootstrapTimeout(fetchGroupRankInfo()),
    ]);

  return {
    liveGameInfoResult,
    currentAndNextResult,
    groupsOrderResult,
    scheduleResult,
    robotResult,
    groupRankResult,
  };
}

export function getFulfilledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}
