import { describe, it, expect, vi, beforeEach } from 'vitest';

const constructEvent = vi.fn();
vi.mock('@/lib/stripe/client', () => ({ getStripe: () => ({ webhooks: { constructEvent } }) }));
// vi.hoisted so the fn exists before the hoisted vi.mock factory references it
// (the factory reads it eagerly, unlike the lazily-called client mock).
const { mockHandleStripeEvent } = vi.hoisted(() => ({ mockHandleStripeEvent: vi.fn() }));
vi.mock('@/lib/stripe/webhook', () => ({ handleStripeEvent: mockHandleStripeEvent }));

import { POST } from './route';

function req(body: string, sig: string | null) {
  return new Request('https://app.test/api/stripe/webhook', {
    method: 'POST',
    headers: sig ? { 'stripe-signature': sig } : {},
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
});

describe('POST /api/stripe/webhook', () => {
  it('400s a missing signature', async () => {
    const res = await POST(req('{}', null));
    expect(res.status).toBe(400);
    expect(mockHandleStripeEvent).not.toHaveBeenCalled();
  });
  it('400s an invalid signature and does not dispatch', async () => {
    constructEvent.mockImplementation(() => { throw new Error('bad sig'); });
    const res = await POST(req('{}', 'sig'));
    expect(res.status).toBe(400);
    expect(mockHandleStripeEvent).not.toHaveBeenCalled();
  });
  it('200s a valid event and dispatches it', async () => {
    const event = { type: 'checkout.session.completed' };
    constructEvent.mockReturnValue(event);
    mockHandleStripeEvent.mockResolvedValue(undefined);
    const res = await POST(req('{"x":1}', 'sig'));
    expect(res.status).toBe(200);
    expect(constructEvent).toHaveBeenCalledWith('{"x":1}', 'sig', 'whsec_test');
    expect(mockHandleStripeEvent).toHaveBeenCalledWith(event);
  });
  it('500s (so Stripe retries) when the handler throws', async () => {
    constructEvent.mockReturnValue({ type: 'checkout.session.completed' });
    mockHandleStripeEvent.mockRejectedValue(new Error('db down'));
    const res = await POST(req('{}', 'sig'));
    expect(res.status).toBe(500);
  });
});
