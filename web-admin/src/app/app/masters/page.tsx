'use client';

import Link from 'next/link';

import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Branch = { id: string; name: string; isActive: boolean };
type Master = {
  id: string;
  name: string;
  whatsappNumber: string;
  primaryBranchId: string;
  type: string;
  isActive: boolean;
};

export default function MastersPage() {
  const { user } = useAuth();
  const [masters, setMasters] = useState<Master[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [primaryBranchId, setPrimaryBranchId] = useState('');
  const [type, setType] = useState<'employee' | 'renter'>('employee');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const db = getFirebaseDb();
      const [masterSnap, branchSnap] = await Promise.all([
        getDocs(collection(db, 'tenants', user.tenantId, 'masters')),
        getDocs(collection(db, 'tenants', user.tenantId, 'branches')),
      ]);
      setMasters(masterSnap.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Master, 'id'>),
      })));
      setBranches(branchSnap.docs
        .map((item) => ({ id: item.id, ...(item.data() as Omit<Branch, 'id'>) }))
        .filter((branch) => branch.isActive));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘РЎвЂљРЎРЉ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const createMaster = httpsCallable(getFirebaseFunctions(), 'createMaster');
      await createMaster({ name, whatsappNumber, primaryBranchId, type });
      setName('');
      setWhatsappNumber('');
      setPrimaryBranchId('');
      setType('employee');
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В°');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (masterId: string) => {
    if (!window.confirm('Р вЂќР ВµР В°Р С”РЎвЂљР С‘Р Р†Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В°?')) return;
    setError('');
    try {
      const deactivateMaster = httpsCallable(getFirebaseFunctions(), 'deactivateMaster');
      await deactivateMaster({ masterId });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р Т‘Р ВµР В°Р С”РЎвЂљР С‘Р Р†Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В°');
    }
  };

  if (loading) return <p>Р вЂ”Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В°...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Р СљР В°РЎРѓРЎвЂљР ВµРЎР‚Р В°</h1>
        <button type="button" onClick={() => setShowForm((value) => !value)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          {showForm ? 'Р С›РЎвЂљР СР ВµР Р…Р В°' : '+ Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В°'}
        </button>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 space-y-4 rounded-lg bg-white p-6 shadow">
          <label className="block">
            <span className="text-sm text-gray-700">Р ВР СРЎРЏ *</span>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)}
              required className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">WhatsApp Р Р…Р С•Р СР ВµРЎР‚ *</span>
            <input type="tel" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)}
              required className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Р С›РЎРѓР Р…Р С•Р Р†Р Р…Р С•Р в„– РЎвЂћР С‘Р В»Р С‘Р В°Р В»</span>
            <select value={primaryBranchId} onChange={(event) => setPrimaryBranchId(event.target.value)}
              className="mt-1 w-full rounded border px-3 py-2">
              <option value="">Р СњР Вµ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm text-gray-700">Р СћР С‘Р С— Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В°</legend>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input type="radio" name="masterType" value="employee" checked={type === 'employee'}
                  onChange={() => setType('employee')} />
                Р РЋР С•РЎвЂљРЎР‚РЎС“Р Т‘Р Р…Р С‘Р С”
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="masterType" value="renter" checked={type === 'renter'}
                  onChange={() => setType('renter')} />
                Р С’РЎР‚Р ВµР Р…Р Т‘Р В°РЎвЂљР С•РЎР‚
              </label>
            </div>
          </fieldset>
          <button type="submit" disabled={saving}
            className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Р РЋР С•Р В·Р Т‘Р В°Р Р…Р С‘Р Вµ...' : 'Р РЋР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В°'}
          </button>
        </form>
      )}

      {masters.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">
          Р СџР С•Р С”Р В° Р Р…Р ВµРЎвЂљ Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р С•Р Р†. Р вЂќР С•Р В±Р В°Р Р†РЎРЉРЎвЂљР Вµ Р С—Р ВµРЎР‚Р Р†Р С•Р С–Р С•.
        </div>
      ) : (
        <div className="divide-y rounded-lg bg-white shadow">
          {masters.map((master) => {
            const branchName = branches.find((branch) => branch.id === master.primaryBranchId)?.name || 'РІР‚вЂќ';
            return (
              <div key={master.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">
                    <Link href={'/app/masters/schedule?masterId=' + master.id} className="font-medium text-blue-600 hover:underline">{master.name}</Link> {!master.isActive && <span className="text-xs text-red-500">(Р Р…Р ВµР В°Р С”РЎвЂљР С‘Р Р†Р ВµР Р…)</span>}
                  </p>
                  <p className="text-sm text-gray-500">
                    {master.whatsappNumber} Р’В· {branchName} Р’В· {master.type === 'renter' ? 'Р С’РЎР‚Р ВµР Р…Р Т‘Р В°РЎвЂљР С•РЎР‚' : 'Р РЋР С•РЎвЂљРЎР‚РЎС“Р Т‘Р Р…Р С‘Р С”'}
                  </p>
                </div>
                {master.isActive && (
                  <button type="button" onClick={() => void handleDeactivate(master.id)}
                    className="text-sm text-red-600 hover:text-red-700">
                    Р вЂќР ВµР В°Р С”РЎвЂљР С‘Р Р†Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


