import * as XLSX from 'xlsx';

// מייצא סיכום תקציב לגיליון אקסל אחד — טור פריט + טור סכום, עם שורות ריקות
// (label: null) בין המדורים, כמו במסמך המודפס.
export function exportSummaryToExcel({ schoolName, yearLabel, filename, sheetName, rows }) {
  const wb = XLSX.utils.book_new();
  // כיווניות RTL בתצוגת הגיליון — לא משפיע על התוכן, רק על איך אקסל פותח אותו
  wb.Workbook = { Views: [{ RTL: true }] };

  const aoa = [
    [schoolName || ''],
    [yearLabel || ''],
    [],
    ['פריט', 'סכום'],
    ...rows.map(r => (r.label == null ? [] : [r.label, r.value])),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 52 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}
