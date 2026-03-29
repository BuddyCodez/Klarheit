import type { RouterClient } from "@orpc/server";
import { z } from "zod";
import db from "@Klarheit/db";

import { protectedProcedure, publicProcedure } from "../index";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  getStats: protectedProcedure.handler(async () => {
    const totalProcessed = await db.transaction.count();
    const totalFlagged = await db.transaction.count({ where: { status: "FLAGGED" } });
    const volumeAgg = await db.transaction.aggregate({
      _sum: { amount: true }
    });

    return {
      totalProcessed,
      totalFlagged,
      totalVolume: Number(volumeAgg._sum.amount || 0),
    };
  }),
  getTransactions: protectedProcedure.handler(async ({ context }) => {
    const txs = await db.transaction.findMany({
      take: 100,
      orderBy: { timestamp: "desc" }
    });

    const isAdmin = context.session?.user.role === "ADMIN";

    return txs.map(tx => ({
      id: tx.id,
      amount: Number(tx.amount || 0),
      currency: tx.currency,
      country: tx.country,
      timestamp: tx.timestamp.toISOString(),
      senderId: isAdmin ? tx.senderId : tx.senderId.replace(/^(.{4}).+(.{4})$/, "$1 **** **** $2"),
      receiverId: isAdmin ? tx.receiverId : tx.receiverId.replace(/^(.{4}).+(.{4})$/, "$1 **** **** $2"),
      status: tx.status as string,
    }));
  }),
  getAlerts: protectedProcedure.handler(async ({ context }) => {
    const txs = await db.transaction.findMany({
      where: { status: "FLAGGED" },
      take: 50,
      orderBy: { timestamp: "desc" }
    });

    const isAdmin = context.session?.user.role === "ADMIN";

    return txs.map(tx => ({
      id: tx.id,
      amount: Number(tx.amount || 0),
      currency: tx.currency,
      country: tx.country,
      timestamp: tx.timestamp.toISOString(),
      senderId: isAdmin ? tx.senderId : tx.senderId.replace(/^(.{4}).+(.{4})$/, "$1 **** **** $2"),
      receiverId: isAdmin ? tx.receiverId : tx.receiverId.replace(/^(.{4}).+(.{4})$/, "$1 **** **** $2"),
      status: tx.status as string,
      risk: 100, // Explicitly flagged
    }));
  }),
  getSystemRules: protectedProcedure.handler(async () => {
    let rules = await db.systemRule.findMany({
      orderBy: { createdAt: "asc" }
    });

    const stableIds = ["fdb7378a-ab1c-4217-be36-1f67d7bfb2f2", "0494d5f0-77d0-4d66-8e6b-dbf1efcc4ae5", "acc10167-b908-4c11-8978-a9b0ec61b332"];
    const hasStableRules = rules.length > 0 && stableIds.every(id => rules.some(r => r.id === id));

    if (!hasStableRules) {
      // Auto-seed default rules with stable IDs provided by user
      for (const id of stableIds) {
        const existing = await db.systemRule.findUnique({ where: { id } });
        if (!existing) {
          if (id === "fdb7378a-ab1c-4217-be36-1f67d7bfb2f2") {
            await db.systemRule.create({ data: { id, name: "High Volume", description: "Flag transactions > €10,000", active: true, config: { threshold: 10000, unit: "EUR" } } });
          } else if (id === "0494d5f0-77d0-4d66-8e6b-dbf1efcc4ae5") {
            await db.systemRule.create({ data: { id, name: "Impossible Travel", description: "Different origin country within < 5 mins", active: true, config: { threshold: 5, unit: "minutes" } } });
          } else if (id === "acc10167-b908-4c11-8978-a9b0ec61b332") {
            await db.systemRule.create({ data: { id, name: "Velocity Threshold", description: "> 5 transactions in 1 minute", active: false, config: { threshold: 5, limit: 1, unit: "minute" } } });
          }
        }
      }
      rules = await db.systemRule.findMany({ orderBy: { createdAt: "asc" } });
    }

    return rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      active: rule.active,
      config: rule.config as any
    }));
  }),
  reviewAlert: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      if (context.session?.user.role !== "ADMIN") throw new Error("Unauthorized");
      await db.transaction.update({
        where: { id: input.id },
        data: { status: "REJECTED" } // Marks transaction permanently rejected
      });
      return { success: true };
    }),
  dismissAlert: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      if (context.session?.user.role !== "ADMIN") throw new Error("Unauthorized");
      await db.transaction.update({
        where: { id: input.id },
        data: { status: "VERIFIED" } // Clears flag, marks as safe
      });
      return { success: true };
    }),
  toggleRule: protectedProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .handler(async ({ input, context }) => {
      if (context.session?.user.role !== "ADMIN") throw new Error("Unauthorized");
      const rule = await db.systemRule.update({
        where: { id: input.id },
        data: { active: input.active }
      });
      return { success: true, active: rule.active };
    }),
  updateRuleConfig: protectedProcedure
    .input(z.object({ id: z.string(), config: z.any() }))
    .handler(async ({ input, context }) => {
      if (context.session?.user.role !== "ADMIN") throw new Error("Unauthorized");
      const rule = await db.systemRule.update({
        where: { id: input.id },
        data: { config: input.config }
      });
      return { success: true, config: rule.config };
    }),
  scrubUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input, context }) => {
      if (context.session?.user.role !== "ADMIN") throw new Error("Unauthorized");
      // GDPR: Nullify IDs but keep financial volume for reporting
      await db.transaction.updateMany({
        where: { OR: [{ senderId: input.userId }, { receiverId: input.userId }] },
        data: { senderId: "GDPR_SCRUBBED", receiverId: "GDPR_SCRUBBED" }
      });
      return { success: true };
    })
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
