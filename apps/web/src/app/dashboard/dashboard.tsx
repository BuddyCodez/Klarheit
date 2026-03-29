"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Search, Settings, ShieldAlert, CreditCard, ChevronRight, LogOut } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const MOCK_TRANSACTIONS = [
  { id: "TX_99283", origin: "BERLIN, DE", amount: "€1,240.00", risk: 2, status: "VERIFIED" },
  { id: "TX_99284", origin: "LONDON, UK", amount: "£8,500.00", risk: 14, status: "PENDING" },
  { id: "TX_99285", origin: "PARIS, FR", amount: "€15,000.00", risk: 98, status: "FLAGGED" },
  { id: "TX_99286", origin: "MADRID, ES", amount: "€45.00", risk: 1, status: "VERIFIED" },
  { id: "TX_99287", origin: "WARSAW, PL", amount: "€2,100.00", risk: 8, status: "VERIFIED" },
];

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden font-sans selection:bg-primary selection:text-primary-foreground border-t border-border">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-card/10 flex flex-col justify-between">
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
            <span className="bg-destructive text-destructive-foreground text-[0.65rem] px-1.5 py-0.5 rounded font-mono">1</span>
          </button>
          <button
            className="w-full flex items-center px-3 py-2 text-sm rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <CreditCard className="w-4 h-4 mr-3" />
            Transactions
          </button>
          <button
            className="w-full flex items-center px-3 py-2 text-sm rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings className="w-4 h-4 mr-3" />
            System Rules
          </button>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between px-3 py-2 bg-background border border-border rounded">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">{session.user.name}</span>
              <span className="text-[0.65rem] text-muted-foreground font-mono uppercase">{(session.user as any).role || "AUDITOR"}</span>
            </div>
            <button onClick={() => authClient.signOut()} className="text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-background">
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
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <kbd className="font-sans text-[0.65rem] px-1.5 py-0.5 bg-muted rounded border border-border text-muted-foreground">⌘</kbd>
              <kbd className="font-sans text-[0.65rem] px-1.5 py-0.5 bg-muted rounded border border-border text-muted-foreground">K</kbd>
            </div>
          </div>
        </header>

        {/* Dynamic View */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium tracking-tight">Real-Time Ingestion Stream</h2>
                <div className="flex items-center gap-2 text-xs font-mono text-success">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  KAFKA_CONNECTED
                </div>
              </div>

              <div className="border border-border rounded bg-card overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground text-[0.65rem] uppercase tracking-widest font-mono">
                    <tr>
                      <th className="px-6 py-3 font-normal">Status</th>
                      <th className="px-6 py-3 font-normal">Transaction ID</th>
                      <th className="px-6 py-3 font-normal">Origin</th>
                      <th className="px-6 py-3 font-normal">Amount</th>
                      <th className="px-6 py-3 text-right font-normal">Risk Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-sm">
                    {MOCK_TRANSACTIONS.map((tx) => (
                      <tr
                        key={tx.id}
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
                        <td className="px-6 py-3.5 text-foreground/90">{tx.id}</td>
                        <td className="px-6 py-3.5 text-muted-foreground">{tx.origin}</td>
                        <td className="px-6 py-3.5 text-foreground/90">{tx.amount}</td>
                        <td className={`px-6 py-3.5 text-right ${tx.status === 'FLAGGED' ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                          {tx.risk}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
