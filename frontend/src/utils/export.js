/**
 * Utility to export tabular data to CSV and Excel (XLS) format without external dependencies.
 */

const escapeXml = (unsafe) => {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Exports data to CSV.
 * @param {Array<Array<any>>} rows - The data rows (each row is an array of cell values).
 * @param {Array<string>} headers - The column header labels.
 * @param {string} filename - The target filename.
 */
export const exportToCSV = (rows, headers, filename) => {
  let csvContent = '\uFEFF'; // UTF-8 BOM to ensure Excel opens it correctly with special characters
  csvContent += headers.join(',') + '\n';
  
  rows.forEach(row => {
    const processedRow = row.map(val => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      // Escape double quotes and wrap in quotes if it contains commas, quotes, or newlines
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    });
    csvContent += processedRow.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Exports data to Excel (XML Spreadsheet format, compatible with Microsoft Excel).
 * @param {Array<Array<any>>} rows - The data rows (each row is an array of cell values).
 * @param {Array<string>} headers - The column header labels.
 * @param {string} filename - The target filename.
 */
export const exportToXLSX = (rows, headers, filename) => {
  let html = '<table border="1"><thead><tr style="background-color: #052e16; color: #ffffff; font-weight: bold;">';
  headers.forEach(h => { 
    html += `<th style="padding: 6px 12px;">${escapeXml(h)}</th>`; 
  });
  html += '</tr></thead><tbody>';
  
  rows.forEach((row, idx) => {
    // Zebra striping for visual appeal in Excel
    const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
    html += `<tr style="background-color: ${bg};">`;
    row.forEach(cell => {
      // Align numbers to the right, strings to the left
      const isNum = typeof cell === 'number' && !isNaN(cell);
      const align = isNum ? 'right' : 'left';
      html += `<td style="padding: 6px 12px; text-align: ${align};">${escapeXml(cell)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  const template = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Report</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="text/html; charset=UTF-8">
      <style>
        table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; }
        th { font-weight: bold; }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;
  
  const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Excel opens .xls files in this XML format natively
  const cleanFilename = filename.endsWith('.xls') || filename.endsWith('.xlsx') 
    ? filename.replace(/\.xlsx$/, '.xls') 
    : `${filename}.xls`;
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
