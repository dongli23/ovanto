export type ContentSafetyRouteTestState = {
  verdict: unknown;
  scanError: boolean;
  scanCalls: number;
  lastScanParams: unknown;
  turnstileCalls: number;
  redisCalls: number;
  reserveCalls: number;
  releaseCalls: number;
  updateCalls: number;
  auditCalls: number;
  providerCalls: number;
  startPaidCalls: number;
  balancesCalls: number;
  freeQuota: number;
  paidBalance: number;
};

export const routeTestState: ContentSafetyRouteTestState = {
  verdict: {
    action: "allow",
    reasonCode: "allowed",
    matchedCategories: [],
    requestId: "route-test-request",
    semanticStatus: "scored",
  },
  scanError: false,
  scanCalls: 0,
  lastScanParams: null,
  turnstileCalls: 0,
  redisCalls: 0,
  reserveCalls: 0,
  releaseCalls: 0,
  updateCalls: 0,
  auditCalls: 0,
  providerCalls: 0,
  startPaidCalls: 0,
  balancesCalls: 0,
  freeQuota: 3,
  paidBalance: 2,
};

export function resetRouteTestState(): void {
  routeTestState.verdict = {
    action: "allow",
    reasonCode: "allowed",
    matchedCategories: [],
    requestId: "route-test-request",
    semanticStatus: "scored",
  };
  routeTestState.scanError = false;
  routeTestState.scanCalls = 0;
  routeTestState.lastScanParams = null;
  routeTestState.turnstileCalls = 0;
  routeTestState.redisCalls = 0;
  routeTestState.reserveCalls = 0;
  routeTestState.releaseCalls = 0;
  routeTestState.updateCalls = 0;
  routeTestState.auditCalls = 0;
  routeTestState.providerCalls = 0;
  routeTestState.startPaidCalls = 0;
  routeTestState.balancesCalls = 0;
  routeTestState.freeQuota = 3;
  routeTestState.paidBalance = 2;
}

export function setRouteTestVerdict(verdict: unknown): void {
  routeTestState.verdict = verdict;
  routeTestState.scanError = false;
}

export function setRouteTestScanError(value: boolean): void {
  routeTestState.scanError = value;
}
