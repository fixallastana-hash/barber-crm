'use client';

import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

type CompensationType = 'employee' | 'renter';
type RentType = 'fixed' | 'percentage';

type Compensation = {
  type?: CompensationType;
  baseSalaryKzt?: number;
  commissionPercent?: number;
  bonusKzt?: number;
  rentType?: RentType;
  fixedAmountKzt?: number;
  percentageOfRevenue?: number;
};

type Props = {
  masterId: string;
  masterName: string;
  masterType: string;
  onClose: () => void;
};

export default function EditMasterCompensationModal(props: Props) {
  const { masterId, masterName, masterType, onClose } = props;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [type, setType] = useState<CompensationType>('employee');
  const [baseSalaryKzt, setBaseSalaryKzt] = useState('0');
  const [commissionPercent, setCommissionPercent] = useState('0');
  const [bonusKzt, setBonusKzt] = useState('0');

  const [rentType, setRentType] = useState<RentType>('fixed');
  const [fixedAmountKzt, setFixedAmountKzt] = useState('0');
  const [percentageOfRevenue, setPercentageOfRevenue] = useState('0');

  useEffect(() => {
    let cancelled = false;

    setError('');
    setSaved(false);
    setLoading(true);

    setType(masterType === 'renter' ? 'renter' : 'employee');
    setBaseSalaryKzt('0');
    setCommissionPercent('0');
    setBonusKzt('0');
    setRentType('fixed');
    setFixedAmountKzt('0');
    setPercentageOfRevenue('0');

    (async () => {
      try {
        const getMasterCompensation = httpsCallable(
          getFirebaseFunctions(),
          'getMasterCompensation',
        );
        const result = await getMasterCompensation({ masterId });
        const data = result.data as {
          exists: boolean;
          compensation: Compensation | null;
        };

        if (cancelled) return;

        if (data.exists && data.compensation) {
          const c = data.compensation;

          if (c.type === 'renter') {
            setType('renter');
            setRentType(c.rentType === 'percentage' ? 'percentage' : 'fixed');
            setFixedAmountKzt(String(c.fixedAmountKzt || 0));
            setPercentageOfRevenue(String(c.percentageOfRevenue || 0));
          } else if (c.type === 'employee') {
            setType('employee');
            setBaseSalaryKzt(String(c.baseSalaryKzt || 0));
            setCommissionPercent(String(c.commissionPercent || 0));
            setBonusKzt(String(c.bonusKzt || 0));
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Не удалось загрузить компенсацию');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [masterId, masterType]);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const updateMasterCompensation = httpsCallable(
        getFirebaseFunctions(),
        'updateMasterCompensation',
      );

      const payload: Record<string, unknown> = {
        masterId,
        type,
      };

      if (type === 'employee') {
        payload.baseSalaryKzt = Number(baseSalaryKzt);
        payload.commissionPercent = Number(commissionPercent);
        payload.bonusKzt = Number(bonusKzt);
      } else {
        payload.rentType = rentType;
        if (rentType === 'fixed') {
          payload.fixedAmountKzt = Number(fixedAmountKzt);
        } else {
          payload.percentageOfRevenue = Number(percentageOfRevenue);
        }
      }

      await updateMasterCompensation(payload);

      setSaving(false);
      setSaved(true);

      window.setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить компенсацию');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Компенсация</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">{masterName}</p>

        {error && (
          <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Загрузка...</p>
        ) : (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm text-gray-700">Тип</legend>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="compType"
                    value="employee"
                    checked={type === 'employee'}
                    onChange={() => setType('employee')}
                  />
                  Сотрудник
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="compType"
                    value="renter"
                    checked={type === 'renter'}
                    onChange={() => setType('renter')}
                  />
                  Арендатор
                </label>
              </div>
            </fieldset>

            {type === 'employee' && (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm text-gray-700">Оклад, ₸</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={baseSalaryKzt}
                    onChange={(event) => setBaseSalaryKzt(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-700">Процент с выручки, %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={commissionPercent}
                    onChange={(event) => setCommissionPercent(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-700">Бонус, ₸</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={bonusKzt}
                    onChange={(event) => setBonusKzt(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                  />
                </label>
              </div>
            )}

            {type === 'renter' && (
              <div className="space-y-3">
                <fieldset>
                  <legend className="mb-2 text-sm text-gray-700">Тип аренды</legend>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="rentType"
                        value="fixed"
                        checked={rentType === 'fixed'}
                        onChange={() => setRentType('fixed')}
                      />
                      Фиксированная сумма
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="rentType"
                        value="percentage"
                        checked={rentType === 'percentage'}
                        onChange={() => setRentType('percentage')}
                      />
                      Процент от выручки
                    </label>
                  </div>
                </fieldset>

                {rentType === 'fixed' && (
                  <label className="block">
                    <span className="text-sm text-gray-700">Фиксированная аренда, ₸</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={fixedAmountKzt}
                      onChange={(event) => setFixedAmountKzt(event.target.value)}
                      className="mt-1 w-full rounded border px-3 py-2"
                    />
                  </label>
                )}

                {rentType === 'percentage' && (
                  <label className="block">
                    <span className="text-sm text-gray-700">Процент от выручки, %</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={percentageOfRevenue}
                      onChange={(event) => setPercentageOfRevenue(event.target.value)}
                      className="mt-1 w-full rounded border px-3 py-2"
                    />
                  </label>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              {saved && <span className="text-sm text-green-600">Сохранено</span>}
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || saved}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
