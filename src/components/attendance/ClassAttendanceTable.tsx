export interface ClassReportRow {
  name: string; rosterTotal: number; rosterMale?: number; rosterFemale?: number;
  total: number; present: number; late: number; leave: number; absent: number; evidence: boolean;
  male?: { present: number; late: number; absent: number };
  female?: { present: number; late: number; absent: number };
}
export default function ClassAttendanceTable({rows, units}: {rows: ClassReportRow[]; units: string}) {
  const sum = (key: keyof ClassReportRow) => rows.reduce((n,r) => n + (typeof r[key] === 'number' ? Number(r[key]) : 0),0);
  const gender = (sex: 'male'|'female') => rows.every(r => r[sex]) ? {present:rows.reduce((n,r)=>n+(r[sex]?.present??0),0),late:rows.reduce((n,r)=>n+(r[sex]?.late??0),0),absent:rows.reduce((n,r)=>n+(r[sex]?.absent??0),0)} : undefined;
  const total: ClassReportRow = {name:'รวมทั้งหมด',rosterTotal:sum('rosterTotal'),rosterMale:rows.every(r=>r.rosterMale!==undefined)?sum('rosterMale'):undefined,rosterFemale:rows.every(r=>r.rosterFemale!==undefined)?sum('rosterFemale'):undefined,total:sum('total'),present:sum('present'),late:sum('late'),leave:sum('leave'),absent:sum('absent'),evidence:rows.some(r=>r.evidence),male:gender('male'),female:gender('female')};
  const render = (r:ClassReportRow) => {
    const fmt = (v?:number, attendance=false) => v===undefined || (attendance&&!r.evidence) ? '—' : v.toLocaleString('th-TH');
    const came = (sex?:'male'|'female') => sex ? (r[sex] ? (r[sex]?.present??0)+(r[sex]?.late??0) : undefined) : r.present+r.late;
    return <tr key={r.name}><th scope="row">{r.name}</th><td>{fmt(r.rosterMale)}</td><td>{fmt(r.rosterFemale)}</td><td className="report-total">{fmt(r.rosterTotal)}</td><td>{fmt(r.total,true)}</td>{[came('male'),came('female'),came()].map((v,i)=><td key={`p${i}`} className={`report-present ${i===2?'report-total':''}`}>{fmt(v,true)}</td>)}{[r.male?.late,r.female?.late,r.late].map((v,i)=><td key={`l${i}`} className={`report-late ${i===2?'report-total':''}`}>{fmt(v,true)}</td>)}<td className="report-leave">{fmt(r.leave,true)}</td>{[r.male?.absent,r.female?.absent,r.absent].map((v,i)=><td key={`a${i}`} className={`report-absent ${i===2?'report-total':''}`}>{fmt(v,true)}</td>)}<td><span className={`report-rate ${r.evidence&&r.total&&(r.present+r.late)/r.total>=.8?'report-rate-good':''}`}>{r.evidence&&r.total?`${((r.present+r.late)/r.total*100).toFixed(1)}%`:'—'}</span></td></tr>;
  };
  return <div className="class-report"><div className="class-report-title"><h3>สรุปการเข้าเรียนรายชั้น</h3><span>รวม {rows.length} ชั้นเรียน</span></div><div className="class-report-scroll"><table aria-label="สรุปการเข้าเรียนรายชั้น"><thead><tr><th rowSpan={2}>ชั้น</th><th colSpan={3}>จำนวนนักเรียน (คน)</th><th rowSpan={2}>{units}</th><th colSpan={3} className="report-present">มาเรียน ({units})</th><th colSpan={3} className="report-late">สาย ({units})</th><th rowSpan={2} className="report-leave">ลา / ป่วย</th><th colSpan={3} className="report-absent">ขาด ({units})</th><th rowSpan={2}>% เข้าเรียน</th></tr><tr>{['','report-present','report-late','report-absent'].flatMap((tone,i)=>['ช','ญ','รวม'].map(label=><th key={`${i}${label}`} className={tone}>{label}</th>))}</tr></thead><tbody>{rows.map(render)}</tbody><tfoot>{render(total)}</tfoot></table></div></div>;
}
