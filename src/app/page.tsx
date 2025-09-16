'use client';

import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  RoomContext,
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import '@livekit/components-styles';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function Page() {
  const [roomName, setRoomName] = useState('voice-room');
  const [username, setUsername] = useState('guest');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomInstance = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
      }),
    []
  );

  const connect = useCallback(async () => {
    try {
      setError(null);
      setConnecting(true);
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string | undefined) || '';
      const base = apiBase ? apiBase.replace(/\/$/, '') : '';
      const url = `${base}/api/generate-token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(`Token request failed: ${resp.status} ${msg}`);
      }
      const data = await resp.json();
      if (!data.token) throw new Error('No token received');
      const wsUrl = (data.wsUrl as string | undefined) || (process.env.NEXT_PUBLIC_LIVEKIT_URL as string | undefined);
      if (!wsUrl) throw new Error('LiveKit URL not provided by server and NEXT_PUBLIC_LIVEKIT_URL is not set');
      await roomInstance.connect(wsUrl, data.token);
      // enable mic after connect for voice agent
      await roomInstance.localParticipant.setMicrophoneEnabled(true);
      setConnected(true);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, [roomInstance, roomName, username]);

  useEffect(() => {
    return () => {
      try {
        roomInstance.disconnect();
      } catch {}
    };
  }, [roomInstance]);

  if (!connected) {
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <h1 className="text-6xl font-semibold">VAUCH AI VOICE AGENT</h1>
        <div className="w-full max-w-md space-y-4">
          <label className="block">
            <span className="text-2xl text-sm">For Testing Use your name as Room Name and any name as Username</span>
            <br />
            <br />
            <span className="text-sm">Room</span>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
            />
          </label>
          <label className="block">
            <span className="text-sm">Name</span>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
            />
          </label>
          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}
          <button
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            onClick={connect}
            disabled={connecting || !roomName || !username}
          >
            {connecting ? 'Connecting...' : 'Start Voice Session'}
          </button>
          <p className="text-xs text-gray-500">
            Make sure you allow microphone access when prompted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <RoomContext.Provider value={roomInstance}>
      <div data-lk-theme="default" style={{ height: '100dvh' }}>
        <MyVideoConference />
        <RoomAudioRenderer />
        <ControlBar />
      </div>
    </RoomContext.Provider>
  );
}

function MyVideoConference() {
  // `useTracks` returns all camera and screen share tracks. If a user
  // joins without a published camera track, a placeholder track is returned.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} style={{ height: 'calc(100vh - var(--lk-control-bar-height))' }}>
      {/* The GridLayout accepts zero or one child. The child is used
      as a template to render all passed in tracks. */}
      <ParticipantTile />
    </GridLayout>
  );
}