import { userInfoRequestEvent, userInfoResponseEvent } from './stores/userInfo';
import { UserInfo } from './types/user';

const iframe = document.createElement('iframe') as HTMLIFrameElement;
iframe.src = 'https://rmlive.scutbot.cn';
iframe.id = 'rm-live-iframe';

const mountPoint = document.currentScript?.parentElement || document.body;
mountPoint.appendChild(iframe);

const getUserInfo = async (): Promise<UserInfo | null> => {
  const storageKey = 'rmlive:user-info';
  const storedUserInfo = sessionStorage.getItem(storageKey);
  if (storedUserInfo) {
    try {
      return JSON.parse(storedUserInfo) as UserInfo;
    } catch {
      // ignore parse error and fallback to empty
    }
  }

  interface CookieUserInfo {
    nickname: string;
    avatar: string;
    id: number;
  }
  let cookieUserInfo: CookieUserInfo | null = null;
  // get 'userInfo' from cookie
  const cookieMatch = document.cookie.match(/(?:^|;\s*)userInfo=([^;]+)/);
  if (cookieMatch) {
    try {
      cookieUserInfo = JSON.parse(decodeURIComponent(cookieMatch[1]));
    } catch {
      return null;
    }
  }

  interface BBSResponse {}

  const bbsUserInfoResp = await fetch('https://bbs.robomaster.com/developers-server/rest/user/info', {
    method: 'POST',
    credentials: 'include',
    body: '{}',
  })
    .then((res) => res.json())
    .catch(() => null);
  if (!bbsUserInfoResp) {
    return null;
  }

  interface RegistrationResponse {
    data?: {
      nickName?: string;
    };
  }

  const registrationResp = (await fetch(
    `https://saas.robomaster.com/registration/nickName?userId=${cookieUserInfo?.id}`,
    {
      method: 'GET',
      credentials: 'include',
    },
  )
    .then((res) => res.json())
    .catch(() => null)) as RegistrationResponse | null;
  if (!registrationResp) {
    return null;
  }

  return null;
};

window.addEventListener(userInfoRequestEvent, async () => {
  const userInfo = await getUserInfo();
  const event = new CustomEvent(userInfoResponseEvent, { detail: userInfo });
  iframe.contentWindow?.dispatchEvent(event);
});
