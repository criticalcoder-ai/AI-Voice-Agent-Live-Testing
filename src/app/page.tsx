'use client';

import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  RoomContext,
  BarVisualizer,
  useVoiceAssistant,
} from '@livekit/components-react';
import { Room, Track, RoomEvent } from 'livekit-client';
import '@livekit/components-styles';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function Page() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const roomInstance = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
      }),
    []
  );

  // When the user leaves (disconnects), reset UI to home and prepare a new session
  useEffect(() => {
    const handleDisconnected = () => {
      setConnected(false);
      setSessionId(null);
      setUserId(null);
      setError(null);
    };
    roomInstance.on(RoomEvent.Disconnected, handleDisconnected);
    return () => {
      roomInstance.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [roomInstance]);

  const connect = useCallback(
    async (override?: { room: string; user: string }) => {
      try {
        setError(null);
        setConnecting(true);
        // prefer override -> state -> generate
        const room = override?.room ?? sessionId ?? `session-${Math.random().toString(36).slice(2, 10)}`;
        const user = override?.user ?? userId ?? `user-${Math.random().toString(36).slice(2, 10)}`;
        if (!sessionId) setSessionId(room);
        if (!userId) setUserId(user);

        const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string | undefined) || '';
        const base = apiBase ? apiBase.replace(/\/$/, '') : '';
        const url = `${base}/api/generate-token?room=${encodeURIComponent(room)}&username=${encodeURIComponent(user)}`;
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
    },
    [roomInstance, sessionId, userId]
  );

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
        <div className="space-y-4 text-center">
        <h1 className="text-4xl md:text-6xl font-semibold">VAUCH AI VOICE AGENT</h1>
        <h2 className='mb-4 text-4xl font-extrabold leading-none tracking-tight text-gray-900 md:text-5xl lg:text-6xl dark:text-white'>Your Personal <span className="text-blue-600 dark:text-blue-500">AI Voice Agent</span></h2>
        <img className="mx-auto flex  hover:cursor-pointer" src="/cropped-Vauch-Info-Logo-1-1-300x194.png" alt="Vauch Info Tech Logo" onClick={() => window.open('https://www.vauchinfotech.com', '_blank')} />
        </div>
        <div className="w-full max-w-md space-y-4 text-center">
          {sessionId && (
            <div className="mx-auto inline-block rounded bg-gray-100 text-gray-800 px-3 py-1 text-sm">
              Session ID: <span className="font-mono font-semibold">{sessionId}</span>
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}
          <button
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-60 hover:bg-blue-700"
            onClick={() => connect()}
            disabled={connecting}
          >
            {connecting ? 'Connecting...' : error ? 'Retry Connection' : 'Start Voice Session'}
          </button>
          <p className="text-xs text-gray-500">Make sure you allow microphone access when prompted.</p>
        </div>
      </div>
    );
  }

  return (
    <RoomContext.Provider value={roomInstance}>
      <div data-lk-theme="default" style={{ height: '100dvh', position: 'relative' }}>
        {/* Session badge */}
        {sessionId && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 rounded bg-black/70 text-white px-3 py-1 text-xs">
            Session ID: <span className="font-mono">{sessionId}</span>
          </div>
        )}
        <MyVideoConference />
        <RoomAudioRenderer />
        <ControlBar controls={{
          microphone: true,
          camera: false,
          screenShare: false,
          chat: false,
          leave: true,
        }} />
      </div>
    </RoomContext.Provider>
  );
}

function MyVideoConference() {
  // `useTracks` returns all camera and screen share tracks. If a user
  // joins without a published camera track, a placeholder track is returned.



  // const tracks = useTracks(
  //   [
  //     { source: Track.Source.Camera, withPlaceholder: true },
  //     { source: Track.Source.ScreenShare, withPlaceholder: false },
  //   ],
  //   { onlySubscribed: false },
  // );
  // return (
  //   <GridLayout tracks={tracks} style={{ height: 'calc(100vh - var(--lk-control-bar-height))' }}>
  //     {/* The GridLayout accepts zero or one child. The child is used
  //     as a template to render all passed in tracks. */}
  //     <ParticipantTile />
  //   </GridLayout>
  // );



  const { state, audioTrack } = useVoiceAssistant();
return (
  <div className="h-160">
    <BarVisualizer state={state} barCount={5} trackRef={audioTrack} />
  </div>
);
}
