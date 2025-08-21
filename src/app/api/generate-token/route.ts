import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";

const liveKitHost = process.env.LIVEKIT_URL;
const livekitSecret = process.env.LIVEKIT_API_SECRET;
const livekitApi = process.env.LIVEKIT_API_KEY;

const createAccessToken = async (userInfo : {identity: string; name?: string}, grant:any) => {
    const accessToken = new AccessToken(livekitApi , livekitSecret, userInfo);
    accessToken.addGrant(grant);
    return await accessToken.toJwt();
}

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const roomName = url.searchParams.get("room");
        const username = url.searchParams.get("username");

        if(!username) throw new Error("Missing username");
        if(!roomName) throw new Error("Missing room name");

        if (!liveKitHost || !livekitSecret || !livekitApi) throw new Error("LiveKit credentials not found");

        // Normalize host for REST (must be http/https)
        let restHost = liveKitHost;
        try {
            const url = new URL(liveKitHost);
            if (url.protocol === 'ws:' || url.protocol === 'wss:') {
                url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
                restHost = url.toString().replace(/\/$/, '');
            }
        } catch {}

        const roomClient = new RoomServiceClient(restHost, livekitApi, livekitSecret);

        // Create the room if it doesn't exist; ignore conflict if it already exists
        try {
            await roomClient.createRoom({ name: roomName });
        } catch (e: any) {
            // If room exists, proceed; otherwise rethrow
            const message = e?.message ?? "";
            if (!message.includes("already") && !message.includes("exists") && e?.status !== 409) {
                throw e;
            }
        }

        const grant = {
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canUpdateOwnMetadata: true,
        }

        const token = await createAccessToken({
            identity: username,
            name: username
        }, grant);

        // derive ws(s) URL from LIVEKIT_URL so client doesn't need NEXT_PUBLIC_LIVEKIT_URL
        let wsUrl: string | undefined;
        try {
            const u = new URL(liveKitHost);
            if (u.protocol === 'http:' || u.protocol === 'https:') {
                u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = u.toString().replace(/\/$/, '');
            } else if (u.protocol === 'ws:' || u.protocol === 'wss:') {
                // already a websocket URL
                wsUrl = u.toString().replace(/\/$/, '');
            }
        } catch {}

        return NextResponse.json({ roomName, token, wsUrl }, { status: 200 });
    } catch (error) {
        console.log(error);
        return NextResponse.json({ message: "internal server error" }, { status: 500 });
    }
}
