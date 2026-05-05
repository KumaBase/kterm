import { createStore } from "solid-js/store";
import {
  shellProfilesLoad,
  shellProfileCreate as createProfile,
  shellProfileUpdate as updateProfile,
  shellProfileDelete as deleteProfile,
  shellProfileSetDefault as setDefaultProfile,
  shellDetectAvailable,
} from "../ipc/profile-commands";
import type { ShellProfile, ShellProfilesConfig } from "../ipc/profile-commands";

interface ProfileState {
  profiles: ShellProfile[];
  defaultProfileId: string | null;
  loaded: boolean;
}

const [state, setState] = createStore<ProfileState>({
  profiles: [],
  defaultProfileId: null,
  loaded: false,
});

function shellPathToName(path: string): string {
  const basename = path.split("/").pop() ?? path;
  return basename.charAt(0).toUpperCase() + basename.slice(1);
}

export function useProfileStore() {
  const load = async () => {
    const config = await shellProfilesLoad();
    setState({
      profiles: config.profiles,
      defaultProfileId: config.default_profile_id,
      loaded: true,
    });
  };

  const initProfiles = async () => {
    if (state.loaded && state.profiles.length > 0) return;

    await load();

    // Auto-detect shells on first run
    if (state.profiles.length === 0) {
      const shells = await shellDetectAvailable();

      for (const shellPath of shells) {
        const profile = await createProfile(
          shellPathToName(shellPath),
          shellPath,
          [],
          null,
          []
        );
        setState("profiles", (prev) => [...prev, profile]);
      }

      // Set $SHELL as default
      const defaultShell = shells[0];
      if (defaultShell) {
        const defaultProfile = state.profiles.find((p) => p.shell === defaultShell);
        if (defaultProfile) {
          await setDefault(defaultProfile.id);
        }
      }
    }
  };

  const getDefaultProfile = (): ShellProfile | null => {
    if (state.defaultProfileId) {
      return state.profiles.find((p) => p.id === state.defaultProfileId) ?? null;
    }
    return state.profiles[0] ?? null;
  };

  const getProfile = (id: string): ShellProfile | null => {
    return state.profiles.find((p) => p.id === id) ?? null;
  };

  const addProfile = async (
    name: string,
    shell: string,
    args: string[],
    cwd: string | null,
    env: [string, string][]
  ) => {
    const profile = await createProfile(name, shell, args, cwd, env);
    setState("profiles", (prev) => [...prev, profile]);
  };

  const editProfile = async (
    id: string,
    name: string,
    shell: string,
    args: string[],
    cwd: string | null,
    env: [string, string][]
  ) => {
    const updated = await updateProfile(id, name, shell, args, cwd, env);
    setState("profiles", (prev) =>
      prev.map((p) => (p.id === id ? updated : p))
    );
  };

  const removeProfile = async (id: string) => {
    await deleteProfile(id);
    setState("profiles", (prev) => prev.filter((p) => p.id !== id));
  };

  const setDefault = async (id: string) => {
    await setDefaultProfile(id);
    setState("defaultProfileId", id);
  };

  return {
    state,
    load,
    initProfiles,
    getDefaultProfile,
    getProfile,
    addProfile,
    editProfile,
    removeProfile,
    setDefault,
  };
}
