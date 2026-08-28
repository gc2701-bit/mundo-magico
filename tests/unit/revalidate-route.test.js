/* app/api/revalidate/route.ts — Sprint 3, Task 3.2. Recibe el Database
 * Webhook de Supabase; rechaza sin el secreto correcto, revalida el tag
 * del catálogo cuando el secreto es válido.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { revalidateTag } from 'next/cache';
import { POST } from '../../app/api/revalidate/route.ts';
import { CATALOGO_TAG } from '../../lib/catalogo-server.ts';

function req(headers = {}) {
  const lower = {};
  Object.keys(headers).forEach((k) => { lower[k.toLowerCase()] = headers[k]; });
  return { headers: { get: (k) => lower[k.toLowerCase()] ?? null } };
}

describe('app/api/revalidate — POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVALIDATE_SECRET = 'el-secreto';
  });

  it('401 sin header de secreto — no revalida nada', async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('401 con secreto incorrecto — no revalida nada', async () => {
    const res = await POST(req({ 'x-revalidate-secret': 'lo-que-sea' }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("200 + revalidateTag(CATALOGO_TAG, 'max') con el secreto correcto", async () => {
    const res = await POST(req({ 'x-revalidate-secret': 'el-secreto' }));
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith(CATALOGO_TAG, 'max');
    expect(revalidateTag).toHaveBeenCalledTimes(1);
  });

  it('sin REVALIDATE_SECRET configurado en el entorno, cualquier secreto se rechaza', async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(req({ 'x-revalidate-secret': 'cualquiera' }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
