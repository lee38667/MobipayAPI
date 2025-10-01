import axios from 'axios';

const baseURL = process.env.PROMAX_BASE_URL || 'https://api.promax-dash.com/api.php';
const apiKey = process.env.PROMAX_API_KEY || '';

type DeviceInfoParams = { account: string; type: 'mag' | 'm3u' | 'auto' };

export const promaxClient = {
  async deviceInfo(params: DeviceInfoParams): Promise<any | null> {
    // Simplified heuristic: try username then mac based on characters
    const isMac = params.account.includes(':');
    const query: Record<string, string> = { action: 'device_info', api_key: apiKey };
    if (params.type === 'mag' || (params.type === 'auto' && isMac)) query['mac'] = params.account;
    else query['username'] = params.account;
    try {
      const { data } = await axios.get(baseURL, { params: query, timeout: 8000 });
      if (!data || data.status === false) return null;
      // Normalize a few fields
      return {
        username: data.username || params.account,
        user_id: String(data.user_id || ''),
        expire: data.expire || null,
        enabled: String(data.enabled ?? '1'),
        package_id: String(data.package_id || ''),
        bouquet_name: data.bouquet_name || ''
      };
    } catch {
      return null;
    }
  },

  async createTrial(input: { account_reference?: string; email: string; fullname?: string; device_type: 'm3u' | 'mag'; pack_id: number; trial_days?: number; }): Promise<{ user_id: string; username: string; password: string; }>{
    // For now, call `new` with minimal fields; in real use, add appropriate query params.
    try {
      const { data } = await axios.get(baseURL, { params: { action: 'new', type: input.device_type, sub: 1, pack: input.pack_id, notes: 'trial_via_mobipay', api_key: apiKey }, timeout: 8000 });
      if (!data || data.status === false) throw Object.assign(new Error('Promax failure'), { upstream: 'promax' });
      return { user_id: String(data.user_id || ''), username: data.username, password: data.password };
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async createUser(input: { account: string; months: number; }): Promise<any> {
    try {
      const { data } = await axios.get(baseURL, { params: { action: 'new', type: 'm3u', sub: input.months, api_key: apiKey }, timeout: 8000 });
      return data;
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async renewUser(input: { username: string; months: number; }): Promise<any> {
    try {
      const { data } = await axios.get(baseURL, { params: { action: 'renew', type: 'm3u', username: input.username, sub: input.months, api_key: apiKey }, timeout: 8000 });
      return data;
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async enableDevice(input: { username: string; }): Promise<any> {
    try {
      const { data } = await axios.get(baseURL, { params: { action: 'device_status', username: input.username, status: 'enable', api_key: apiKey }, timeout: 8000 });
      return data;
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async bouquets(): Promise<Array<{ id: number; name: string }>> {
    try {
      const { data } = await axios.get(baseURL, { params: { action: 'bouquet', public: 1, api_key: apiKey }, timeout: 8000 });
      if (!data || data.status === false) throw new Error('Promax failure');
      return (data.items || []).map((x: any) => ({ id: Number(x.id), name: String(x.name) }));
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  }
};
