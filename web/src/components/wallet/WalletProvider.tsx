"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NEAR_CONFIG } from "@/lib/near";

// Minimal shared wallet context used by both the landing and app top bars.
// Real integration: @near-wallet-selector/core + modal-ui on NEAR testnet.
// Everything is client-side only and window-guarded; the modal + selector are
// dynamically imported so SSR / static build never touches them.

type Network = "testnet" | "mainnet";

// A single NEAR FunctionCall action, in the shape wallet-selector expects.
export interface FunctionCallAction {
  type: "FunctionCall";
  params: {
    methodName: string;
    args: Record<string, unknown>;
    gas: string;
    deposit: string;
  };
}

// Minimal outcome we read back — the final tx hash lives at transaction.hash.
export interface SignedTxOutcome {
  transaction?: { hash?: string };
  transaction_outcome?: { id?: string };
}

interface WalletContextValue {
  accountId: string | null;
  connecting: boolean;
  ready: boolean;
  isStub: boolean;
  signIn: () => void;
  signOut: () => void;
  // Wallet-signed call. Throws if no real wallet is connected (stub mode) or if
  // the user rejects. Returns the raw outcome (tx hash under transaction.hash).
  signAndSendTransaction: (opts: {
    receiverId: string;
    actions: FunctionCallAction[];
  }) => Promise<SignedTxOutcome>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const CONTRACT_ID = NEAR_CONFIG.coordinatorId;
const NETWORK = (NEAR_CONFIG.network as Network) ?? "testnet";

// The wallet-selector surface we touch, kept loose so we never depend on its
// exact generated types (which vary across minor versions).
type Selector = {
  store: {
    getState: () => { accounts: Array<{ accountId: string; active: boolean }> };
    observable: { subscribe: (fn: () => void) => { unsubscribe?: () => void } };
  };
  wallet: () => Promise<{
    signOut: () => Promise<void>;
    signAndSendTransaction: (opts: {
      receiverId: string;
      actions: FunctionCallAction[];
    }) => Promise<SignedTxOutcome>;
  }>;
};
type Modal = { show: () => void };
type Subscription = { unsubscribe?: () => void };

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [ready, setReady] = useState(false);
  const [isStub, setIsStub] = useState(false);

  const selectorRef = useRef<Selector | null>(null);
  const modalRef = useRef<Modal | null>(null);
  const subRef = useRef<Subscription | null>(null);

  // Lazily set up the wallet selector on the client after mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      try {
        const [{ setupWalletSelector }, { setupModal }, myNear, meteor] =
          await Promise.all([
            import("@near-wallet-selector/core"),
            import("@near-wallet-selector/modal-ui"),
            import("@near-wallet-selector/my-near-wallet"),
            import("@near-wallet-selector/meteor-wallet"),
          ]);

        const selector = (await setupWalletSelector({
          network: NETWORK,
          modules: [myNear.setupMyNearWallet(), meteor.setupMeteorWallet()],
        })) as unknown as Selector;
        if (cancelled) return;

        const modal = setupModal(
          selector as unknown as Parameters<typeof setupModal>[0],
          { contractId: CONTRACT_ID }
        ) as unknown as Modal;
        selectorRef.current = selector;
        modalRef.current = modal;

        const syncFromState = () => {
          const accounts = selector.store.getState().accounts;
          const active = accounts.find((a) => a.active) ?? accounts[0] ?? null;
          setAccountId(active ? active.accountId : null);
        };

        syncFromState();
        subRef.current = selector.store.observable.subscribe(syncFromState);
        setReady(true);
      } catch (err) {
        // Genuine attempt failed (SSR/resolution issue) -> clean functional
        // stub. TODO(wallet): resolve real selector setup if this path is hit.
        if (cancelled) return;
        console.warn("[wallet] selector setup failed, using stub:", err);
        setIsStub(true);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      subRef.current?.unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(() => {
    if (isStub || !modalRef.current) {
      // Stub fallback: simulate a connected testnet account.
      setConnecting(true);
      setTimeout(() => {
        setAccountId("demo.mandate-arthur.testnet");
        setConnecting(false);
        setIsStub(true);
      }, 300);
      return;
    }
    modalRef.current.show();
  }, [isStub]);

  const signOut = useCallback(async () => {
    if (isStub || !selectorRef.current) {
      setAccountId(null);
      return;
    }
    try {
      const wallet = await selectorRef.current.wallet();
      await wallet.signOut();
    } catch (err) {
      console.warn("[wallet] signOut failed:", err);
    }
    setAccountId(null);
  }, [isStub]);

  const signAndSendTransaction = useCallback(
    async (opts: {
      receiverId: string;
      actions: FunctionCallAction[];
    }): Promise<SignedTxOutcome> => {
      if (isStub || !selectorRef.current) {
        throw new Error(
          "No NEAR wallet connected — connect a real testnet wallet to sign on-chain."
        );
      }
      const wallet = await selectorRef.current.wallet();
      return wallet.signAndSendTransaction(opts);
    },
    [isStub]
  );

  return (
    <WalletContext.Provider
      value={{
        accountId,
        connecting,
        ready,
        isStub,
        signIn,
        signOut,
        signAndSendTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
