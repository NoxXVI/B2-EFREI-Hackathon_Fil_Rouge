export type LobbyPlayer = {
  id: string;
  name: string;
  color: number;
  kills: number;
};

interface MultiplayerLobbyProps {
  open: boolean;
  roomId: string;
  inviteLink: string;
  connecting: boolean;
  connected: boolean;
  error: string | null;
  playerName: string;
  playerColor: string;
  players: LobbyPlayer[];
  youId: string | null;
  hostId: string | null;
  gameStarted: boolean;
  onPlayerNameChange: (name: string) => void;
  onPlayerColorChange: (color: string) => void;
  onJoin: () => void;
  onStart: () => void;
  onPlaySolo: () => void;
}

export const MultiplayerLobby = ({
  open,
  roomId,
  inviteLink,
  connecting,
  connected,
  error,
  playerName,
  playerColor,
  players,
  youId,
  hostId,
  gameStarted,
  onPlayerNameChange,
  onPlayerColorChange,
  onJoin,
  onStart,
  onPlaySolo,
}: MultiplayerLobbyProps) => {
  if (!open) return null;

  const isHost = !!youId && !!hostId && youId === hostId;
  const joinDisabled = connecting || gameStarted;
  const canStart = connected && !gameStarted && isHost;

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      return;
    } catch {
      // ignore and fallback below
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = inviteLink;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        zIndex: 60,
      }}
    >
      <div
        style={{
          width: 560,
          padding: 24,
          borderRadius: 16,
          background: "#121826",
          color: "white",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 800 }}>Multijoueur (WS)</div>
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          4 joueurs max — rejoins avec ton pseudo et ta couleur.
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, opacity: 0.85 }}>Room</div>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 6,
              alignItems: "center",
            }}
          >
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                fontFamily: "monospace",
                fontSize: 13,
                opacity: 0.9,
              }}
            >
              {roomId}
            </div>
            <div style={{ flex: 1 }}>
              <input
                value={inviteLink}
                readOnly
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  outline: "none",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              />
            </div>
            <button
              onClick={copyInviteLink}
              style={{
                width: 110,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Copier
            </button>
          </div>
          <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
            Envoie ce lien à tes amis pour rejoindre la même partie.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px",
            gap: 12,
            marginTop: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>Pseudo</div>
            <input
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              placeholder="Ex: Charlemagne"
              disabled={connected || gameStarted}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "none",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>Couleur</div>
            <input
              type="color"
              value={playerColor}
              onChange={(e) => onPlayerColorChange(e.target.value)}
              disabled={gameStarted}
              style={{
                width: "100%",
                height: 44,
                marginTop: 6,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.06)",
                cursor: gameStarted ? "not-allowed" : "pointer",
              }}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              background: "rgba(255,0,0,0.12)",
              border: "1px solid rgba(255,0,0,0.22)",
              color: "#ffb3b3",
              fontFamily: "monospace",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {!connected ? (
            <button
              onClick={onJoin}
              disabled={joinDisabled}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: joinDisabled ? "#243044" : "#2f3d57",
                color: "white",
                cursor: joinDisabled ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              {connecting ? "Connexion..." : "Rejoindre"}
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!canStart}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: canStart ? "#2f3d57" : "#243044",
                color: "white",
                cursor: canStart ? "pointer" : "not-allowed",
                fontWeight: 800,
              }}
            >
              {isHost ? "Démarrer la partie" : "En attente de l'hôte..."}
            </button>
          )}

          <button
            onClick={onPlaySolo}
            style={{
              width: 160,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Jouer solo
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 8 }}>
            Joueurs ({players.length}/4)
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {players.length === 0 ? (
              <div style={{ opacity: 0.75, fontFamily: "monospace" }}>
                Personne pour l’instant.
              </div>
            ) : (
              players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: `#${p.color.toString(16).padStart(6, "0")}`,
                        border: "1px solid rgba(255,255,255,0.25)",
                      }}
                    />
                    <div style={{ fontWeight: 800 }}>
                      {p.name}
                      {p.id === youId ? " (toi)" : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      fontSize: 12,
                      opacity: 0.85,
                      fontFamily: "monospace",
                    }}
                  >
                    <div>Kills: {p.kills}</div>
                    <div style={{ opacity: 0.7 }}>
                      {p.id === hostId ? "Hôte" : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
