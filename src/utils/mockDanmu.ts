import type { DanmuMessage } from '@/types/api';

const MOCK_TEMPLATES = [
  '666666',
  '太强了！',
  '牛啊牛啊',
  '加油加油💪',
  '这波操作绝了',
  '笑死我了哈哈',
  '来了来了',
  '前排围观',
  '冲冲冲',
  '起飞起飞',
  '哈哈哈哈',
  '好活当赏',
  '大师球！',
  '这也太帅了吧',
  '真不错',
  '确实',
  '芜湖~',
  '有被秀到',
  '爱了爱了',
  'nb',
];

const MOCK_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8'];

export function generateMockDanmuMessages(count: number): DanmuMessage[] {
  const now = Date.now();
  const messages: DanmuMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      id: `mock-${now}-${i}`,
      timestamp: now - (count - i),
      text: MOCK_TEMPLATES[Math.floor(Math.random() * MOCK_TEMPLATES.length)],
      username: `用户${Math.floor(Math.random() * 10000)}`,
      nickname: '',
      schoolName: '',
      badge: '',
      source: 'realtime',
      mode: Math.random() < 0.1 ? 1 : 0,
      color: Math.random() < 0.3 ? MOCK_COLORS[Math.floor(Math.random() * MOCK_COLORS.length)] : undefined,
    });
  }
  return messages;
}
