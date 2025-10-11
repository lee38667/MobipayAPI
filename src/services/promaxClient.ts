import axios from 'axios';
import { getPromaxApiKey, getPromaxBaseUrl, getPromaxTimeout, getPromaxBouquetCacheTtl } from '../config';

type DeviceInfoParams = { account: string; type: 'mag' | 'm3u' | 'auto'; password?: string };
type BouquetCache = { data: Array<{ id: number; name: string }>; expiresAt: number } | null;

let bouquetCache: BouquetCache = null;

export const promaxClient = {
  async deviceInfo(params: DeviceInfoParams): Promise<any | null> {
    // Simplified heuristic: try username then mac based on characters
    const isMac = params.account.includes(':');
  const query: Record<string, string> = { action: 'device_info', api_key: getPromaxApiKey() };
    if (params.password) {
      query['password'] = params.password;
    }
    if (params.type === 'mag' || (params.type === 'auto' && isMac)) query['mac'] = params.account;
    else query['username'] = params.account;
    try {
  const { data } = await axios.get(getPromaxBaseUrl(), { params: query, timeout: getPromaxTimeout() });
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
  const { data } = await axios.get(getPromaxBaseUrl(), { params: { action: 'new', type: input.device_type, sub: 1, pack: input.pack_id, notes: 'trial_via_mobipay', api_key: getPromaxApiKey() }, timeout: getPromaxTimeout() });
      if (!data || data.status === false) throw Object.assign(new Error('Promax failure'), { upstream: 'promax' });
      return { user_id: String(data.user_id || ''), username: data.username, password: data.password };
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async createUser(input: { account: string; months: number; }): Promise<any> {
    try {
  const { data } = await axios.get(getPromaxBaseUrl(), { params: { action: 'new', type: 'm3u', sub: input.months, api_key: getPromaxApiKey() }, timeout: getPromaxTimeout() });
      return data;
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async renewUser(input: { username: string; months: number; password?: string; }): Promise<any> {
    try {
  const params: Record<string, string | number> = { action: 'renew', type: 'm3u', username: input.username, sub: input.months, api_key: getPromaxApiKey() };
  if (input.password) params['password'] = input.password;
  const { data } = await axios.get(getPromaxBaseUrl(), { params, timeout: getPromaxTimeout() });
      return data;
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async extendLineSubscription(input: { username: string; password: string; months: number; }): Promise<any> {
    try {
  const params = { action: 'renew', type: 'm3u', username: input.username, password: input.password, sub: input.months, api_key: getPromaxApiKey() };
  const { data } = await axios.get(getPromaxBaseUrl(), { params, timeout: getPromaxTimeout() });
      return data;
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async lineClientInfo(input: { username?: string; password: string; mac?: string; }): Promise<any> {
    try {
  const params: Record<string, string> = { action: 'device_info', api_key: getPromaxApiKey(), password: input.password };
      if (input.mac) params['mac'] = input.mac;
      if (input.username) params['username'] = input.username;
  const { data } = await axios.get(getPromaxBaseUrl(), { params, timeout: getPromaxTimeout() });
      return data;
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async enableDevice(input: { username: string; }): Promise<any> {
    try {
      const { data } = await axios.get(getPromaxBaseUrl(), { params: { action: 'device_status', username: input.username, status: 'enable', api_key: getPromaxApiKey() }, timeout: getPromaxTimeout() });
      return data;
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  },

  async bouquets(): Promise<Array<{ id: number; name: string }>> {
    const now = Date.now();
    if (bouquetCache && bouquetCache.expiresAt > now) {
      return bouquetCache.data;
    }
    try {
      const { data } = await axios.get(getPromaxBaseUrl(), { params: { action: 'bouquet', public: 1, api_key: getPromaxApiKey() }, timeout: getPromaxTimeout() });
      if (!data || data.status === false) throw new Error('Promax failure');
      const transformed = (data.items || []).map((x: any) => ({ id: Number(x.id), name: String(x.name) }));
      const ttl = getPromaxBouquetCacheTtl();
      bouquetCache = { data: transformed, expiresAt: now + ttl };
      return transformed;
    } catch (e) {
      throw Object.assign(new Error('Promax unavailable'), { upstream: 'promax' });
    }
  }
};
