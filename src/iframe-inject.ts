import { userInfoRequestEvent, userInfoResponseEvent } from './constants/userInfoEvents';
import { UserInfo } from './types/user';

const iframe = document.createElement('iframe') as HTMLIFrameElement;
iframe.src = 'https://rmlive.scutbot.cn';
iframe.id = 'rm-live-iframe';
const iframeOrigin = new URL(iframe.src, window.location.href).origin;

const mountPoint = document.currentScript?.parentElement || document.body;
mountPoint.appendChild(iframe);

interface CookieUserInfo {
  nickname: string;
  avatar: string;
  id: number;
}

interface BBSUserData {
  id: number;
  nickname: string;
  avatar: string;
  role: string;
  badges: string[];
}

interface BBSResponse {
  code: number;
  message: string;
  success: boolean;
  data: BBSUserData;
}

interface SchoolInfo {
  id: string;
  name: string;
  shortName: string;
  enName: string;
  shortEnName: string;
}

interface RegistrationData {
  id: string;
  nickname: string;
  gradePoint: string;
  hSchoolInfo: SchoolInfo;
  racingAge: number;
}

interface RegistrationResponse {
  code: string;
  msg: string;
  success: boolean;
  data: RegistrationData;
}

const getUserInfo = async (): Promise<UserInfo | null> => {
  const storageKey = 'rmlive:user-info';
  const storedUserInfo = sessionStorage.getItem(storageKey);
  if (storedUserInfo) {
    try {
      return JSON.parse(storedUserInfo) as UserInfo;
    } catch (e) {
      console.warn('[rmlive] Failed to parse cached user info:', e);
      // continue to fetch fresh data
    }
  }

  let cookieUserInfo: CookieUserInfo | null = null;
  // get 'userInfo' from cookie
  const cookieMatch = document.cookie.match(/(?:^|;\s*)userInfo=([^;]+)/);
  if (cookieMatch) {
    try {
      cookieUserInfo = JSON.parse(decodeURIComponent(cookieMatch[1]));
    } catch (e) {
      console.warn('[rmlive] Failed to parse userInfo from cookie:', e);
      return null;
    }
  } else {
    console.warn('[rmlive] No userInfo found in cookie');
    return null;
  }

  if (!cookieUserInfo?.id) {
    console.warn('[rmlive] Cookie userInfo missing id');
    return null;
  }

  try {
    // Fetch BBS user info
    const bbsResp = await fetch('https://bbs.robomaster.com/developers-server/rest/user/info', {
      method: 'POST',
      credentials: 'include',
      body: '{}',
    });

    if (!bbsResp.ok) {
      console.warn(`[rmlive] BBS API returned status ${bbsResp.status}`);
      return null;
    }

    const bbsData = (await bbsResp.json()) as BBSResponse;
    if (!bbsData?.success || !bbsData?.data) {
      console.warn('[rmlive] BBS API response invalid:', bbsData);
      return null;
    }

    // Fetch Registration info
    const registrationResp = await fetch(
      `https://saas.robomaster.com/registration/nickName?userId=${cookieUserInfo.id}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (!registrationResp.ok) {
      console.warn(`[rmlive] Registration API returned status ${registrationResp.status}`);
      return null;
    }

    const registrationData = (await registrationResp.json()) as RegistrationResponse;
    if (!registrationData?.success || !registrationData?.data) {
      console.warn('[rmlive] Registration API response invalid:', registrationData);
      return null;
    }

    // Merge data into UserInfo
    const userInfo: UserInfo = {
      id: String(bbsData.data.id),
      nickname: bbsData.data.nickname,
      realName: registrationData.data.nickname || bbsData.data.nickname,
      avatar: bbsData.data.avatar,
      racingAge: registrationData.data.racingAge,
      school: registrationData.data.hSchoolInfo.name,
      grade: registrationData.data.gradePoint,
      role: bbsData.data.role,
      badge: bbsData.data.badges || [],
    };

    // Cache in sessionStorage
    sessionStorage.setItem(storageKey, JSON.stringify(userInfo));
    console.log('[rmlive] User info fetched and cached:', userInfo);

    return userInfo;
  } catch (error) {
    console.error('[rmlive] Error fetching user info:', error);
    return null;
  }
};

window.addEventListener('message', async (event: MessageEvent) => {
  if (event.source !== iframe.contentWindow) {
    return;
  }

  if (!event.data || typeof event.data !== 'object' || event.data.type !== userInfoRequestEvent) {
    return;
  }

  const userInfo = await getUserInfo();
  iframe.contentWindow?.postMessage(
    {
      type: userInfoResponseEvent,
      payload: userInfo,
    },
    iframeOrigin,
  );
});
