export async function readLineQuota(token: string, request: typeof fetch = fetch) {
  const read = async (path: string) => {
    const response = await request(`https://api.line.me/v2/bot/message/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`LINE ${path} [${response.status}]: ${text}`);
    return JSON.parse(text);
  };
  const [quota, consumption] = await Promise.all([read('quota'), read('quota/consumption')]);
  if (!['limited', 'none'].includes(quota?.type) || !Number.isFinite(consumption?.totalUsage) || consumption.totalUsage < 0 ||
      (quota.type === 'limited' && (!Number.isFinite(quota.value) || quota.value < 0))) {
    throw new Error('LINE quota response incomplete');
  }
  return { quota, consumption };
}