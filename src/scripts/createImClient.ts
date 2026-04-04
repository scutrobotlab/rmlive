/// <reference types="node" />

import { Realtime } from 'leancloud-realtime';
import { randomUUID } from 'node:crypto';

// dotenv
import dotenv from 'dotenv';
dotenv.config();

type CliOptions = {
  name?: string;
  clientId?: string;
  tag?: string;
  json?: boolean;
  help?: boolean;
};

type ChatRoomLike = {
  id?: string;
  name?: string;
  createdAt?: Date | string | number;
  updatedAt?: Date | string | number;
};

function readArgValue(argv: string[], index: number): string | undefined {
  const inline = argv[index].split('=')[1];
  if (inline) {
    return inline;
  }
  return argv[index + 1];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg.startsWith('--name')) {
      const value = readArgValue(argv, index);
      if (value && value !== arg) {
        options.name = value;
        if (!arg.includes('=')) {
          index += 1;
        }
      }
      continue;
    }
    if (arg.startsWith('--client-id') || arg.startsWith('--client')) {
      const value = readArgValue(argv, index);
      if (value && value !== arg) {
        options.clientId = value;
        if (!arg.includes('=')) {
          index += 1;
        }
      }
      continue;
    }
    if (arg.startsWith('--tag')) {
      const value = readArgValue(argv, index);
      if (value && value !== arg) {
        options.tag = value;
        if (!arg.includes('=')) {
          index += 1;
        }
      }
    }
  }

  return options;
}

function resolveEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function formatTimestamp(value: Date | string | number | undefined): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function printHelp(): void {
  console.log(`Usage:
  node --experimental-strip-types src/scripts/createImClient.ts [options]

Options:
  --name <name>       Chat room name. Defaults to CHATROOM_NAME or an auto-generated value.
  --client-id <id>    IM client id. Defaults to CHATROOM_CLIENT_ID or a random UUID.
  --tag <tag>         Optional IM client tag.
  --json              Print the result as JSON.
  -h, --help          Show this help.

Environment:
  VITE_CHATROOM_APP_ID / VITE_CHATROOM_APP_KEY
  LEANCLOUD_APP_ID / LEANCLOUD_APP_KEY
  AV_APP_ID / AV_APP_KEY
  CHATROOM_NAME
  CHATROOM_CLIENT_ID
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const appId = resolveEnv('VITE_CHATROOM_APP_ID', 'LEANCLOUD_APP_ID', 'AV_APP_ID');
  const appKey = resolveEnv('VITE_CHATROOM_APP_KEY', 'LEANCLOUD_APP_KEY', 'AV_APP_KEY');

  if (!appId || !appKey) {
    throw new Error(
      'Missing app credentials. Set VITE_CHATROOM_APP_ID/VITE_CHATROOM_APP_KEY or LEANCLOUD_APP_ID/LEANCLOUD_APP_KEY.',
    );
  }

  const clientId = options.clientId || resolveEnv('CHATROOM_CLIENT_ID') || randomUUID();
  const roomName =
    options.name ||
    resolveEnv('CHATROOM_NAME') ||
    `rm-live-cli-${new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, '')
      .slice(0, 14)}`;
  const tag = options.tag || resolveEnv('CHATROOM_TAG');

  const realtime = new Realtime({
    appId,
    appKey,
    server: {
      RTMRouter: 'https://router-g0-push.leancloud.cn',
      api: 'https://api.leancloud.cn',
    },
  });

  const client = await realtime.createIMClient(clientId, tag ? { tag } : undefined);
  const chatRoom = (await client.createChatRoom({ name: roomName })) as ChatRoomLike;

  const result = {
    clientId,
    roomName: chatRoom.name ?? roomName,
    roomId: chatRoom.id ?? '',
    createdAt: formatTimestamp(chatRoom.createdAt),
    updatedAt: formatTimestamp(chatRoom.updatedAt),
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('IM client created');
    console.log(`  clientId: ${result.clientId}`);
    console.log(`  chatRoomId: ${result.roomId || '(unavailable)'}`);
    console.log(`  chatRoomName: ${result.roomName}`);
    if (result.createdAt) {
      console.log(`  createdAt: ${result.createdAt}`);
    }
  }

  await client.close();
}

main().catch((error: unknown) => {
  console.error('[createImClient] failed:', error);
  process.exitCode = 1;
});
