import { createSignal } from "solid-js";
import { Modal } from "../common/Modal";
import { sshConnect } from "../../ipc/ssh-commands";
import "./QuickConnect.css";

interface QuickConnectProps {
  open: boolean;
  onClose: () => void;
  onConnected: (sessionInfo: any) => void;
}

export function QuickConnect(props: QuickConnectProps) {
  const [host, setHost] = createSignal("");
  const [port, setPort] = createSignal(22);
  const [user, setUser] = createSignal("");
  const [authType, setAuthType] = createSignal<"password" | "key" | "agent">("password");
  const [password, setPassword] = createSignal("");
  const [keyPath, setKeyPath] = createSignal("");
  const [connecting, setConnecting] = createSignal(false);
  const [error, setError] = createSignal("");

  const handleConnect = async () => {
    setConnecting(true);
    setError("");
    try {
      const auth = (() => {
        switch (authType()) {
          case "password":
            return { type: "Password" as const, password: password() };
          case "key":
            return { type: "PrivateKey" as const, key_path: keyPath(), passphrase: null };
          case "agent":
            return { type: "Agent" as const };
        }
      })();

      const session = await sshConnect(
        host(),
        port(),
        user(),
        auth,
        80,
        24
      );
      props.onConnected(session);
      props.onClose();
    } catch (e: any) {
      setError(e?.toString() || "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Modal open={props.open} onClose={props.onClose} title="Quick Connect">
      <div class="quick-connect">
        <div class="quick-connect__field">
          <label>Host</label>
          <input
            type="text"
            value={host()}
            onInput={(e) => setHost(e.currentTarget.value)}
            placeholder="example.com"
          />
        </div>
        <div class="quick-connect__row">
          <div class="quick-connect__field">
            <label>Port</label>
            <input
              type="number"
              value={port()}
              onInput={(e) => setPort(Number(e.currentTarget.value))}
            />
          </div>
          <div class="quick-connect__field">
            <label>User</label>
            <input
              type="text"
              value={user()}
              onInput={(e) => setUser(e.currentTarget.value)}
              placeholder="root"
            />
          </div>
        </div>
        <div class="quick-connect__field">
          <label>Authentication</label>
          <select
            value={authType()}
            onChange={(e) => setAuthType(e.currentTarget.value as any)}
          >
            <option value="password">Password</option>
            <option value="key">Private Key</option>
            <option value="agent">SSH Agent</option>
          </select>
        </div>
        {authType() === "password" && (
          <div class="quick-connect__field">
            <label>Password</label>
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </div>
        )}
        {authType() === "key" && (
          <div class="quick-connect__field">
            <label>Key Path</label>
            <input
              type="text"
              value={keyPath()}
              onInput={(e) => setKeyPath(e.currentTarget.value)}
              placeholder="~/.ssh/id_ed25519"
            />
          </div>
        )}
        {error() && <div class="quick-connect__error">{error()}</div>}
        <div class="quick-connect__actions">
          <button class="quick-connect__cancel" onClick={props.onClose}>
            Cancel
          </button>
          <button
            class="quick-connect__connect"
            onClick={handleConnect}
            disabled={connecting() || !host() || !user()}
          >
            {connecting() ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
