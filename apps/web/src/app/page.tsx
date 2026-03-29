"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Activity, ShieldAlert, Database } from "lucide-react";

import { orpc } from "@/utils/orpc";

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

export default function Home() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <main className="container mx-auto px-6 py-12 lg:py-24 max-w-5xl">
        <header className="mb-16 border-b border-border pb-8 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <pre className="overflow-x-auto font-mono text-[0.65rem] md:text-xs text-muted-foreground leading-tight tracking-tighter hidden sm:block select-none opacity-40 mb-8">
              {TITLE_TEXT}
            </pre>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              Institutional Threat Intelligence
            </h1>
            <p className="text-muted-foreground mt-4 text-lg max-w-xl">
              High-frequency transaction monitoring and automated fraud resolution platform designed for European FinTech compliance.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-card border border-border">
              <div
                className={`h-2.5 w-2.5 rounded-full ${healthCheck.isLoading
                    ? "bg-muted-foreground animate-pulse"
                    : healthCheck.data
                      ? "bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                      : "bg-destructive shadow-[0_0_8px_rgba(225,29,72,0.5)]"
                  }`}
              />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {healthCheck.isLoading ? "SYS_CHECK" : healthCheck.data ? "SYS_ONLINE" : "SYS_DOWN"}
              </span>
            </div>
            <Link
              href="/dashboard"
              className="mt-2 flex items-center gap-2 text-sm font-medium bg-foreground text-background px-6 py-3 rounded transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              ACCESS TERMINAL
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 bg-card rounded border border-border flex flex-col gap-4 transition-colors hover:border-muted-foreground/50">
            <Activity className="h-6 w-6 text-muted-foreground" />
            <h3 className="font-medium text-lg">Real-Time Kafka Ingestion</h3>
            <p className="text-sm text-muted-foreground">
              Processing structured JSON payloads at millisecond latency. Every transaction is streamed and verified.
            </p>
          </div>
          <div className="p-6 bg-card rounded border border-border flex flex-col gap-4 transition-colors hover:border-destructive/50">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <h3 className="font-medium text-lg">Automated Rules Engine</h3>
            <p className="text-sm text-muted-foreground">
              Evaluating complex typologies like "Impossible Travel" flags and high-volume triggers instantly.
            </p>
          </div>
          <div className="p-6 bg-card rounded border border-border flex flex-col gap-4 transition-colors hover:border-muted-foreground/50">
            <Database className="h-6 w-6 text-muted-foreground" />
            <h3 className="font-medium text-lg">RabbitMQ Decoupling</h3>
            <p className="text-sm text-muted-foreground">
              Resilient message queuing for fraud alerts, ensuring zero dropped investigations during traffic spikes.
            </p>
          </div>
        </section>

        <section className="border-t border-border pt-16">
          <div className="max-w-2xl">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-8">System Rules</h2>
            <ul className="space-y-6 font-mono text-sm">
              <li className="flex gap-6">
                <span className="text-muted-foreground">01</span>
                <span className="text-foreground">Every transaction must be verified. No exceptions.</span>
              </li>
              <li className="flex gap-6">
                <span className="text-muted-foreground">02</span>
                <span className="text-foreground">Do not trust the source. Validate the signature.</span>
              </li>
              <li className="flex gap-6">
                <span className="text-destructive">03</span>
                <span className="text-foreground border-b border-destructive/30 inline-block pb-0.5">Connection lost. You are not your socket ID.</span>
              </li>
              <li className="flex gap-6">
                <span className="text-muted-foreground">04</span>
                <span className="text-foreground">GDPR Compliance: PII must flow like water and evaporate on command.</span>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
