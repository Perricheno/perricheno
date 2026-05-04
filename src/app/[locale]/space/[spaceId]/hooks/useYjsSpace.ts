"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export type YjsStatus = "connecting" | "connected" | "disconnected";

export interface YjsSpace {
    ydoc:     Y.Doc | null;
    provider: WebsocketProvider | null;
    status:   YjsStatus;
    synced:   boolean;
}

export function useYjsSpace(spaceId: string): YjsSpace {
    const [ydoc,     setYdoc]     = useState<Y.Doc | null>(null);
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [status,   setStatus]   = useState<YjsStatus>("connecting");
    const [synced,   setSynced]   = useState(false);

    // Hold mutable refs so cleanup closure always has current values
    const providerRef = useRef<WebsocketProvider | null>(null);
    const docRef      = useRef<Y.Doc | null>(null);

    useEffect(() => {
        let cancelled = false;

        const doc = new Y.Doc();
        docRef.current = doc;
        setYdoc(doc);
        setStatus("connecting");
        setSynced(false);

        fetch(`/api/space/${spaceId}/ws-token`)
            .then(r => r.json())
            .then(({ token, error }) => {
                if (cancelled || error || !token) {
                    setStatus("disconnected");
                    return;
                }

                const wsBase = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3035")
                    .replace(/\/+$/, "");

                const prov = new WebsocketProvider(wsBase, `space-${spaceId}`, doc, {
                    params: { token },
                });

                providerRef.current = prov;
                if (!cancelled) setProvider(prov);

                prov.on("status", ({ status: s }: { status: string }) => {
                    if (!cancelled) setStatus(s === "connected" ? "connected" : "disconnected");
                });

                prov.on("synced", (ok: boolean) => {
                    if (!cancelled) setSynced(ok);
                });
            })
            .catch(() => {
                if (!cancelled) setStatus("disconnected");
            });

        return () => {
            cancelled = true;
            providerRef.current?.destroy();
            docRef.current?.destroy();
            providerRef.current = null;
            docRef.current = null;
            setYdoc(null);
            setProvider(null);
            setStatus("connecting");
            setSynced(false);
        };
    }, [spaceId]);

    return { ydoc, provider, status, synced };
}
