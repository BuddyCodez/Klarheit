"use client";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Activity, AlertTriangle, Search, Settings, ShieldAlert, CreditCard, ChevronRight, LogOut, Loader2, ArrowUpRight, Server, ArrowUpDown, ShieldCheck, XCircle } from "lucide-react";
import { io } from "socket.io-client";

import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";
import { useRouter } from "next/navigation";

// Type definitions for the incoming socket and ORPC data
type Transaction = {
  id: string;
  origin: string;
  amount: string | number;
  risk: number;
  status: "VERIFIED" | "FLAGGED" | "PENDING" | string;
  country?: string;
  currency?: string;
  timestamp?: string;
};

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [streamTxs, setStreamTxs] = useState<Transaction[]>([]);
  const [sessionAlertCount, setSessionAlertCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();
  // Derive Admin Access
  const isAdmin = (session.user as any).role === "ADMIN" || (session.user as any).role === "admin";
  // console.log(session.user);
  // Sorting state for tabular data
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });
  // Data fetching
  const { data: stats } = useQuery(orpc.getStats.queryOptions());
  const { data: historicalTxs, isLoading: isLoadingTxs } = useQuery(orpc.getTransactions.queryOptions());
  const { data: alertsData, isLoading: isLoadingAlerts } = useQuery(orpc.getAlerts.queryOptions());
  const { data: systemRules, isLoading: isLoadingRules } = useQuery(orpc.getSystemRules.queryOptions());

  // Mutations
  const { mutate: reviewAlert, isPending: isReviewing } = useMutation(orpc.reviewAlert.mutationOptions());
  const { mutate: dismissAlert, isPending: isDismissing } = useMutation(orpc.dismissAlert.mutationOptions());
  const { mutate: toggleRule, isPending: isToggling } = useMutation(orpc.toggleRule.mutationOptions());
  const { mutate: updateConfig, isPending: isUpdatingConfig } = useMutation(orpc.updateRuleConfig.mutationOptions());

  const handleReview = (id: string) => {
    if (!isAdmin || isReviewing) return;
    reviewAlert({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.getAlerts.queryOptions().queryKey });
        queryClient.invalidateQueries({ queryKey: orpc.getTransactions.queryOptions().queryKey });
        queryClient.invalidateQueries({ queryKey: orpc.getStats.queryOptions().queryKey });
      }
    });
  }

  const handleDismiss = (id: string) => {
    if (!isAdmin || isDismissing) return;
    dismissAlert({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.getAlerts.queryOptions().queryKey });
        queryClient.invalidateQueries({ queryKey: orpc.getTransactions.queryOptions().queryKey });
        queryClient.invalidateQueries({ queryKey: orpc.getStats.queryOptions().queryKey });
      }
    });
  }

  const handleToggle = (id: string, current: boolean) => {
    if (!isAdmin || isToggling) return;
    toggleRule({ id, active: !current }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.getSystemRules.queryOptions().queryKey });
      }
    });
  }

  const handleConfigUpdate = (id: string, newConfig: any) => {
    if (!isAdmin || isUpdatingConfig) return;
    updateConfig({ id, config: newConfig }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.getSystemRules.queryOptions().queryKey });
      }
    });
  }

  useEffect(() => {
    // Connect to the backend Socket.io server on port 3001
    const socket = io("http://localhost:3001");

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("new-transaction", (tx: any) => {
      const formattedAmount = typeof tx.amount === 'number'
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.currency || 'EUR' }).format(tx.amount)
        : tx.amount;

      const newTx: Transaction = {
        id: tx.id,
        origin: tx.country || "UNKNOWN",
        amount: formattedAmount,
        risk: tx.status === "FLAGGED" ? 100 : Math.floor(Math.random() * 10), // Mock risk for visual until ML is added
        status: tx.status,
        timestamp: new Date().toLocaleTimeString(),
      };

      setStreamTxs((prev) => [newTx, ...prev].slice(0, 50)); // Keep last 50

      // Patch the React Query cache inline safely
      try {
        queryClient.setQueryData(
          orpc.getTransactions.queryOptions().queryKey,
          (old: any) => {
            if (!old || !Array.isArray(old)) return old;
            return [newTx, ...old].slice(0, 100);
          }
        );

        queryClient.setQueryData(
          orpc.getStats.queryOptions().queryKey,
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              totalProcessed: old.totalProcessed + 1,
              totalVolume: old.totalVolume + parseFloat(tx.amount || 0)
            };
          }
        );
      } catch (e) {
        console.error("Failed to inline patch React Query cache:", e);
      }
    });

    socket.on("fraud-alert", (alert: any) => {
      setSessionAlertCount((prev) => prev + 1);
      // Update specific transaction status in the live stream array natively
      setStreamTxs((prev) => prev.map(t =>
        t.id === alert.transactionId ? { ...t, status: "FLAGGED", risk: 100 } : t
      ));

      try {
        queryClient.setQueryData(
          orpc.getStats.queryOptions().queryKey,
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              totalFlagged: old.totalFlagged + 1
            };
          }
        );

        // Invalidate human auditor queue dynamically
        queryClient.invalidateQueries({ queryKey: orpc.getAlerts.queryOptions().queryKey });
      } catch (e) {
        console.error("Failed to inline patch alerts cache:", e);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Prepopulate the stream with historical transactions so it isn't empty on load
  useEffect(() => {
    if (historicalTxs && historicalTxs.length > 0 && streamTxs.length === 0) {
      setStreamTxs(historicalTxs.slice(0, 50).map(tx => ({
        id: tx.id,
        origin: tx.country || "UNKNOWN",
        amount: formatCurrency(tx.amount),
        risk: tx.status === "FLAGGED" ? 100 : Math.floor(Math.random() * 10),
        status: tx.status,
        country: tx.country,
        currency: tx.currency,
        timestamp: new Date(tx.timestamp).toLocaleTimeString()
      })));
    }
  }, [historicalTxs, streamTxs.length]);

  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', notation: 'compact' }).format(num || 0);
  };

  const handleSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Reusable generic sorting logic
  const sortData = (data: any[] = []) => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'amount') {
        aVal = typeof aVal === 'string' ? parseFloat(aVal.replace(/[^0-9.-]+/g, "")) : aVal;
        bVal = typeof bVal === 'string' ? parseFloat(bVal.replace(/[^0-9.-]+/g, "")) : bVal;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedHistoricalTxs = useMemo(() => sortData(historicalTxs || []), [historicalTxs, sortConfig]);
  const sortedAlerts = useMemo(() => sortData(alertsData || []), [alertsData, sortConfig]);

  // Shared Table Header Component
  const SortableHeader = ({ label, sortKey, align = "left" }: { label: string, sortKey: keyof Transaction, align?: "left" | "right" }) => (
    <th className={`px-6 py-3 font-normal cursor-pointer hover:text-foreground transition-colors group ${align === "right" ? "text-right" : "text-left"}`} onClick={() => handleSort(sortKey)}>
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        <ArrowUpDown className={`w-3 h-3 opacity-50 group-hover:opacity-100 ${sortConfig?.key === sortKey ? 'text-primary opacity-100' : ''}`} />
      </div>
    </th>
  );

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden font-sans selection:bg-primary selection:text-primary-foreground border-t border-border">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-card/10 flex flex-col justify-between shrink-0">
        <nav className="p-4 space-y-1 mt-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center px-3 py-2 text-sm rounded transition-colors ${activeTab === 'overview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Activity className="w-4 h-4 mr-3" />
            Live Stream
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`w-full flex items-center px-3 py-2 text-sm rounded transition-colors justify-between ${activeTab === 'alerts' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <div className="flex items-center">
              <AlertTriangle className="w-4 h-4 mr-3" />
              Fraud Alerts
            </div>
            {sessionAlertCount > 0 && (
              <span className="bg-destructive text-destructive-foreground text-[0.65rem] px-1.5 py-0.5 rounded font-mono animate-pulse">
                {sessionAlertCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`w-full flex items-center px-3 py-2 text-sm rounded transition-colors ${activeTab === 'transactions' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <CreditCard className="w-4 h-4 mr-3" />
            Historical Ledger
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`w-full flex items-center px-3 py-2 text-sm rounded transition-colors ${activeTab === 'rules' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Settings className="w-4 h-4 mr-3" />
            Active Typologies
          </button>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between px-3 py-2 bg-background border border-border rounded">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{session.user.name}</span>
              <span className="text-[0.65rem] text-muted-foreground font-mono uppercase">
                {(session.user as any).role || "AUDITOR"}
              </span>
            </div>
            <button onClick={() => authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push("/login");
                }
              }
            })} className="text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
        {/* Top Navbar Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-background shrink-0">
          <div className="flex items-center text-sm text-muted-foreground">
            <span>Terminal</span>
            <ChevronRight className="w-4 h-4 mx-1" />
            <span className="text-foreground capitalize">{activeTab}</span>
          </div>

          <div className="relative w-64 lg:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search TX_ID or IBAN..."
              className="w-full bg-card border border-border rounded pl-9 pr-12 py-1.5 text-sm outline-none focus:border-muted-foreground transition-colors placeholder:text-muted-foreground"
            />
          </div>
        </header>

        {/* Scrollable Container Content */}
        <div className="flex-1 overflow-y-auto p-8 relative flex flex-col min-h-0">
          <div className="max-w-6xl mx-auto w-full space-y-6 flex-1 flex flex-col min-h-0">

            {/* Top Stat Cards visible across all tabs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
              <div className="p-6 bg-card border border-border rounded flex flex-col gap-2 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                <span className="text-sm font-medium text-muted-foreground relative z-10">Total Processed Vol</span>
                <div className="text-3xl font-mono tracking-tight text-foreground relative z-10">
                  {stats ? formatCurrency(stats.totalVolume) : <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center text-xs text-success mt-2 relative z-10">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  <span>Real-time Sync Active</span>
                </div>
              </div>
              <div className="p-6 bg-card border border-border rounded flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Total Transactions</span>
                <div className="text-3xl font-mono tracking-tight text-foreground">
                  {stats ? new Intl.NumberFormat().format(stats.totalProcessed) : <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="p-6 border border-border rounded flex flex-col gap-2 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                <span className="text-sm font-medium text-destructive">Flags Triggered</span>
                <div className="text-3xl font-mono tracking-tight text-destructive">
                  {stats ? new Intl.NumberFormat().format(stats.totalFlagged) : <Loader2 className="w-6 h-6 animate-spin text-destructive" />}
                </div>
              </div>
            </div>

            {/* TAB PANES */}

            {activeTab === "overview" && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h2 className="text-lg font-medium tracking-tight">Real-Time Ingestion Stream</h2>
                  <div className={`flex items-center gap-2 text-xs font-mono px-3 py-1 rounded border ${isConnected ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                    <div className={`w-2 h-2 rounded-full border ${isConnected ? 'bg-success animate-pulse border-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-destructive shadow-[0_0_8px_rgba(225,29,72,0.5)]'}`} />
                    {isConnected ? 'KAFKA_CONNECTED' : 'DISCONNECTED'}
                  </div>
                </div>

                <div className="border border-border rounded bg-card flex flex-col flex-1 min-h-0 overflow-hidden shadow-sm relative">
                  <div className="overflow-y-auto flex-1 h-full">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground text-[0.65rem] uppercase tracking-widest font-mono sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 font-normal">Status</th>
                          <th className="px-6 py-3 font-normal">Time</th>
                          <th className="px-6 py-3 font-normal">Transaction ID</th>
                          <th className="px-6 py-3 font-normal">Origin</th>
                          <th className="px-6 py-3 text-right font-normal">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono text-sm max-h-full">
                        {streamTxs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-20 text-center text-muted-foreground text-xs uppercase tracking-widest">
                              <Activity className="w-6 h-6 mx-auto mb-4 animate-pulse opacity-50 text-foreground" />
                              Listening to Kafka membrane...
                            </td>
                          </tr>
                        ) : streamTxs.map((tx, idx) => (
                          <tr
                            key={`${tx.id}-${idx}`}
                            className={`group transition-colors hover:bg-muted/30 ${tx.status === 'FLAGGED' ? 'border-l-2 border-l-destructive bg-destructive/5' : 'border-l-2 border-l-transparent'}`}
                          >
                            <td className="px-6 py-3.5">
                              <span className={`text-[0.65rem] p-1 px-1.5 rounded ${tx.status === 'VERIFIED' ? 'bg-success/10 text-success border border-success/20' :
                                tx.status === 'FLAGGED' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                  'bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20'
                                }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-muted-foreground">{tx.timestamp}</td>
                            <td className="px-6 py-3.5 text-foreground/90">{tx.id}</td>
                            <td className="px-6 py-3.5 text-muted-foreground">{tx.origin}</td>
                            <td className="px-6 py-3.5 text-right text-foreground/90">{tx.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "transactions" && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1 min-h-[400px]">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h2 className="text-lg font-medium tracking-tight">Historical Ledger</h2>
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground px-3 py-1 rounded border border-border bg-card">
                    <Server className="w-3.5 h-3.5" />
                    POSTGRES_VERIFIED
                  </div>
                </div>

                <div className="border border-border rounded bg-card flex flex-col flex-1 min-h-0 overflow-hidden shadow-sm relative">
                  {isLoadingTxs ? (
                    <div className="px-6 py-24 h-full w-full text-center text-muted-foreground flex flex-col items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin mb-4" />
                      <span className="text-xs uppercase tracking-widest font-mono">Querying Database...</span>
                    </div>
                  ) : (
                    <div className="overflow-y-auto flex-1 h-full">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/50 border-b border-border text-muted-foreground text-[0.65rem] uppercase tracking-widest font-mono sticky top-0 z-10 shadow-sm">
                          <tr>
                            <SortableHeader label="Status" sortKey="status" />
                            <SortableHeader label="Date" sortKey="timestamp" />
                            <SortableHeader label="Transaction ID" sortKey="id" />
                            <SortableHeader label="Origin" sortKey="country" />
                            <SortableHeader label="Amount" sortKey="amount" align="right" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-mono text-sm max-h-full">
                          {sortedHistoricalTxs?.map((tx) => (
                            <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-6 py-3">
                                <span className={`text-[0.65rem] p-1 px-1.5 rounded ${tx.status === 'VERIFIED' ? 'bg-success/10 text-success border border-success/20' :
                                  tx.status === 'FLAGGED' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                    'bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20'
                                  }`}>
                                  {tx.status}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-muted-foreground">{new Date(tx.timestamp || Date.now()).toLocaleString()}</td>
                              <td className="px-6 py-3 text-foreground/90">{tx.id}</td>
                              <td className="px-6 py-3 text-muted-foreground">{tx.country || "UNKNOWN"}</td>
                              <td className="px-6 py-3 text-right text-foreground/90">{formatCurrency(tx.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === "rules" && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium tracking-tight">Active Typologies & Models</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isLoadingRules ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground m-8 mx-auto col-span-2" />
                  ) : (
                    systemRules?.map((rule) => (
                      <div key={rule.id} className="p-6 bg-card border border-border rounded flex flex-col gap-4 group hover:border-muted-foreground/50 transition-colors shadow-sm relative">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-foreground">{rule.name}</h3>
                          <button
                            disabled={!isAdmin || isToggling}
                            onClick={() => handleToggle(rule.id, rule.active)}
                            title={!isAdmin ? "Admin privileges required" : "Toggle Rule"}
                            className={`text-[0.65rem] font-mono px-2 py-0.5 rounded border ${rule.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'} ${isAdmin ? 'hover:scale-105 transition-transform cursor-pointer' : 'opacity-70 cursor-not-allowed'}`}
                          >
                            {rule.active ? 'ACTIVE' : 'DISABLED'}
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{rule.description}</p>

                        {/* Configurable Thresholds */}
                        <div className="bg-muted/30 p-3 rounded border border-border/50 space-y-2">
                          <div className="flex items-center justify-between text-[0.65rem] font-mono uppercase text-muted-foreground mb-1">
                            <span>Parameters</span>
                            <Settings className="w-3 h-3" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Threshold:</span>
                            <input
                              type="number"
                              defaultValue={rule.config?.threshold}
                              disabled={!isAdmin || isUpdatingConfig}
                              onBlur={(e) => {
                                const val = Number(e.target.value);
                                if (val !== rule.config?.threshold) {
                                  handleConfigUpdate(rule.id, { ...rule.config, threshold: val });
                                }
                              }}
                              className="bg-background border border-border text-foreground text-xs rounded px-2 py-1 w-24 focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                            <span className="text-[0.65rem] text-muted-foreground">{rule.config?.unit}</span>
                          </div>
                        </div>

                        <div className="mt-2 pt-4 border-t border-border flex items-center justify-between text-[0.65rem] uppercase font-mono text-muted-foreground">
                          <span>Confidence: 99.9%</span>
                          <span className="bg-muted px-2 py-1 rounded truncate max-w-[100px]">{rule.id}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {activeTab === "alerts" && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1 min-h-[400px]">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h2 className="text-lg font-medium tracking-tight">Human-in-the-loop Investigation Queue</h2>
                  <div className="flex items-center gap-2 text-xs font-mono text-destructive px-3 py-1 rounded border border-destructive/20 bg-destructive/5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    REQUIRES ACTION
                  </div>
                </div>

                <div className="border border-border rounded bg-card flex flex-col flex-1 min-h-0 overflow-hidden shadow-sm relative">
                  {isLoadingAlerts ? (
                    <div className="px-6 py-24 h-full w-full text-center text-muted-foreground flex flex-col items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin mb-4" />
                      <span className="text-xs uppercase tracking-widest font-mono">Loading Auditor Queue...</span>
                    </div>
                  ) : sortedAlerts.length === 0 ? (
                    <div className="px-6 py-24 h-full w-full text-center text-muted-foreground flex flex-col items-center justify-center">
                      <ShieldCheck className="w-12 h-12 text-success/50 mb-4" />
                      <h3 className="text-lg font-medium text-success">Queue Clear</h3>
                      <p className="text-sm mt-2 max-w-sm font-sans">No pending fraudulent alerts require investigation at this time.</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto flex-1 h-full">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#121212] border-b border-border text-muted-foreground text-[0.65rem] uppercase tracking-widest font-mono sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-6 py-3 font-normal">State</th>
                            <SortableHeader label="Date" sortKey="timestamp" />
                            <SortableHeader label="Transaction ID" sortKey="id" />
                            <SortableHeader label="Origin" sortKey="country" />
                            <SortableHeader label="Amount" sortKey="amount" />
                            <th className="px-6 py-3 text-right font-normal">Auditor Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-mono text-sm">
                          {sortedAlerts?.map((tx) => (
                            <tr key={tx.id} className="hover:bg-muted/30 transition-colors border-l-2 border-l-destructive">
                              <td className="px-6 py-3">
                                <span className="text-[0.65rem] p-1 px-1.5 rounded bg-destructive text-destructive-foreground font-bold">
                                  CRITICAL
                                </span>
                              </td>
                              <td className="px-6 py-3 text-muted-foreground">{new Date(tx.timestamp || Date.now()).toLocaleString()}</td>
                              <td className="px-6 py-3 text-foreground">{tx.id}</td>
                              <td className="px-6 py-3 text-muted-foreground">{tx.country || "UNKNOWN"}</td>
                              <td className="px-6 py-3 text-foreground">{formatCurrency(tx.amount)}</td>
                              <td className="px-6 py-3 text-right">
                                <div className="flex items-center justify-end gap-2 font-sans">
                                  <button disabled={!isAdmin || isReviewing} onClick={() => handleReview(tx.id)} title={!isAdmin ? "Admin privileges required" : ""} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border hover:bg-muted transition-colors rounded text-foreground ${isAdmin ? 'bg-background border-border cursor-pointer' : 'bg-muted/30 border-border/50 opacity-50 cursor-not-allowed'}`}>
                                    <Search className="w-3.5 h-3.5" />
                                    {isReviewing ? 'Processing...' : 'Review'}
                                  </button>
                                  <button disabled={!isAdmin || isDismissing} onClick={() => handleDismiss(tx.id)} title={!isAdmin ? "Admin privileges required" : ""} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border transition-colors rounded ${isAdmin ? 'bg-destructive/10 border-destructive/20 hover:bg-destructive text-destructive hover:text-destructive-foreground cursor-pointer' : 'bg-muted/30 border-border/50 text-muted-foreground opacity-50 cursor-not-allowed'}`}>
                                    <XCircle className="w-3.5 h-3.5" />
                                    {isDismissing ? 'Processing...' : 'Dismiss'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
