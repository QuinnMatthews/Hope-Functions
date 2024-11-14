interface Platform {
  id: number;
  name: string;
  url: string;
  image: any;
}

interface Channel {
  id: number;
  streamingPlatformId: number;
  displayName: string;
  enabled: boolean; // This may be deprecated with restream's new events system
  url: string;
  embedUrl: string;
  identifier: string;
}

interface ErrorResp {
  error: string;
}

interface Destination {
  channelId: number;
  externalUrl: string;
  streamingPlatformId: number;
}

interface Event {
  id: number;
  status: string;
  title: string;
  description: string;
  coverUrl: string;
  scheduledFor: number;
  startedAt: number;
  finishedAt: number;
  destinations: Destination[];
}

export { Platform, Channel, Destination, ErrorResp, Event };