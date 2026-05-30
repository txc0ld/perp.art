"use client";

/**
 * Mock wallet session - a tiny external store (no dependency) shared across the app
 * via useSyncExternalStore. Models connect/disconnect; persists to localStorage.
 * Swap for wagmi/viem when wiring real wallets (PRD §10.2 wallet connect).
 */
import { useSyncExternalStore } from "react";
import { CURRENT_USER } from "./mock-data";

export interface WalletState {
  connected: boolean;
  address: string | null;
  connector: string | null;
}

const KEY = "perpetual.wallet";
let state: WalletState = { connected: false, address: null, connector: null };

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    /* ignore */
  }
}
load();

function persist() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function connectWallet(connector = "MetaMask") {
  state = { connected: true, address: CURRENT_USER.address, connector };
  persist();
  emit();
}

export function disconnectWallet() {
  state = { connected: false, address: null, connector: null };
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): WalletState {
  return state;
}

const SERVER_SNAPSHOT: WalletState = { connected: false, address: null, connector: null };

export function useWallet(): WalletState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}
