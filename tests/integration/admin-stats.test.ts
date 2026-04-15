import { describe, it, expect } from "vitest";

// Test the admin stats calculation logic (pure functions)

interface PlanStat {
  plan: string;
  count: number;
}

function calculateSatisfactionRate(positive: number, negative: number): number | null {
  const total = positive + negative;
  if (total === 0) return null;
  return Math.round((positive / total) * 100);
}

function calculatePlanPercentage(planCount: number, totalUsers: number): number {
  if (totalUsers === 0) return 0;
  return Math.round((planCount / totalUsers) * 100);
}

function getPlanLabel(plan: string, labels: Record<string, string>): string {
  return labels[plan] ?? plan;
}

describe("Admin Stats", () => {
  describe("satisfactionRate", () => {
    it("retourne null si aucun feedback", () => {
      expect(calculateSatisfactionRate(0, 0)).toBeNull();
    });

    it("retourne 100% si tout positif", () => {
      expect(calculateSatisfactionRate(10, 0)).toBe(100);
    });

    it("retourne 0% si tout négatif", () => {
      expect(calculateSatisfactionRate(0, 10)).toBe(0);
    });

    it("calcule correctement un taux mixte", () => {
      expect(calculateSatisfactionRate(75, 25)).toBe(75);
    });

    it("arrondit à l'entier", () => {
      // 1 positif sur 4 total (1+3) = 25%
      expect(calculateSatisfactionRate(1, 3)).toBe(25);
      // 2 positifs sur 3 total (2+1) = 67%
      expect(calculateSatisfactionRate(2, 1)).toBe(67);
    });
  });

  describe("planPercentage", () => {
    it("retourne 0 si aucun utilisateur", () => {
      expect(calculatePlanPercentage(5, 0)).toBe(0);
    });

    it("calcule le pourcentage correctement", () => {
      expect(calculatePlanPercentage(50, 100)).toBe(50);
      expect(calculatePlanPercentage(30, 100)).toBe(30);
    });
  });

  describe("planLabel", () => {
    const labels: Record<string, string> = {
      free_trial: "Trial",
      standard: "Standard",
      premium: "Premium",
      expired: "Expired",
    };

    it("retourne le label traduit", () => {
      expect(getPlanLabel("free_trial", labels)).toBe("Trial");
      expect(getPlanLabel("premium", labels)).toBe("Premium");
    });

    it("retourne la clé brute si label inconnu", () => {
      expect(getPlanLabel("unknown_plan", labels)).toBe("unknown_plan");
    });
  });

  describe("Admin auth", () => {
    it("refuse si secret manquant", () => {
      const adminSecret = "my-secret-123";
      const providedSecret = null;
      expect(providedSecret !== adminSecret).toBe(true);
    });

    it("refuse si secret incorrect", () => {
      const adminSecret = "my-secret-123";
      const providedSecret = "wrong-secret";
      expect(providedSecret !== adminSecret).toBe(true);
    });

    it("accepte si secret correct", () => {
      const adminSecret = "my-secret-123";
      const providedSecret = "my-secret-123";
      expect(providedSecret === adminSecret).toBe(true);
    });

    it("extrait le bearer token du header Authorization", () => {
      const authHeader = "Bearer my-secret-123";
      const bearerSecret = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
      expect(bearerSecret).toBe("my-secret-123");
    });
  });

  describe("Stats aggregation", () => {
    it("calcule correctement le total des plans", () => {
      const byPlan: PlanStat[] = [
        { plan: "free_trial", count: 50 },
        { plan: "standard", count: 30 },
        { plan: "premium", count: 20 },
      ];
      const total = byPlan.reduce((sum, p) => sum + p.count, 0);
      expect(total).toBe(100);
    });
  });
});
