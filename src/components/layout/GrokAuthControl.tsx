"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  sourceBadgeLabel,
  sourceBadgeVariant,
  type CredentialSource,
} from "@/lib/ai/source-badge";

interface AuthStatus {
  source: CredentialSource;
  expires_at?: number;
}

export function GrokAuthControl() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/xai/status");
      if (res.ok) {
        setStatus((await res.json()) as AuthStatus);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/xai/status");
        if (!cancelled && res.ok) {
          setStatus((await res.json()) as AuthStatus);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/xai", { method: "DELETE" });
    await refresh();
  };

  const source = status?.source ?? "mock";

  return (
    <div className="flex items-center gap-2" data-testid="grok-auth-control">
      <Badge variant={sourceBadgeVariant(source)} data-testid="grok-auth-badge">
        {loading ? "…" : sourceBadgeLabel(source)}
      </Badge>
      {source === "oauth" ? (
        <Button
          variant="glass"
          size="sm"
          onClick={() => void handleSignOut()}
          data-testid="grok-sign-out-btn"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      ) : (
        <Button
          variant="glass"
          size="sm"
          title="Run npm run auth:xai in your terminal to sign in with Grok"
          data-testid="grok-sign-in-hint"
        >
          <LogIn className="h-3.5 w-3.5" />
          <span className="hidden md:inline">npm run auth:xai</span>
        </Button>
      )}
      {source === "mock" && (
        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}