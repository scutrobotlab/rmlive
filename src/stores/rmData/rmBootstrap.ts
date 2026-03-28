import type {
  CurrentAndNextMatches,
  GroupRankInfo,
  GroupsOrder,
  LiveGameInfo,
  RobotData,
  Schedule,
} from '../../types/api';
import {
  fetchCurrentAndNextMatches,
  fetchGroupRankInfo,
  fetchGroupsOrder,
  fetchLiveGameInfo,
  fetchRobotData,
  fetchSchedule,
} from '../../api/rmApi';

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

export function getRejectedBootstrapSources(results: BootstrapFetchResults): string[] {
  const matrix: Array<[string, PromiseSettledResult<unknown>]> = [
    ['liveGameInfo', results.liveGameInfoResult],
    ['currentAndNextMatches', results.currentAndNextResult],
    ['groupsOrder', results.groupsOrderResult],
    ['schedule', results.scheduleResult],
    ['robotData', results.robotResult],
    ['groupRankInfo', results.groupRankResult],
  ];

  return matrix.filter(([, result]) => result.status === 'rejected').map(([source]) => source);
}

export function resolveBootstrapStreamErrorMessage(
  results: BootstrapFetchResults,
  defaultMessage = '直播流请求失败，请检查网络后重试',
): string | null {
  return results.liveGameInfoResult.status === 'rejected' ? defaultMessage : null;
}

export function shouldKeepBootstrapFallback(results: BootstrapFetchResults): boolean {
  return getRejectedBootstrapSources(results).length > 0;
}
