import { Workbook } from 'exceljs';
import { EVENT } from '../../shared/event.config';
import { type AdminRegistration, formatLocalPhone } from '../../shared/registration';

/*
 * Built in the browser (lazy-loaded only when the admin clicks "Descargar Excel"), so the
 * Cloudflare Worker never pays the CPU cost of zipping the spreadsheet.
 */

const ECUADOR_OFFSET_MS = -5 * 60 * 60 * 1000;
const METHOD_LABEL = { transfer: 'Transferencia', payphone: 'Tarjeta (PayPhone)' } as const;

/** Excel dates have no timezone; shift to Ecuador time (UTC-5, no DST) so cells read as local time. */
function ecuadorDate(iso: string | null): Date | null {
  return iso ? new Date(Date.parse(iso) + ECUADOR_OFFSET_MS) : null;
}

export function exportFileName(now = new Date()): string {
  const date = new Date(now.getTime() + ECUADOR_OFFSET_MS).toISOString().slice(0, 10);
  return `${EVENT.name.toLowerCase()}-registros-${date}.xlsx`;
}

export async function buildRegistrationsWorkbook(rows: AdminRegistration[]): Promise<Blob> {
  const workbook = new Workbook();
  workbook.creator = EVENT.name;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Registros', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'N°', key: 'n', width: 6 },
    { header: 'Código', key: 'ticket', width: 11 },
    { header: 'Nombres completos', key: 'fullName', width: 34 },
    { header: 'Cédula', key: 'cedula', width: 13 },
    { header: 'Teléfono', key: 'phone', width: 15 },
    { header: 'Estado de pago', key: 'status', width: 15 },
    { header: 'Método', key: 'method', width: 19 },
    { header: 'Referencia', key: 'reference', width: 18 },
    { header: 'Pagado el', key: 'paidAt', width: 17, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Registrado el', key: 'createdAt', width: 17, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
  ];

  rows.forEach((r, i) =>
    sheet.addRow({
      n: i + 1,
      ticket: r.ticket,
      fullName: r.fullName,
      cedula: r.cedula,
      phone: formatLocalPhone(r.phone),
      status: r.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente',
      method: r.paymentMethod ? METHOD_LABEL[r.paymentMethod] : '',
      reference: r.paymentReference ?? '',
      paidAt: ecuadorDate(r.paidAt),
      createdAt: ecuadorDate(r.createdAt),
    }),
  );

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC026D3' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };

  return new Blob([await workbook.xlsx.writeBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
