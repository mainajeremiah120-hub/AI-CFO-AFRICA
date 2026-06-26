import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;

const STATUS_COLOR = {
  processed: 'bg-green-50 text-green-700 border border-green-200',
  draft:     'bg-gray-100 text-gray-600 border border-gray-200',
};

// ─── Shared print styles ─────────────────────────────────────────────────────
const PRINT_BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px}
  @media print{body{padding:10px}}
`;

// ─── Full payroll schedule print ─────────────────────────────────────────────
function printPayroll(run, payslips) {
  const month = MONTHS[(run.month || 1) - 1];
  const year  = run.year;

  // Always compute totals from the payslips array — never trust the run aggregate
  // fields, which may be missing when the run object comes from a cached old response.
  const T = payslips.reduce((a, p) => ({
    gross:   a.gross   + Number(p.gross_pay        || 0),
    paye:    a.paye    + Number(p.paye             || 0),
    nssf:    a.nssf    + Number(p.nssf             || 0),
    nhif:    a.nhif    + Number(p.nhif             || 0),
    housing: a.housing + Number(p.other_deductions || 0),
    ded:     a.ded     + Number(p.total_deductions || 0),
    net:     a.net     + Number(p.net_pay          || 0),
  }), { gross:0, paye:0, nssf:0, nhif:0, housing:0, ded:0, net:0 });

  // Derive housing levy from basic_salary if stored value is 0 (legacy run)
  const rows = payslips.map(p => {
    const gross   = Number(p.gross_pay        || 0);
    const paye    = Number(p.paye             || 0);
    const nssf    = Number(p.nssf             || 0);
    const nhif    = Number(p.nhif             || 0);
    const housing = Number(p.other_deductions || 0) || Math.round(gross * 0.015);
    const totalDed = paye + nssf + nhif + housing;
    const net     = gross - totalDed;
    return `<tr>
      <td>${p.employee_number || '—'}</td>
      <td>${p.full_name}</td>
      <td>${p.position || '—'}</td>
      <td class="num">${gross.toLocaleString()}</td>
      <td class="num">${paye.toLocaleString()}</td>
      <td class="num">${nssf.toLocaleString()}</td>
      <td class="num">${nhif.toLocaleString()}</td>
      <td class="num">${housing.toLocaleString()}</td>
      <td class="num">${totalDed.toLocaleString()}</td>
      <td class="num bold">${net.toLocaleString()}</td>
    </tr>`;
  }).join('');

  // Recompute corrected totals (with housing levy derived for legacy payslips)
  const TC = payslips.reduce((a, p) => {
    const g = Number(p.gross_pay || 0);
    const py = Number(p.paye || 0);
    const ns = Number(p.nssf || 0);
    const nh = Number(p.nhif || 0);
    const hs = Number(p.other_deductions || 0) || Math.round(g * 0.015);
    const d  = py + ns + nh + hs;
    return { gross: a.gross+g, paye: a.paye+py, nssf: a.nssf+ns,
             nhif: a.nhif+nh, housing: a.housing+hs, ded: a.ded+d, net: a.net+(g-d) };
  }, { gross:0, paye:0, nssf:0, nhif:0, housing:0, ded:0, net:0 });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Payroll — ${month} ${year}</title>
  <style>
    ${PRINT_BASE_CSS}
    h1{font-size:18px;font-weight:700;margin-bottom:2px}
    .sub{color:#555;font-size:12px;margin-bottom:16px}
    .meta{display:flex;gap:40px;margin-bottom:20px;padding:12px;background:#f5f5f5;border-radius:4px;flex-wrap:wrap}
    .meta div{display:flex;flex-direction:column}
    .meta span:first-child{font-size:10px;color:#777;margin-bottom:2px}
    .meta span:last-child{font-weight:700;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#a31b32;color:#fff;padding:6px 8px;text-align:left;font-size:10px;font-weight:600}
    th.num,td.num{text-align:right}
    td{padding:5px 8px;border-bottom:1px solid #e5e5e5;font-size:10px}
    tr:nth-child(even) td{background:#fafafa}
    .bold{font-weight:700}
    .totals td{background:#1e3a5f!important;color:#fff;font-weight:700;padding:7px 8px}
    .dboxes{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
    .dbox{flex:1;min-width:100px;background:#f5f5f5;border-radius:4px;padding:10px;text-align:center}
    .dbox .label{font-size:9px;color:#666;margin-bottom:3px}
    .dbox .val{font-size:14px;font-weight:700;color:#a31b32}
    .footer{margin-top:24px;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:8px;display:flex;justify-content:space-between}
  </style></head><body>
  <h1>Payroll Schedule</h1>
  <p class="sub">${month} ${year} &nbsp;&middot;&nbsp; Status: ${(run.status||'').toUpperCase()}</p>
  <div class="meta">
    <div><span>Period</span><span>${month} ${year}</span></div>
    <div><span>Employees</span><span>${payslips.length}</span></div>
    <div><span>Gross Payroll</span><span>KES ${TC.gross.toLocaleString()}</span></div>
    <div><span>Total Deductions</span><span>KES ${TC.ded.toLocaleString()}</span></div>
    <div><span>Net Pay</span><span>KES ${TC.net.toLocaleString()}</span></div>
  </div>
  <div class="dboxes">
    <div class="dbox"><div class="label">PAYE</div><div class="val">KES ${TC.paye.toLocaleString()}</div></div>
    <div class="dbox"><div class="label">NSSF</div><div class="val">KES ${TC.nssf.toLocaleString()}</div></div>
    <div class="dbox"><div class="label">NHIF / SHA</div><div class="val">KES ${TC.nhif.toLocaleString()}</div></div>
    <div class="dbox"><div class="label">Housing Levy (1.5%)</div><div class="val">KES ${TC.housing.toLocaleString()}</div></div>
  </div>
  <table><thead><tr>
    <th>EMP #</th><th>Name</th><th>Position</th>
    <th class="num">Gross (KES)</th><th class="num">PAYE</th><th class="num">NSSF</th>
    <th class="num">NHIF</th><th class="num">Hsg Levy</th><th class="num">Total Ded.</th><th class="num">Net Pay</th>
  </tr></thead><tbody>
    ${rows}
    <tr class="totals">
      <td colspan="3">TOTALS</td>
      <td class="num">${TC.gross.toLocaleString()}</td>
      <td class="num">${TC.paye.toLocaleString()}</td>
      <td class="num">${TC.nssf.toLocaleString()}</td>
      <td class="num">${TC.nhif.toLocaleString()}</td>
      <td class="num">${TC.housing.toLocaleString()}</td>
      <td class="num">${TC.ded.toLocaleString()}</td>
      <td class="num">${TC.net.toLocaleString()}</td>
    </tr>
  </tbody></table>
  <div class="footer">
    <span>Generated: ${new Date().toLocaleString('en-KE')}</span>
    <span>CONFIDENTIAL — For authorised personnel only</span>
  </div>
  <script>window.onload=()=>window.print();</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=1100,height=700');
  w.document.write(html);
  w.document.close();
}

// ─── Individual payslip print ─────────────────────────────────────────────────
function printPayslip(p, run) {
  const month = MONTHS[(run.month || 1) - 1];
  const year  = run.year;

  const gross   = Number(p.gross_pay        || p.basic_salary || 0);
  const paye    = Number(p.paye             || 0) || Math.round(gross * 0.20);
  const nssf    = Number(p.nssf             || 0) || 2160;
  const nhif    = Number(p.nhif             || 0) || (gross > 100000 ? 1700 : gross > 50000 ? 1200 : gross > 30000 ? 850 : 500);
  const housing = Number(p.other_deductions || 0) || Math.round(gross * 0.015);
  const totalDed = paye + nssf + nhif + housing;
  const net     = gross - totalDed;

  const row = (label, amount, color='#111') =>
    `<tr><td class="rl">${label}</td><td class="ra" style="color:${color}">${amount < 0 ? '-' : ''}KES ${Math.abs(amount).toLocaleString()}</td></tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Payslip — ${p.full_name} — ${month} ${year}</title>
  <style>
    ${PRINT_BASE_CSS}
    .header{background:#a31b32;color:#fff;padding:16px 20px;border-radius:6px 6px 0 0;margin-bottom:0}
    .header h1{font-size:20px;font-weight:700;letter-spacing:0.5px}
    .header p{font-size:11px;opacity:0.85;margin-top:4px}
    .card{background:#fff;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 6px 6px;padding:20px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
    .info-block p.label{font-size:9px;color:#888;margin-bottom:1px}
    .info-block p.val{font-size:12px;font-weight:600;color:#222}
    .divider{border:none;border-top:1px solid #eee;margin:16px 0}
    .tables{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#666;margin-bottom:8px}
    table{width:100%;border-collapse:collapse}
    td{padding:5px 0;font-size:11px;border-bottom:1px solid #f5f5f5}
    td.rl{color:#555}
    td.ra{text-align:right;font-weight:600}
    .net-box{background:#f0f9f0;border:2px solid #22c55e;border-radius:6px;padding:14px 20px;margin-top:20px;display:flex;justify-content:space-between;align-items:center}
    .net-box .nl{font-size:13px;font-weight:700;color:#15803d}
    .net-box .nv{font-size:22px;font-weight:700;color:#15803d}
    .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:28px}
    .sig-line{border-top:1px solid #999;padding-top:4px;font-size:9px;color:#888;text-align:center}
    .footer-note{font-size:9px;color:#bbb;text-align:center;margin-top:20px;border-top:1px solid #f0f0f0;padding-top:8px}
    @media print{.no-print{display:none}}
  </style></head><body>
  <div class="header">
    <h1>Employee Payslip</h1>
    <p>Pay Period: ${month} ${year} &nbsp;&middot;&nbsp; Issued: ${new Date().toLocaleDateString('en-KE')}</p>
  </div>
  <div class="card">
    <div class="grid2">
      <div>
        <div class="info-block" style="margin-bottom:10px">
          <p class="label">Employee Name</p>
          <p class="val" style="font-size:15px">${p.full_name}</p>
        </div>
        <div class="grid2" style="gap:10px">
          <div class="info-block"><p class="label">Employee #</p><p class="val">${p.employee_number || '—'}</p></div>
          <div class="info-block"><p class="label">Position</p><p class="val">${p.position || '—'}</p></div>
          <div class="info-block"><p class="label">Department</p><p class="val">${p.department || '—'}</p></div>
          <div class="info-block"><p class="label">Bank Account</p><p class="val">${p.bank_account || '—'}</p></div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="info-block" style="margin-bottom:10px">
          <p class="label">Pay Period</p>
          <p class="val" style="font-size:15px">${month} ${year}</p>
        </div>
        <div class="info-block" style="margin-bottom:8px"><p class="label">Status</p><p class="val" style="color:#16a34a">${(run.status||'').toUpperCase()}</p></div>
        <div class="info-block"><p class="label">Payment Method</p><p class="val">Bank Transfer</p></div>
      </div>
    </div>

    <hr class="divider"/>

    <div class="tables">
      <div>
        <p class="section-title">Earnings</p>
        <table>
          ${row('Basic Salary', gross, '#1e40af')}
          ${row('Gross Pay', gross, '#1e40af')}
        </table>
      </div>
      <div>
        <p class="section-title">Statutory Deductions</p>
        <table>
          ${row('PAYE (Income Tax)', paye, '#dc2626')}
          ${row('NSSF (Pension)', nssf, '#dc2626')}
          ${row('NHIF / SHA (Health)', nhif, '#dc2626')}
          ${row('Housing Levy (1.5%)', housing, '#dc2626')}
          <tr style="border-top:2px solid #eee">
            <td class="rl" style="font-weight:700;padding-top:8px">Total Deductions</td>
            <td class="ra" style="color:#dc2626;font-weight:700;padding-top:8px">KES ${totalDed.toLocaleString()}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="net-box">
      <span class="nl">NET PAY (Amount to be paid)</span>
      <span class="nv">KES ${net.toLocaleString()}</span>
    </div>

    <div class="sigs">
      <div class="sig-line">Employee Signature</div>
      <div class="sig-line">HR / Payroll Officer</div>
      <div class="sig-line">Finance Director</div>
    </div>

    <p class="footer-note">This payslip is computer-generated. CONFIDENTIAL — ${p.full_name} only.</p>
  </div>
  <script>window.onload=()=>window.print();</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=720,height=680');
  w.document.write(html);
  w.document.close();
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Payroll() {
  const [tab, setTab]           = useState('overview');
  const [employees, setEmployees] = useState([]);
  const [runs, setRuns]         = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const [expandedRunId, setExpandedRunId]     = useState(null);
  const [payslips, setPayslips]               = useState({});
  const [loadingPayslips, setLoadingPayslips] = useState(false);

  const [rates, setRates] = useState({
    paye_rate: 0.20, nssf_amount: 2160, housing_levy_rate: 0.015,
    nhif_brackets: [
      { min_salary: 0, max_salary: 15000, amount: 150 },
      { min_salary: 15001, max_salary: 30000, amount: 500 },
      { min_salary: 30001, max_salary: 50000, amount: 850 },
      { min_salary: 50001, max_salary: 100000, amount: 1200 },
      { min_salary: 100001, max_salary: null, amount: 1700 },
    ],
  });

  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [empForm, setEmpForm] = useState({
    employee_number:'', full_name:'', email:'', phone:'',
    position:'', department:'', basic_salary:'', bank_account:''
  });
  const [runForm, setRunForm] = useState({
    month: new Date().getMonth() + 1,
    year:  new Date().getFullYear()
  });

  useEffect(() => {
    fetchSummary();
    API.get('/settings/statutory-rates').then(r => setRates(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    if (tab === 'employees') fetchEmployees();
    if (tab === 'runs')      fetchRuns();
  }, [tab]);

  const fetchSummary   = async () => {
    try { setSummary((await API.get('/payroll/summary')).data); }
    catch { setError('Failed to load summary'); }
  };
  const fetchEmployees = async () => {
    try { setEmployees((await API.get('/payroll/employees')).data); }
    catch { setError('Failed to load employees'); }
  };
  const fetchRuns = async () => {
    try { setRuns((await API.get('/payroll/runs')).data); }
    catch { setError('Failed to load runs'); }
  };

  const fetchPayslipsForRun = async (runId) => {
    if (payslips[runId]) return payslips[runId];
    setLoadingPayslips(true);
    try {
      const data = (await API.get(`/payroll/runs/${runId}/payslips`)).data;
      setPayslips(prev => ({ ...prev, [runId]: data }));
      return data;
    } catch { setError('Failed to load payslips'); return []; }
    finally { setLoadingPayslips(false); }
  };

  const toggleRun = async (runId) => {
    if (expandedRunId === runId) { setExpandedRunId(null); return; }
    setExpandedRunId(runId);
    await fetchPayslipsForRun(runId);
  };

  // ── Employee handlers ──────────────────────────────────
  const resetEmpForm = () => setEmpForm({
    employee_number:'', full_name:'', email:'', phone:'',
    position:'', department:'', basic_salary:'', bank_account:''
  });

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = { ...empForm, basic_salary: Number(empForm.basic_salary) };
      if (editingEmployeeId) {
        await API.put(`/payroll/employees/${editingEmployeeId}`, payload);
        setSuccess('Employee updated'); setEditingEmployeeId(null);
      } else {
        await API.post('/payroll/employees', payload);
        setSuccess('Employee added');
      }
      resetEmpForm(); fetchEmployees(); fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Failed to save employee'); }
    finally { setLoading(false); }
  };

  const handleEditEmployee = (emp) => {
    setEditingEmployeeId(emp.id);
    setEmpForm({
      employee_number: emp.employee_number || '',
      full_name:  emp.full_name,
      email:      emp.email || '',
      phone:      emp.phone || '',
      position:   emp.position || '',
      department: emp.department || '',
      basic_salary: String(emp.basic_salary),
      bank_account: emp.bank_account || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Delete this employee? They will be deactivated.')) return;
    setError('');
    try {
      await API.delete(`/payroll/employees/${id}`);
      setSuccess('Employee deleted'); fetchEmployees(); fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete'); }
  };

  // ── Run handlers ───────────────────────────────────────
  const handleCreateRun = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await API.post('/payroll/runs', runForm);
      setSuccess('Payroll run created'); fetchRuns(); fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Failed to create run'); }
    finally { setLoading(false); }
  };

  const handleProcessRun = async (runId) => {
    if (!window.confirm('Process this payroll? This will post journal entries to Accounting.')) return;
    setLoading(true); setError('');
    try {
      await API.post(`/payroll/runs/${runId}/process`);
      setSuccess('Payroll processed successfully'); fetchRuns(); fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Failed to process'); }
    finally { setLoading(false); }
  };

  const handleDeleteRun = async (id) => {
    if (!window.confirm('Delete this payroll run? All payslips will be removed.')) return;
    setError('');
    try {
      await API.delete(`/payroll/runs/${id}`);
      setSuccess('Payroll run deleted');
      if (expandedRunId === id) setExpandedRunId(null);
      fetchRuns(); fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete run'); }
  };

  const handlePrintRun = async (run) => {
    const slips = await fetchPayslipsForRun(run.id);
    if (slips.length === 0) { setError('No payslips to print'); return; }
    printPayroll(run, slips);
  };

  // Live deduction preview — uses rates from Settings (falls back to defaults)
  const previewDeductions = (salary) => {
    const s    = Number(salary) || 0;
    const paye = Math.round(s * Number(rates.paye_rate || 0.20));
    const nssf = Number(rates.nssf_amount || 2160);
    const brackets = (rates.nhif_brackets || []).slice().sort((a, b) => b.min_salary - a.min_salary);
    const nhif = (brackets.find(b => s > b.min_salary) || brackets[brackets.length - 1])?.amount || 150;
    const housing = Math.round(s * Number(rates.housing_levy_rate || 0.015));
    return { paye, nssf, nhif, housing, net: s - paye - nssf - nhif - housing };
  };

  const tabs = [
    { key: 'overview',  label: 'Overview'     },
    { key: 'employees', label: 'Employees'    },
    { key: 'runs',      label: 'Payroll Runs' },
  ];

  const StatCard = ({ label, value, color = 'text-gray-800', sub }) => (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );

  return (
    <MainLayout title="Payroll">

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key}
            onClick={() => { setTab(t.key); setError(''); setSuccess(''); setEditingEmployeeId(null); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.key ? 'border-red-700 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {error   && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 border border-red-100">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg mb-4 border border-green-100">{success}</div>}

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Employees"       value={summary?.total_employees || 0} />
            <StatCard label="Monthly Gross Payroll"  value={fmt(summary?.total_monthly_salary)} color="text-blue-700" />
            <StatCard label="Total Payroll Runs"     value={summary?.total_runs || 0} />
            <StatCard label="Processed Runs"         value={summary?.processed_runs || 0} color="text-green-700" />
          </div>

          {/* YTD deductions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Year-to-Date Statutory Deductions
              <span className="ml-2 text-xs font-normal text-gray-400">(processed payrolls only)</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-xs text-orange-600 font-medium mb-1">PAYE</p>
                <p className="text-lg font-bold text-orange-700">{fmt(summary?.ytd_paye)}</p>
                <p className="text-xs text-gray-400 mt-1">Income Tax</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-600 font-medium mb-1">NSSF</p>
                <p className="text-lg font-bold text-blue-700">{fmt(summary?.ytd_nssf)}</p>
                <p className="text-xs text-gray-400 mt-1">Pension (Tier I+II)</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-xs text-purple-600 font-medium mb-1">NHIF / SHA</p>
                <p className="text-lg font-bold text-purple-700">{fmt(summary?.ytd_nhif)}</p>
                <p className="text-xs text-gray-400 mt-1">Health Insurance</p>
              </div>
              <div className="text-center p-4 bg-teal-50 rounded-xl border border-teal-100">
                <p className="text-xs text-teal-600 font-medium mb-1">Housing Levy</p>
                <p className="text-lg font-bold text-teal-700">{fmt(summary?.ytd_housing)}</p>
                <p className="text-xs text-gray-400 mt-1">AHL (1.5%)</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-xs text-green-600 font-medium mb-1">Net Disbursed</p>
                <p className="text-lg font-bold text-green-700">{fmt(summary?.ytd_net)}</p>
                <p className="text-xs text-gray-400 mt-1">Total Paid Out</p>
              </div>
            </div>
          </div>

          {/* Last run summary */}
          {summary?.last_run && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">
                    Last Payroll — {MONTHS[(summary.last_run.month || 1) - 1]} {summary.last_run.year}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {summary.last_run.processed_at
                      ? `Processed ${new Date(summary.last_run.processed_at).toLocaleDateString('en-KE')}`
                      : 'Draft — not yet processed'}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[summary.last_run.status] || ''}`}>
                  {summary.last_run.status}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Gross Payroll', val: summary.last_run.total_gross,    color: 'text-gray-800'    },
                  { label: 'PAYE',          val: summary.last_run.total_paye,     color: 'text-orange-600'  },
                  { label: 'NSSF + NHIF',   val: (Number(summary.last_run.total_nssf||0)+Number(summary.last_run.total_nhif||0)), color: 'text-blue-600' },
                  { label: 'Net Pay',       val: summary.last_run.total_net,      color: 'text-green-700'   },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-base font-bold ${color}`}>{fmt(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statutory rates reference */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Kenya Statutory Rates (FY 2024/25)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
              <div><p className="font-semibold text-gray-700 mb-1">PAYE</p><p>20% of gross (simplified)</p></div>
              <div>
                <p className="font-semibold text-gray-700 mb-1">NSSF</p>
                <p>KES 2,160 / month</p>
                <p className="text-gray-400">Tier I KES 420 + Tier II KES 1,740</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-1">NHIF / SHA</p>
                <p>&gt;100k → KES 1,700</p>
                <p>&gt;50k &nbsp;→ KES 1,200</p>
                <p>&gt;30k &nbsp;→ KES 850</p>
                <p>&gt;15k &nbsp;→ KES 500</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-1">Affordable Housing</p>
                <p>1.5% of gross salary</p>
                <p className="text-gray-400">Housing Levy Act 2023</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ EMPLOYEES ═════════════════════════════════════════════════════════ */}
      {tab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-800">
                  {editingEmployeeId ? 'Edit Employee' : 'Add Employee'}
                </h2>
                {editingEmployeeId && (
                  <button onClick={() => { setEditingEmployeeId(null); resetEmpForm(); }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline">Cancel</button>
                )}
              </div>
              <form onSubmit={handleSaveEmployee} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Employee #</label>
                    <input value={empForm.employee_number}
                      onChange={e => setEmpForm({ ...empForm, employee_number: e.target.value })}
                      placeholder="EMP-001"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                    <input value={empForm.full_name} required
                      onChange={e => setEmpForm({ ...empForm, full_name: e.target.value })}
                      placeholder="Jane Doe"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={empForm.email}
                      onChange={e => setEmpForm({ ...empForm, email: e.target.value })}
                      placeholder="jane@company.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input value={empForm.phone}
                      onChange={e => setEmpForm({ ...empForm, phone: e.target.value })}
                      placeholder="07XXXXXXXX"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                    <input value={empForm.position}
                      onChange={e => setEmpForm({ ...empForm, position: e.target.value })}
                      placeholder="Accountant"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                    <input value={empForm.department}
                      onChange={e => setEmpForm({ ...empForm, department: e.target.value })}
                      placeholder="Finance"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Basic Salary (KES) *</label>
                    <input type="number" min="0" required value={empForm.basic_salary}
                      onChange={e => setEmpForm({ ...empForm, basic_salary: e.target.value })}
                      placeholder="50000"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bank Account</label>
                    <input value={empForm.bank_account}
                      onChange={e => setEmpForm({ ...empForm, bank_account: e.target.value })}
                      placeholder="Account number"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                  style={{ backgroundColor: '#a31b32' }}>
                  {loading ? 'Saving…' : editingEmployeeId ? 'Update Employee' : 'Add Employee'}
                </button>
              </form>
            </div>

            {/* Live deduction preview */}
            {Number(empForm.basic_salary) > 0 && (() => {
              const d = previewDeductions(empForm.basic_salary);
              return (
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-3">Estimated Deductions</p>
                  <div className="space-y-1.5 text-xs">
                    {[
                      ['Gross Salary',  fmt(empForm.basic_salary), 'text-gray-700'  ],
                      ['PAYE (20%)',    fmt(d.paye),               'text-orange-600'],
                      ['NSSF',          fmt(d.nssf),               'text-blue-600'  ],
                      ['NHIF / SHA',    fmt(d.nhif),               'text-purple-600'],
                      ['Housing Levy',  fmt(d.housing),            'text-teal-600'  ],
                    ].map(([l, v, c]) => (
                      <div key={l} className="flex justify-between">
                        <span className="text-gray-500">{l}</span>
                        <span className={`font-medium ${c}`}>{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="font-semibold text-gray-700">Estimated Net Pay</span>
                      <span className="font-bold text-green-700">{fmt(d.net)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Employees list */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Employees <span className="text-gray-400 font-normal text-sm">({employees.length})</span>
            </h2>
            <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '75vh' }}>
              {employees.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">No employees yet.</p>
              ) : employees.map(emp => {
                const d = previewDeductions(emp.basic_salary);
                return (
                  <div key={emp.id}
                    className={`border rounded-lg p-4 transition ${
                      editingEmployeeId === emp.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200'
                    }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{emp.full_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {emp.employee_number && <span className="mr-2">{emp.employee_number}</span>}
                          {emp.position && <span>{emp.position}</span>}
                          {emp.department && <span> · {emp.department}</span>}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-blue-700">{fmt(emp.basic_salary)}</p>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      <span>PAYE <strong className="text-orange-600">{fmt(d.paye)}</strong></span>
                      <span>NSSF <strong className="text-blue-600">{fmt(d.nssf)}</strong></span>
                      <span>NHIF <strong className="text-purple-600">{fmt(d.nhif)}</strong></span>
                      <span>HSG <strong className="text-teal-600">{fmt(d.housing)}</strong></span>
                      <span>Net <strong className="text-green-700">{fmt(d.net)}</strong></span>
                    </div>
                    {(emp.email || emp.phone) && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        {emp.email && <span className="mr-3">{emp.email}</span>}
                        {emp.phone && <span>{emp.phone}</span>}
                      </p>
                    )}
                    <div className="flex gap-3 mt-3 pt-2 border-t border-gray-100">
                      <button onClick={() => handleEditEmployee(emp)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                      <button onClick={() => handleDeleteEmployee(emp.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ PAYROLL RUNS ══════════════════════════════════════════════════════ */}
      {tab === 'runs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Create run */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-fit">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Payroll Run</h2>
            <form onSubmit={handleCreateRun} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select value={runForm.month}
                  onChange={e => setRunForm({ ...runForm, month: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input type="number" min="2020" max="2099" value={runForm.year}
                  onChange={e => setRunForm({ ...runForm, year: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}>
                {loading ? 'Creating…' : 'Create Run'}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              Creates a draft payroll for all active employees. Review the payslips, then click Process to post journal entries.
            </p>
          </div>

          {/* Runs list */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">
              Payroll Runs <span className="text-gray-400 font-normal text-sm">({runs.length})</span>
            </h2>

            {runs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
                <p className="text-gray-400 text-sm">No payroll runs yet.</p>
              </div>
            ) : runs.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {MONTHS[(r.month || 1) - 1]} {r.year}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {r.employee_count || 0} employees ·{' '}
                        {r.processed_at
                          ? `Processed ${new Date(r.processed_at).toLocaleDateString('en-KE')}`
                          : 'Draft'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </div>

                  {/* Deduction summary */}
                  <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
                    <div><p className="text-gray-400">Gross</p><p className="font-semibold text-gray-800">{fmt(r.total_gross)}</p></div>
                    <div><p className="text-gray-400">PAYE</p><p className="font-semibold text-orange-600">{fmt(r.total_paye)}</p></div>
                    <div><p className="text-gray-400">NSSF + NHIF</p><p className="font-semibold text-blue-600">{fmt(Number(r.total_nssf||0)+Number(r.total_nhif||0))}</p></div>
                    <div><p className="text-gray-400">Net Pay</p><p className="font-semibold text-green-700">{fmt(r.total_net)}</p></div>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => toggleRun(r.id)}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium transition">
                      {expandedRunId === r.id ? 'Hide Payslips ▲' : 'View Payslips ▼'}
                    </button>
                    <button onClick={() => handlePrintRun(r)} disabled={loadingPayslips}
                      className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition disabled:opacity-50">
                      Print
                    </button>
                    {r.status === 'draft' && (
                      <button onClick={() => handleProcessRun(r.id)} disabled={loading}
                        className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium transition disabled:opacity-50">
                        Process
                      </button>
                    )}
                    <button onClick={() => handleDeleteRun(r.id)}
                      className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition ml-auto">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Payslips table */}
                {expandedRunId === r.id && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {loadingPayslips && !payslips[r.id] ? (
                      <p className="text-xs text-gray-400 p-4 text-center">Loading…</p>
                    ) : !payslips[r.id] || payslips[r.id].length === 0 ? (
                      <p className="text-xs text-gray-400 p-4 text-center">No payslips found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-100 text-gray-600">
                              <th className="text-left px-4 py-2.5 font-semibold">Employee</th>
                              <th className="text-right px-3 py-2.5 font-semibold">Gross</th>
                              <th className="text-right px-3 py-2.5 font-semibold">PAYE</th>
                              <th className="text-right px-3 py-2.5 font-semibold">NSSF</th>
                              <th className="text-right px-3 py-2.5 font-semibold">NHIF</th>
                              <th className="text-right px-3 py-2.5 font-semibold">Hsg Levy</th>
                              <th className="text-right px-3 py-2.5 font-semibold">Total Ded.</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-green-700">Net Pay</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payslips[r.id].map(p => {
                              // Derive housing levy for legacy payslips that stored 0
                              const gross   = Number(p.gross_pay || 0);
                              const paye    = Number(p.paye || 0);
                              const nssf    = Number(p.nssf || 0);
                              const nhif    = Number(p.nhif || 0);
                              const housing = Number(p.other_deductions || 0) || Math.round(gross * 0.015);
                              const totalDed = paye + nssf + nhif + housing;
                              const net     = gross - totalDed;
                              return (
                              <tr key={p.id} className="border-t border-gray-100 hover:bg-white transition">
                                <td className="px-4 py-2.5">
                                  <p className="font-medium text-gray-800">{p.full_name}</p>
                                  <p className="text-gray-400">{[p.employee_number, p.position].filter(Boolean).join(' · ')}</p>
                                  <button
                                    onClick={() => printPayslip(p, r)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-0.5 underline"
                                  >Print Payslip</button>
                                </td>
                                <td className="text-right px-3 py-2.5 text-gray-700">{fmt(gross)}</td>
                                <td className="text-right px-3 py-2.5 text-orange-600">{fmt(paye)}</td>
                                <td className="text-right px-3 py-2.5 text-blue-600">{fmt(nssf)}</td>
                                <td className="text-right px-3 py-2.5 text-purple-600">{fmt(nhif)}</td>
                                <td className="text-right px-3 py-2.5 text-teal-600">{fmt(housing)}</td>
                                <td className="text-right px-3 py-2.5 text-gray-600">{fmt(totalDed)}</td>
                                <td className="text-right px-4 py-2.5 font-bold text-green-700">{fmt(net)}</td>
                              </tr>
                              );
                            })}
                            <tr className="bg-gray-800 text-white">{(() => {
                              const TC = (payslips[r.id] || []).reduce((a, p) => {
                                const g  = Number(p.gross_pay || 0);
                                const py = Number(p.paye || 0);
                                const ns = Number(p.nssf || 0);
                                const nh = Number(p.nhif || 0);
                                const hs = Number(p.other_deductions || 0) || Math.round(g * 0.015);
                                const d  = py + ns + nh + hs;
                                return { g: a.g+g, py: a.py+py, ns: a.ns+ns, nh: a.nh+nh, hs: a.hs+hs, d: a.d+d, n: a.n+(g-d) };
                              }, { g:0, py:0, ns:0, nh:0, hs:0, d:0, n:0 });
                              return (<>
                                <td className="px-4 py-2.5 font-semibold text-white">TOTALS</td>
                                <td className="text-right px-3 py-2.5 font-bold text-white">{fmt(TC.g)}</td>
                                <td className="text-right px-3 py-2.5 font-bold text-white">{fmt(TC.py)}</td>
                                <td className="text-right px-3 py-2.5 font-bold text-white">{fmt(TC.ns)}</td>
                                <td className="text-right px-3 py-2.5 font-bold text-white">{fmt(TC.nh)}</td>
                                <td className="text-right px-3 py-2.5 font-bold text-white">{fmt(TC.hs)}</td>
                                <td className="text-right px-3 py-2.5 font-bold text-white">{fmt(TC.d)}</td>
                                <td className="text-right px-4 py-2.5 font-bold text-green-300">{fmt(TC.n)}</td>
                              </>);
                            })()}</tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </MainLayout>
  );
}
