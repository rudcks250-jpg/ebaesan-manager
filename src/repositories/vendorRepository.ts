import { storage, STORAGE_KEYS } from '@/data/storage';
import { supabase } from '@/lib/supabaseClient';
import type { Vendor, VendorItem } from '@/data/types';

interface VendorRow {
  id: string;
  data: Vendor;
  updated_at: string;
  deleted_at?: string | null;
}

const isMissingTable = (error: { code?: string; message?: string } | null) =>
  error?.code === '42P01' || error?.code === 'PGRST205' || error?.message?.includes('order_vendors');

function readLocal(): Vendor[] {
  return storage.get<Vendor[]>(STORAGE_KEYS.vendors) ?? [];
}

function writeLocal(vendors: Vendor[]): void {
  storage.set(STORAGE_KEYS.vendors, vendors);
}

function normalize(row: VendorRow): Vendor {
  return { ...row.data, id: row.id, updatedAt: row.updated_at ?? row.data.updatedAt };
}

function mergeItems(shared: VendorItem[] = [], local: VendorItem[] = []): VendorItem[] {
  const ids = new Set(shared.map((item) => item.id));
  return [...shared, ...local.filter((item) => !ids.has(item.id))];
}

function mergeLegacyOnce(shared: Vendor[], local: Vendor[], deletedIds: Set<string>): Vendor[] {
  const localById = new Map(local.map((vendor) => [vendor.id, vendor]));
  const sharedIds = new Set(shared.map((vendor) => vendor.id));
  return [
    ...shared.map((vendor) => {
      const old = localById.get(vendor.id);
      if (!old) return vendor;
      return {
        ...vendor,
        contactName: vendor.contactName || old.contactName,
        phone: vendor.phone || old.phone,
        items: mergeItems(vendor.items, old.items),
      };
    }),
    ...local.filter((vendor) => !sharedIds.has(vendor.id) && !deletedIds.has(vendor.id)),
  ];
}

async function saveShared(vendor: Vendor, updatedBy: string): Promise<Vendor> {
  const savedAt = new Date().toISOString();
  const payload = { ...vendor, updatedAt: savedAt };
  let { data, error } = await supabase
    .from('order_vendors')
    .upsert({ id: vendor.id, data: payload, updated_by: updatedBy, deleted_at: null }, { onConflict: 'id' })
    .select('id,data,updated_at,deleted_at')
    .single();
  if (error?.code === '42703' && error.message.includes('deleted_at')) {
    const compatible = await supabase
      .from('order_vendors')
      .upsert({ id: vendor.id, data: payload, updated_by: updatedBy }, { onConflict: 'id' })
      .select('id,data,updated_at')
      .single();
    data = compatible.data as typeof data;
    error = compatible.error;
  }
  if (error) throw error;
  return normalize(data as VendorRow);
}

export const vendorRepository = {
  async findAll(updatedBy?: string): Promise<Vendor[]> {
    const local = readLocal();
    let result = await supabase.from('order_vendors').select('id,data,updated_at,deleted_at').order('created_at');
    if (result.error?.code === '42703' && result.error.message.includes('deleted_at')) {
      result = await supabase.from('order_vendors').select('id,data,updated_at').order('created_at') as typeof result;
    }
    if (result.error) {
      if (isMissingTable(result.error)) return local;
      throw result.error;
    }

    const allRows = (result.data ?? []) as VendorRow[];
    const deletedIds = new Set(allRows.filter((row) => row.deleted_at).map((row) => row.id));
    let shared = allRows.filter((row) => !row.deleted_at).map(normalize);
    if (allRows.length === 0 && local.length > 0 && updatedBy) {
      const initialized = await supabase.rpc('initialize_order_vendors', { p_vendors: local });
      if (initialized.error) {
        if (isMissingTable(initialized.error)) return local;
        throw initialized.error;
      }
      shared = ((initialized.data ?? []) as VendorRow[]).filter((row) => !row.deleted_at).map(normalize);
    }

    const migrated = storage.get<boolean>(STORAGE_KEYS.vendorSharedMigrated) === true;
    if (!migrated && shared.length > 0 && updatedBy) {
      const merged = mergeLegacyOnce(shared, local, deletedIds);
      const changed = merged.filter((vendor) => {
        const server = shared.find((item) => item.id === vendor.id);
        return !server || JSON.stringify(server.items ?? []) !== JSON.stringify(vendor.items ?? []) ||
          server.contactName !== vendor.contactName || server.phone !== vendor.phone;
      });
      if (changed.length > 0) {
        const saved = await Promise.all(changed.map((vendor) => saveShared(vendor, updatedBy)));
        const savedById = new Map(saved.map((vendor) => [vendor.id, vendor]));
        shared = merged.map((vendor) => savedById.get(vendor.id) ?? vendor);
      } else {
        shared = merged;
      }
      storage.set(STORAGE_KEYS.vendorSharedMigrated, true);
    }

    if (shared.length > 0) writeLocal(shared);
    return shared.length > 0 ? shared : local;
  },

  async findById(id: string, updatedBy?: string): Promise<Vendor | undefined> {
    return (await this.findAll(updatedBy)).find((vendor) => vendor.id === id);
  },

  async update(id: string, patch: Partial<Vendor>, updatedBy: string): Promise<Vendor | undefined> {
    const current = await this.findById(id, updatedBy);
    if (!current) return undefined;
    const saved = await saveShared({ ...current, ...patch }, updatedBy);
    const local = readLocal();
    const index = local.findIndex((vendor) => vendor.id === id);
    const next = index === -1 ? [...local, saved] : local.map((vendor) => vendor.id === id ? saved : vendor);
    writeLocal(next);
    return saved;
  },

  async create(vendor: Vendor, updatedBy: string): Promise<Vendor> {
    const saved = await saveShared(vendor, updatedBy);
    writeLocal([...readLocal().filter((item) => item.id !== saved.id), saved]);
    return saved;
  },

  async remove(id: string, updatedBy: string): Promise<void> {
    let { error } = await supabase
      .from('order_vendors')
      .update({ deleted_at: new Date().toISOString(), updated_by: updatedBy })
      .eq('id', id);
    if (error?.code === '42703' && error.message.includes('deleted_at')) {
      const compatible = await supabase.from('order_vendors').delete().eq('id', id);
      error = compatible.error;
    }
    if (error) throw error;
    writeLocal(readLocal().filter((vendor) => vendor.id !== id));
  },

  seedIfEmpty(seed: Vendor[]): void {
    if (readLocal().length === 0) writeLocal(seed);
  },

  subscribe(onChange: () => void): () => void {
    const channel = supabase
      .channel('shared-order-vendors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_vendors' }, onChange)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  },
};
