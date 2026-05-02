import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * แคปหน้า DOM เป็น PDF (หลายหน้าอัตโนมัติเมื่อใบเสร็จยาว)
 */
export async function saveElementAsPdf(element, filename) {
  if (!element) {
    throw new Error('ไม่พบองค์ประกอบสำหรับสร้าง PDF');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: -window.scrollY,
  });

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const margin = 8;
  const pageWidthMm = pdf.internal.pageSize.getWidth() - 2 * margin;
  const pageHeightMm = pdf.internal.pageSize.getHeight() - 2 * margin;
  const scale = pageWidthMm / canvas.width;

  let offsetPx = 0;
  while (offsetPx < canvas.height) {
    if (offsetPx > 0) {
      pdf.addPage();
    }
    const slicePx = Math.min(Math.ceil(pageHeightMm / scale), canvas.height - offsetPx);
    const sliceMm = slicePx * scale;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = slicePx;
    const ctx = sliceCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      offsetPx,
      canvas.width,
      slicePx,
      0,
      0,
      canvas.width,
      slicePx
    );

    const dataUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(dataUrl, 'JPEG', margin, margin, pageWidthMm, sliceMm);
    offsetPx += slicePx;
  }

  pdf.save(filename);
}
