import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe('API client', () => {
  it('keeps validated field issues so forms can display server errors inline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'Kode sudah digunakan.',
            issues: [{ field: 'code', message: 'Gunakan kode lain.' }, { invalid: true }],
          }),
          { status: 409 },
        ),
      ),
    );
    const { api } = await import('./api');
    await expect(api('catalog/items', { name: 'Test' })).rejects.toMatchObject({
      status: 409,
      issues: [{ field: 'code', message: 'Gunakan kode lain.' }],
    });
  });
  it('stores access only in memory and retries once after session refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'old', user: { id: 'user' } }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'new', user: { id: 'user' } }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { login, api } = await import('./api');
    await login('test@example.test', 'secret');
    expect(await api('catalog')).toEqual({ ok: true });
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('Bearer new');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
  });
  it('deduplicates simultaneous refresh calls and handles forbidden responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'new', user: { id: 'user' } }), { status: 201 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { restoreSession, api } = await import('./api');
    await Promise.all([restoreSession(), restoreSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    );
    await expect(api('entities')).rejects.toMatchObject({ status: 403, message: 'Forbidden' });
  });
});
